import json
import logging
import subprocess
import tempfile
from functools import lru_cache
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from django.conf import settings
from huggingface_hub import snapshot_download

from .models import Content

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _get_whisper_model():
    from faster_whisper import WhisperModel

    return WhisperModel(
        settings.WHISPER_MODEL_SIZE,
        device='cpu',
        compute_type=settings.WHISPER_COMPUTE_TYPE,
        cpu_threads=settings.WHISPER_CPU_THREADS,
        num_workers=1,
        download_root=settings.WHISPER_DOWNLOAD_ROOT,
    )


def _probe_media(media_path):
    result = subprocess.run(
        [
            'ffprobe', '-v', 'error', '-show_streams', '-show_format',
            '-of', 'json', str(media_path),
        ],
        check=True,
        capture_output=True,
        text=True,
        timeout=60,
    )
    metadata = json.loads(result.stdout)
    duration = float(metadata.get('format', {}).get('duration', 0))
    if duration <= 0 or duration > settings.MEDIA_MAX_DURATION_SECONDS:
        raise ValueError(
            f'Media duration must be between 0 and '
            f'{settings.MEDIA_MAX_DURATION_SECONDS} seconds.'
        )
    streams = metadata.get('streams', [])
    return duration, any(s.get('codec_type') == 'video' for s in streams), any(
        s.get('codec_type') == 'audio' for s in streams
    )


def _extract_frames(media_path, directory, duration):
    max_frames = max(int(settings.MEDIA_MAX_FRAMES), 1)
    interval = max(
        float(settings.MEDIA_FRAME_INTERVAL_SECONDS),
        duration / max_frames,
        0.1,
    )
    subprocess.run(
        [
            'ffmpeg', '-nostdin', '-v', 'error', '-i', str(media_path),
            '-vf', f"fps=1/{interval},scale=w='min(640,iw)':h=-2",
            '-frames:v', str(max_frames),
            '-q:v', '5', str(Path(directory) / 'frame-%04d.jpg'),
        ],
        check=True,
        capture_output=True,
        timeout=settings.MEDIA_MAX_DURATION_SECONDS + 120,
    )
    return sorted(Path(directory).glob('frame-*.jpg'))


@lru_cache(maxsize=1)
def _get_nsfw_classifier():
    from transformers import pipeline

    model_path = Path(settings.HF_NSFW_MODEL_PATH)
    model_path.mkdir(parents=True, exist_ok=True)
    snapshot_download(
        repo_id=settings.HF_NSFW_MODEL,
        local_dir=str(model_path),
        token=settings.HF_TOKEN or None,
    )
    return pipeline(
        'image-classification',
        model=str(model_path),
        device=-1,
    )


def _classify_frames(frame_paths):
    classifier = _get_nsfw_classifier()
    frame_results = []

    for frame_path in frame_paths:
        predictions = classifier(str(frame_path), top_k=None)
        labels = [
            {'label': item['label'], 'score': float(item['score'])}
            for item in predictions
        ]
        recognized_labels = {
            item['label'].strip().lower() for item in labels
        }
        if not recognized_labels.intersection(
            {'nsfw', 'porn', 'hentai', 'normal', 'sfw'}
        ):
            raise RuntimeError('NSFW detector returned unrecognized labels.')
        nsfw_score = max(
            (
                item['score'] for item in labels
                if item['label'].strip().lower() in {'nsfw', 'porn', 'hentai'}
            ),
            default=0.0,
        )
        is_unsafe = nsfw_score >= settings.HF_NSFW_THRESHOLD
        normal_score = max(
            (
                item['score'] for item in labels
                if item['label'].strip().lower() in {'normal', 'sfw'}
            ),
            default=0.0,
        )
        logger.info(
            'Video safety frame %s: normal=%.4f nsfw=%.4f unsafe=%s',
            frame_path.name,
            normal_score,
            nsfw_score,
            is_unsafe,
        )
        frame_results.append({
            'frame': frame_path.name,
            'nsfw_score': nsfw_score,
            'label_scores': labels,
            'unsafe': is_unsafe,
        })
    flagged_frames = sum(1 for frame in frame_results if frame['unsafe'])
    minimum_flagged_frames = max(settings.MEDIA_NSFW_MIN_FLAGGED_FRAMES, 1)
    rejected = flagged_frames >= minimum_flagged_frames
    logger.info(
        'Video safety result: %d/%d frames flagged (minimum %d): unsafe=%s',
        flagged_frames,
        len(frame_results),
        minimum_flagged_frames,
        rejected,
    )

    return frame_results, rejected


def _extract_and_transcribe(media_path, directory):
    audio_path = Path(directory) / 'audio.mp3'
    subprocess.run(
        [
            'ffmpeg', '-nostdin', '-v', 'error', '-i', str(media_path),
            '-vn', '-ac', '1', '-ar', '16000', '-b:a', '64k',
            '-y', str(audio_path),
        ],
        check=True,
        capture_output=True,
        timeout=settings.MEDIA_MAX_DURATION_SECONDS + 120,
    )
    model = _get_whisper_model()
    segments, _ = model.transcribe(
        str(audio_path),
        beam_size=settings.WHISPER_BEAM_SIZE,
        vad_filter=False,
    )
    return ' '.join(segment.text.strip() for segment in segments).strip()


def _assess_audio(media_path, directory):
    transcript = _extract_and_transcribe(media_path, directory)
    audio_result = {
        'status': 'transcribed',
        'transcription_model': f'faster-whisper:{settings.WHISPER_MODEL_SIZE}',
        'transcript_safety': None,
    }
    if not transcript:
        audio_result['status'] = 'no_speech_detected'
        return transcript, audio_result, False

    from .safety_api import predict_safety_for_full_text

    text_label, text_confidence = predict_safety_for_full_text(transcript)
    normalized_label = str(text_label).strip().lower()
    if normalized_label not in {'safe', 'unsafe'}:
        raise RuntimeError('Transcript safety model returned an unknown label.')
    audio_result['transcript_safety'] = {
        'label': normalized_label,
        'confidence': float(text_confidence),
    }
    return transcript, audio_result, normalized_label == 'unsafe'


def process_media_content(content):
    """Inspect uploaded media and persist fail-closed assessment results."""
    content.processing_status = Content.ProcessingStatus.PROCESSING
    content.safety_label = Content.SafetyStatus.PENDING
    content.assessment_status = Content.AssessmentStatus.PENDING
    content.recommendation_eligible = False
    content.developmental_scores = {}
    content.save(update_fields=[
        'processing_status', 'safety_label', 'assessment_status',
        'recommendation_eligible', 'developmental_scores', 'updated_at',
    ])

    visual_result = {'status': 'not_applicable', 'frames': []}
    audio_result = {'status': 'not_applicable', 'transcript_safety': None}
    transcript = ''
    try:
        media_path = Path(content.media_file.path)
        if media_path.stat().st_size > settings.MEDIA_MAX_UPLOAD_BYTES:
            raise ValueError('Media upload exceeds the configured size limit.')
        duration, has_video, has_audio = _probe_media(media_path)
        content.media_duration_seconds = round(duration)
        if content.content_type == Content.ContentType.VIDEO and not has_video:
            raise ValueError('Uploaded video has no video stream.')

        with tempfile.TemporaryDirectory(prefix='neuroguide-media-') as temp_dir:
            frames = []
            if has_video:
                frames = _extract_frames(media_path, temp_dir, duration)
                if not frames:
                    raise RuntimeError('No video frames could be extracted.')
            visual_error = None
            audio_error = None
            visual_unsafe = False
            audio_unsafe = False
            with ThreadPoolExecutor(max_workers=2) as executor:
                visual_future = (
                    executor.submit(_classify_frames, frames)
                    if has_video else None
                )
                audio_future = (
                    executor.submit(_assess_audio, media_path, temp_dir)
                    if has_audio else None
                )

                if visual_future:
                    try:
                        frame_results, visual_unsafe = visual_future.result()
                        visual_result = {
                            'status': 'unsafe' if visual_unsafe else 'safe',
                            'model': settings.HF_NSFW_MODEL,
                            'frames_checked': len(frame_results),
                            'frames': frame_results,
                        }
                    except Exception as exc:
                        visual_error = exc
                        visual_result = {
                            'status': 'failed',
                            'error': str(exc)[:500],
                            'frames': [],
                        }

                if audio_future:
                    try:
                        transcript, audio_result, audio_unsafe = audio_future.result()
                    except Exception as exc:
                        audio_error = exc
                        audio_result = {
                            'status': 'failed',
                            'error': str(exc)[:500],
                            'transcript_safety': None,
                        }
                elif content.content_type == Content.ContentType.AUDIO:
                    audio_error = ValueError('Uploaded audio has no audio stream.')
                    audio_result = {
                        'status': 'failed',
                        'error': str(audio_error),
                        'transcript_safety': None,
                    }

            if visual_unsafe or audio_unsafe:
                content.transcript = transcript
                content.visual_assessment = visual_result
                content.audio_assessment = audio_result
                content.safety_assessment = {
                    'visual': visual_result,
                    'audio': audio_result,
                    'policy': 'reject_if_any_modality_is_unsafe',
                }
                content.safety_label = Content.SafetyStatus.UNSAFE
                content.assessment_status = Content.AssessmentStatus.COMPLETED
                content.processing_status = Content.ProcessingStatus.COMPLETED
                content.recommendation_eligible = False
                content.save()
                return content

            if visual_error or audio_error:
                raise visual_error or audio_error

        content.transcript = transcript
        content.visual_assessment = visual_result
        content.audio_assessment = audio_result
        content.safety_assessment = {
            'visual': visual_result,
            'audio': audio_result,
            'policy': 'reject_if_any_modality_is_unsafe',
        }
        content.safety_confidence = None

        if visual_unsafe or audio_unsafe:
            content.safety_label = Content.SafetyStatus.UNSAFE
            content.assessment_status = Content.AssessmentStatus.COMPLETED
            content.processing_status = Content.ProcessingStatus.COMPLETED
            content.save()
            return content

        content.safety_label = Content.SafetyStatus.SAFE
        # Recommend media as general age-appropriate activities. Transcript
        # labels can misrepresent the goals of a complete audio/video resource.
        content.assessment_status = Content.AssessmentStatus.COMPLETED
        content.developmental_scores = {}
        content.recommendation_eligible = True

        content.processing_status = Content.ProcessingStatus.COMPLETED
        content.save()
        return content

    except Exception as exc:
        logger.exception('Media assessment failed for content ID %s', content.pk)
        content.safety_label = Content.SafetyStatus.INCONCLUSIVE
        content.transcript = transcript
        content.visual_assessment = visual_result
        content.audio_assessment = audio_result
        content.safety_assessment = {
            'visual': visual_result,
            'audio': audio_result,
            'error': str(exc)[:500],
        }
        content.assessment_status = Content.AssessmentStatus.FAILED
        content.processing_status = Content.ProcessingStatus.FAILED
        content.recommendation_eligible = False
        content.save()
        raise
