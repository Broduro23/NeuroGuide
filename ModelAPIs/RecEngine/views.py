from rest_framework.views import APIView
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import JSONParser, MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework import generics, status
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.views import TokenObtainPairView
from .serializers import RegisterSerializer, UserProfileSerializer, ChildProfileSerializer
from django.db import transaction
from django.utils import timezone
from django.conf import settings
from django.shortcuts import get_object_or_404
from .models import (
    ChildProfile,
    Content,
    RecommendationActivity,
    RecommendationHistory,
    ContentFlag,
    UserNotification,
)
from .recommendation_engine import recommend_content
from .developmental_contract import normalize_developmental_result
from .permissions import (
    AdminOnly,
    ApplicationUserAccess,
    CaregiverAccess,
    ContentProviderAccess,
    user_role,
)
from .models import UserRole

import logging

logger = logging.getLogger(__name__)

class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]


class LoginView(TokenObtainPairView):
    permission_classes = [AllowAny]


class UserProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user



class ChildProfileViewSet(viewsets.ModelViewSet):
    serializer_class = ChildProfileSerializer
    permission_classes = [CaregiverAccess]

    def get_queryset(self):
        if user_role(self.request.user) == UserRole.Role.ADMIN:
            return ChildProfile.objects.all()
        return ChildProfile.objects.filter(
            caregiver=self.request.user
        )

    def perform_create(self, serializer):
        serializer.save(caregiver=self.request.user)

# Create your views here.
class DevelopmentalPredictionView(APIView):

    permission_classes = [ContentProviderAccess]

    parser_classes = [
        JSONParser,
        MultiPartParser,
        FormParser,
    ]

    def post(self, request):

        text = request.data.get("text", "")

        # If a text file was uploaded, read its contents.
        uploaded_file = request.FILES.get("file")

        if uploaded_file:
            if not uploaded_file.name.lower().endswith(".txt"):
                return Response(
                    {
                        "error": "Only .txt files are supported."
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Limit uploads to 1 MB.
            if uploaded_file.size > 1_000_000:
                return Response(
                    {
                        "error": "The file must not exceed 1 MB."
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            try:
                text = uploaded_file.read().decode("utf-8")
            except UnicodeDecodeError:
                return Response(
                    {
                        "error": "The file must use UTF-8 text encoding."
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if not isinstance(text, str) or not text.strip():
            return Response(
                {
                    "error": "Provide non-empty text or upload a .txt file."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            from .dev_assessment import predict_developmental_probabilities

            result = predict_developmental_probabilities(text)
            probabilities, _suitability, suitability_probabilities = (
                normalize_developmental_result(result)
            )
            threshold = 0.5

            predicted_domains = [
                label
                for label, probability in probabilities.items()
                if probability >= threshold
            ]

            return Response(
                {
                    "input_text": text,
                    "probabilities": probabilities,
                    "predicted_domains": predicted_domains,
                    "threshold": threshold,
                    "suitability": result["suitability"],
                    "suitability_probabilities": suitability_probabilities,
                },
                status=status.HTTP_200_OK,
            )

        except Exception:
            logger.exception("Developmental prediction failed.")
            return Response(
                {
                    "error": "Prediction failed. Check the model configuration and server logs."
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

class SafetyPredictionView(APIView):

    permission_classes = [ContentProviderAccess]
    parser_classes = [
        JSONParser,
        MultiPartParser,
        FormParser,
    ]

    def post(self, request):

        text = request.data.get("text", "")

        # If a text file was uploaded, read its contents.
        uploaded_file = request.FILES.get("file")

        if uploaded_file:
            if not uploaded_file.name.lower().endswith(".txt"):
                return Response(
                    {
                        "error": "Only .txt files are supported."
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Limit uploads to 1 MB.
            if uploaded_file.size > 1_000_000:
                return Response(
                    {
                        "error": "The file must not exceed 1 MB."
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            try:
                text = uploaded_file.read().decode("utf-8")
            except UnicodeDecodeError:
                return Response(
                    {
                        "error": "The file must use UTF-8 text encoding."
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if not isinstance(text, str) or not text.strip():
            return Response(
                {
                    "error": "Provide non-empty text or upload a .txt file."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            from .safety_api import predict_safety

            result, confidence = predict_safety(text)

            return Response(
                {
                    "input_text": text,
                    "classification": result,
                    "confidence": confidence,
                },
                status=status.HTTP_200_OK,
            )

        except Exception:
            return Response(
                {
                    "error": "Prediction failed. Check the model configuration and server logs."
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
def serialize_content(content, include_flag_details=False):
    """Convert a Content instance into a JSON-ready dictionary."""

    return {
        "id": content.pk,
        "title": content.title,
        "text": content.text,
        "source_filename": content.source_filename,
        "content_type": content.content_type,
        "media_file": content.media_file.name if content.media_file else None,
        "media_file_url": content.media_file.url if content.media_file else None,
        "transcript": content.transcript,
        "media_duration_seconds": content.media_duration_seconds,
        "age_min": content.age_min,
        "age_max": content.age_max,
        "safety_label": content.safety_label,
        "safety_confidence": content.safety_confidence,
        "safety_assessment": content.safety_assessment,
        "visual_assessment": content.visual_assessment,
        "audio_assessment": content.audio_assessment,
        "developmental_scores": content.developmental_scores,
        "suitability_label": content.get_suitability_label_display() or None,
        "suitability_probabilities": content.suitability_probabilities,
        "assessment_status": content.assessment_status,
        "processing_status": content.processing_status,
        "recommendation_eligible": content.recommendation_eligible,
        "moderation_status": content.moderation_status,
        "flag_count": content.flags.count(),
        "created_by": content.created_by_id,
        "flag_reasons": (
            [flag.reason for flag in content.flags.all() if flag.reason]
            if include_flag_details else []
        ),
        "created_at": content.created_at.isoformat(),
        "updated_at": content.updated_at.isoformat(),
    }


def extract_content_text(request):
    """
    Extract learning content from either a JSON request or a .txt upload.

    Returns:
        (text, filename, error)
    """

    uploaded_file = request.FILES.get("file")

    if uploaded_file is not None:
        if not uploaded_file.name.lower().endswith(".txt"):
            return None, None, "Only .txt files are supported."

        max_file_size = 2 * 1024 * 1024

        if uploaded_file.size > max_file_size:
            return None, None, "The uploaded file must not exceed 2 MB."

        try:
            text = uploaded_file.read().decode("utf-8")
        except UnicodeDecodeError:
            return None, None, "The uploaded file must use UTF-8 encoding."

        filename = uploaded_file.name

    else:
        text = request.data.get("text", "")
        filename = ""

    if not isinstance(text, str) or not text.strip():
        return None, None, "Learning content text is required."

    if len(text) > 100_000:
        return None, None, "Content must not exceed 100,000 characters."

    return text.strip(), filename, None


def normalize_safety_result(result):
    """
    Normalize a safety-model result.

    Supported tuple example:
        ("Safe", 0.95)
    Expected dictionary example:
        {"label": "safe", "confidence": 0.95}
    """

    if isinstance(result, (tuple, list)) and len(result) == 2:
        raw_label, raw_confidence = result
        label = str(raw_label).lower().strip()

        try:
            confidence = float(raw_confidence)
        except (TypeError, ValueError, OverflowError):
            confidence = None

        details = {
            "label": raw_label,
            "confidence": confidence,
        }

    elif isinstance(result, str):
        label = result.lower().strip()
        confidence = None
        details = {"label": result}

    elif isinstance(result, dict):
        label = str(
            result.get("safety_label", result.get("label", result.get("prediction", "")))
        ).lower().strip()

        raw_confidence = result.get("confidence", result.get("score"))

        try:
            confidence = (
                float(raw_confidence)
                if raw_confidence is not None
                else None
            )
        except (TypeError, ValueError):
            confidence = None

        details = result

    else:
        raise ValueError("Unsupported safety-model response format.")

    if label not in {"safe", "unsafe"}:
        label = "inconclusive"

    if confidence is not None and not 0 <= confidence <= 1:
        confidence = None

    return label, confidence, details


def assess_content_record(content):
    """Run safety and developmental assessment and persist the results."""
    from .dev_assessment import predict_developmental_probabilities
    from .safety_api import predict_safety

    content.safety_label = Content.SafetyStatus.PENDING
    content.safety_confidence = None
    content.safety_assessment = {}
    content.developmental_scores = {}
    content.suitability_label = ""
    content.suitability_probabilities = {}
    content.assessment_status = Content.AssessmentStatus.PENDING
    content.recommendation_eligible = False
    content.save()

    try:
        safety_result = predict_safety(content.text)
        safety_label, confidence, details = normalize_safety_result(
            safety_result
        )

        content.safety_label = safety_label
        content.safety_confidence = confidence
        content.safety_assessment = details

        if safety_label != Content.SafetyStatus.SAFE:
            content.assessment_status = Content.AssessmentStatus.COMPLETED
            content.recommendation_eligible = False
            content.save()
            return content

        developmental_result = predict_developmental_probabilities(
            content.text
        )
        (
            content.developmental_scores,
            content.suitability_label,
            content.suitability_probabilities,
        ) = normalize_developmental_result(developmental_result)
        content.assessment_status = Content.AssessmentStatus.COMPLETED
        content.recommendation_eligible = (
            content.suitability_label
            in {
                Content.SuitabilityStatus.SUITABLE,
                Content.SuitabilityStatus.PARTIALLY_SUITABLE,
            }
        )

        with transaction.atomic():
            content.save()

        return content

    except Exception:
        logger.exception("Content assessment failed for content ID %s", content.pk)
        content.assessment_status = Content.AssessmentStatus.FAILED
        content.recommendation_eligible = False
        content.save(
            update_fields=[
                "safety_label",
                "safety_confidence",
                "safety_assessment",
                "developmental_scores",
                "suitability_label",
                "suitability_probabilities",
                "assessment_status",
                "recommendation_eligible",
                "updated_at",
            ]
        )
        raise


class RecommendationView(APIView):
    """
    Submit educational content, assess it, and persist it in PostgreSQL.

    GET  /api/content/  -> List stored content.
    POST /api/content/ -> Submit and assess content.
    """

    def get_permissions(self):
        permission = ApplicationUserAccess if self.request.method == "GET" else ContentProviderAccess
        return [permission()]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get(self, request):
        """
        Retrieve content records from PostgreSQL.

        Return all stored content records for authenticated library managers.
        """

        role = user_role(request.user)
        queryset = Content.objects.select_related("created_by").all()
        if role == UserRole.Role.CONTENT_PROVIDER:
            queryset = queryset.filter(created_by=request.user)
        elif role != UserRole.Role.ADMIN:
            queryset = queryset.filter(
                moderation_status=Content.ModerationStatus.CLEAR,
                safety_label=Content.SafetyStatus.SAFE,
            )

        results = [
            serialize_content(
                item,
                include_flag_details=role == UserRole.Role.ADMIN,
            )
            for item in queryset
        ]

        return Response(results, status=status.HTTP_200_OK)

    def post(self, request):
        """
        Save content, run safety classification, and then developmental
        assessment when the safety policy permits it.
        """

        content_type = str(request.data.get('content_type', 'text')).lower()
        upload = request.FILES.get('media_file') or request.FILES.get('file')
        text = ''
        filename = ''

        if content_type == Content.ContentType.TEXT:
            text, filename, error = extract_content_text(request)
            if error:
                return Response(
                    {"error": error},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        elif content_type in {
            Content.ContentType.VIDEO,
            Content.ContentType.AUDIO,
        }:
            if upload is None:
                return Response(
                    {"error": "Upload the media using the 'media_file' field."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if upload.size > settings.MEDIA_MAX_UPLOAD_BYTES:
                return Response(
                    {"error": "Media upload exceeds the configured size limit."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            extension = upload.name.rsplit('.', 1)[-1].lower() if '.' in upload.name else ''
            allowed = (
                {'mp4', 'mov', 'mkv', 'webm', 'avi', 'mpeg', 'mpg'}
                if content_type == Content.ContentType.VIDEO
                else {'mp3', 'wav', 'm4a', 'ogg', 'flac', 'webm', 'mpeg', 'mpga'}
            )
            if extension not in allowed:
                return Response(
                    {"error": f"Unsupported {content_type} file extension."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            filename = upload.name
        else:
            return Response(
                {"error": "content_type must be text, audio, or video."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        title = request.data.get("title", "").strip()

        if not title:
            title = filename.rsplit(".", 1)[0] if filename else "Untitled content"

        if len(title) > 255:
            return Response(
                {"error": "Title must not exceed 255 characters."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            age_min = int(request.data.get("age_min"))
            age_max = int(request.data.get("age_max"))
        except (TypeError, ValueError):
            return Response(
                {"error": "age_min and age_max must be integers."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not (0 <= age_min <= age_max <= 83):
            return Response(
                {
                    "error": (
                        "Age range must satisfy "
                        "0 <= age_min <= age_max <= 83 months."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Persist content before queueing expensive model inference.
        content = Content.objects.create(
            title=title,
            text=text,
            source_filename=filename,
            content_type=content_type,
            media_file=upload if content_type != Content.ContentType.TEXT else None,
            age_min=age_min,
            age_max=age_max,
            safety_label=Content.SafetyStatus.PENDING,
            assessment_status=Content.AssessmentStatus.PENDING,
            recommendation_eligible=False,
            created_by=request.user,
        )

        if content_type in {
            Content.ContentType.VIDEO,
            Content.ContentType.AUDIO,
        }:
            from .tasks import assess_media_content

            content.processing_status = Content.ProcessingStatus.PENDING
            content.save(update_fields=['processing_status', 'updated_at'])
            try:
                assess_media_content.delay(content.pk)
            except Exception:
                logger.exception('Could not enqueue media assessment %s', content.pk)
                content.processing_status = Content.ProcessingStatus.FAILED
                content.assessment_status = Content.AssessmentStatus.FAILED
                content.safety_label = Content.SafetyStatus.INCONCLUSIVE
                content.safety_assessment = {
                    'error': 'Media assessment could not be queued.'
                }
                content.save()
                return Response(
                    {
                        'error': 'Media was saved but could not be queued for assessment.',
                        'content_id': content.pk,
                    },
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )

            return Response(
                {
                    'message': 'Media uploaded and queued for assessment.',
                    'content': serialize_content(content),
                },
                status=status.HTTP_202_ACCEPTED,
            )

        from .tasks import assess_text_content

        content.processing_status = Content.ProcessingStatus.PENDING
        content.save(update_fields=['processing_status', 'updated_at'])
        try:
            assess_text_content.delay(content.pk)
        except Exception:
            logger.exception('Could not enqueue text assessment %s', content.pk)
            content.processing_status = Content.ProcessingStatus.FAILED
            content.assessment_status = Content.AssessmentStatus.FAILED
            content.safety_label = Content.SafetyStatus.INCONCLUSIVE
            content.safety_assessment = {
                'error': 'Text assessment could not be queued.'
            }
            content.save()
            return Response(
                {
                    'error': 'Text was saved but could not be queued for assessment.',
                    'content_id': content.pk,
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response(
            {
                "message": "Text content uploaded and queued for assessment.",
                "content": serialize_content(content),
            },
            status=status.HTTP_202_ACCEPTED,
        )

class ContentDetailView(APIView):
    """
    Retrieve, update, or delete an educational content record.

    GET    /api/content/<id>/
    PATCH  /api/content/<id>/
    DELETE /api/content/<id>/
    """

    def get_permissions(self):
        permission = ApplicationUserAccess if self.request.method == "GET" else ContentProviderAccess
        return [permission()]

    def get_object(self, content_id):
        return get_object_or_404(
            Content,
            pk=content_id,
        )

    def get(self, request, content_id):
        content = self.get_object(content_id)

        role = user_role(request.user)
        if role == UserRole.Role.CONTENT_PROVIDER:
            if content.created_by_id != request.user.pk:
                return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        elif role != UserRole.Role.ADMIN and (
            content.safety_label != Content.SafetyStatus.SAFE
            or content.moderation_status != Content.ModerationStatus.CLEAR
        ):
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        return Response(
            serialize_content(content),
            status=status.HTTP_200_OK,
        )

    def patch(self, request, content_id):
        content = self.get_object(content_id)
        if (
            user_role(request.user) != UserRole.Role.ADMIN
            and content.created_by_id != request.user.pk
        ):
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        allowed_fields = {
            "title",
            "text",
            "age_min",
            "age_max",
            "content_type",
        }

        unexpected_fields = set(request.data.keys()) - allowed_fields

        if unexpected_fields:
            return Response(
                {
                    "error": "Unsupported fields.",
                    "fields": sorted(unexpected_fields),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        updated = {}

        for field in allowed_fields:
            if field in request.data:
                updated[field] = request.data[field]

        new_age_min = updated.get("age_min", content.age_min)
        new_age_max = updated.get("age_max", content.age_max)

        try:
            new_age_min = int(new_age_min)
            new_age_max = int(new_age_max)
        except (TypeError, ValueError):
            return Response(
                {"error": "Age values must be integers."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not (0 <= new_age_min <= new_age_max <= 83):
            return Response(
                {"error": "Invalid age range."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if "title" in updated:
            if not isinstance(updated["title"], str) or not updated["title"].strip():
                return Response(
                    {"error": "Title must not be empty."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if len(updated["title"]) > 255:
                return Response(
                    {"error": "Title must not exceed 255 characters."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # Any change to assessed content or its intended age range
        # invalidates previous results and eligibility.
        reassess = any(
            field in updated
            for field in ("text", "age_min", "age_max", "content_type")
        )

        for field, value in updated.items():
            if field == "text":
                if not isinstance(value, str) or not value.strip():
                    return Response(
                        {"error": "Content text must not be empty."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                if len(value) > 100_000:
                    return Response(
                        {"error": "Content exceeds the maximum text length."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                value = value.strip()

            setattr(content, field, value)

        content.age_min = new_age_min
        content.age_max = new_age_max

        if reassess:
            content.safety_label = Content.SafetyStatus.PENDING
            content.safety_confidence = None
            content.safety_assessment = {}
            content.developmental_scores = {}
            content.suitability_label = ""
            content.suitability_probabilities = {}
            content.assessment_status = (
                Content.AssessmentStatus.PENDING
            )
            content.recommendation_eligible = False

        content.save()

        return Response(
            {
                "message": (
                    "Content updated. Reassessment is required."
                    if reassess
                    else "Content updated successfully."
                ),
                "content": serialize_content(content),
            },
            status=status.HTTP_200_OK,
        )

    def delete(self, request, content_id):
        content = self.get_object(content_id)
        if (
            user_role(request.user) != UserRole.Role.ADMIN
            and content.created_by_id != request.user.pk
        ):
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        content.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)


class ContentAssessmentView(APIView):
    """Re-run safety and developmental assessment for a stored record."""

    permission_classes = [ContentProviderAccess]

    def post(self, request, content_id):
        content = get_object_or_404(Content, pk=content_id)
        if (
            user_role(request.user) != UserRole.Role.ADMIN
            and content.created_by_id != request.user.pk
        ):
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        if content.content_type in {
            Content.ContentType.VIDEO,
            Content.ContentType.AUDIO,
        }:
            from .tasks import assess_media_content

            content.safety_label = Content.SafetyStatus.PENDING
            content.assessment_status = Content.AssessmentStatus.PENDING
            content.processing_status = Content.ProcessingStatus.PENDING
            content.developmental_scores = {}
            content.suitability_label = ""
            content.suitability_probabilities = {}
            content.recommendation_eligible = False
            content.save()
            try:
                assess_media_content.delay(content.pk)
            except Exception:
                logger.exception(
                    'Could not enqueue media reassessment %s', content.pk
                )
                content.processing_status = Content.ProcessingStatus.FAILED
                content.assessment_status = Content.AssessmentStatus.FAILED
                content.safety_label = Content.SafetyStatus.INCONCLUSIVE
                content.safety_assessment = {
                    'error': 'Media reassessment could not be queued.'
                }
                content.save()
                return Response(
                    {'error': 'Media could not be queued for reassessment.'},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )
            return Response(
                {
                    'message': 'Media reassessment queued.',
                    'content': serialize_content(content),
                },
                status=status.HTTP_202_ACCEPTED,
            )

        content.safety_label = Content.SafetyStatus.PENDING
        content.safety_confidence = None
        content.safety_assessment = {}
        content.developmental_scores = {}
        content.suitability_label = ""
        content.suitability_probabilities = {}
        content.assessment_status = Content.AssessmentStatus.PENDING
        content.processing_status = Content.ProcessingStatus.PENDING
        content.recommendation_eligible = False
        content.save()

        from .tasks import assess_text_content

        try:
            assess_text_content.delay(content.pk)
        except Exception:
            logger.exception('Could not enqueue text reassessment %s', content.pk)
            content.processing_status = Content.ProcessingStatus.FAILED
            content.assessment_status = Content.AssessmentStatus.FAILED
            content.safety_label = Content.SafetyStatus.INCONCLUSIVE
            content.safety_assessment = {
                'error': 'Text reassessment could not be queued.'
            }
            content.save()
            return Response(
                {'error': 'Text could not be queued for reassessment.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response(
            {
                "message": "Text reassessment queued.",
                "content": serialize_content(content),
            },
            status=status.HTTP_202_ACCEPTED,
        )


class ContentFlagView(APIView):
    """Allow any authenticated user to flag an item for admin review."""
    permission_classes = [ApplicationUserAccess]

    def post(self, request, content_id):
        reason = request.data.get("reason", "")
        if not isinstance(reason, str) or len(reason) > 1000:
            return Response(
                {"error": "reason must be text of at most 1000 characters."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            content = get_object_or_404(
                Content.objects.select_for_update(), pk=content_id
            )
            flag, created = ContentFlag.objects.get_or_create(
                content=content,
                reporter=request.user,
                defaults={"reason": reason.strip()},
            )
            if (
                not created
                and flag.resolution != ContentFlag.Resolution.PENDING
                and content.moderation_status != Content.ModerationStatus.REJECTED
            ):
                flag.reason = reason.strip()
                flag.resolution = ContentFlag.Resolution.PENDING
                flag.resolved_by = None
                flag.resolved_at = None
                flag.save(update_fields=[
                    "reason", "resolution", "resolved_by", "resolved_at"
                ])
                created = True
            if created and content.moderation_status != Content.ModerationStatus.REJECTED:
                content.moderation_status = Content.ModerationStatus.FLAGGED
                content.recommendation_eligible = False
                content.save(update_fields=[
                    "moderation_status", "recommendation_eligible", "updated_at"
                ])
                if content.created_by_id:
                    UserNotification.objects.create(
                        recipient=content.created_by,
                        content=content,
                        title="Content flagged for review",
                        message=(
                            f'“{content.title}” was flagged and hidden from parent '
                            "activities and recommendations while an admin reviews it."
                        ),
                    )

        return Response(
            {
                "message": (
                    "Content flagged for review. It is hidden from activities and recommendations."
                    if created else "You have already flagged this content."
                ),
                "moderation_status": content.moderation_status,
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class ContentModerationView(APIView):
    """Admin decision for flagged content: clear it or reject it."""
    permission_classes = [AdminOnly]

    def post(self, request, content_id):
        action = request.data.get("action")
        note = request.data.get("note", "")
        if action not in {"clear", "reject"}:
            return Response(
                {"error": "action must be 'clear' or 'reject'."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not isinstance(note, str) or len(note) > 1000:
            return Response(
                {"error": "note must be text of at most 1000 characters."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            content = get_object_or_404(
                Content.objects.select_for_update(), pk=content_id
            )
            now = timezone.now()
            resolution = (
                ContentFlag.Resolution.CLEARED
                if action == "clear"
                else ContentFlag.Resolution.REJECTED
            )
            ContentFlag.objects.filter(
                content=content,
                resolution=ContentFlag.Resolution.PENDING,
            ).update(
                resolution=resolution,
                resolved_by=request.user,
                resolved_at=now,
            )
            content.moderation_status = (
                Content.ModerationStatus.CLEAR
                if action == "clear"
                else Content.ModerationStatus.REJECTED
            )
            content.recommendation_eligible = (
                action == "clear"
                and content.safety_label == Content.SafetyStatus.SAFE
                and content.assessment_status == Content.AssessmentStatus.COMPLETED
                and content.suitability_label in {
                    Content.SuitabilityStatus.SUITABLE,
                    Content.SuitabilityStatus.PARTIALLY_SUITABLE,
                }
                and bool(content.developmental_scores)
            )
            content.save(update_fields=[
                "moderation_status", "recommendation_eligible", "updated_at"
            ])
            if content.created_by_id:
                outcome = "cleared and restored" if action == "clear" else "rejected"
                detail = f" Admin note: {note.strip()}" if note.strip() else ""
                UserNotification.objects.create(
                    recipient=content.created_by,
                    content=content,
                    title="Content moderation update",
                    message=f'“{content.title}” was {outcome}.{detail}',
                )

        return Response(
            {
                "message": "Content rejected." if action == "reject" else "Content cleared.",
                "content": serialize_content(content, include_flag_details=True),
            },
            status=status.HTTP_200_OK,
        )


class UserNotificationView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response([
            {
                "id": item.pk,
                "title": item.title,
                "message": item.message,
                "content_id": item.content_id,
                "created_at": item.created_at.isoformat(),
                "read": item.read_at is not None,
            }
            for item in request.user.neuroguide_notifications.all()
        ])

    def post(self, request, notification_id):
        notification = get_object_or_404(
            UserNotification,
            pk=notification_id,
            recipient=request.user,
        )
        if notification.read_at is None:
            notification.read_at = timezone.now()
            notification.save(update_fields=["read_at"])
        return Response({"id": notification.pk, "read": True})

class ContentRecommendationView(APIView):

    permission_classes = [CaregiverAccess]


    def post(self, request):
        """
        Recommend resources using the authenticated caregiver's saved child.
        """
        data = request.data
        if not isinstance(data, dict):
            return Response(
                {"error": "Request body must be a JSON object."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        child_id = data.get("child_id")
        if isinstance(child_id, bool):
            child_id = None
        try:
            child_id = int(child_id)
        except (TypeError, ValueError, OverflowError):
            return Response(
                {"error": "Provide a valid child_id."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        children = ChildProfile.objects.all()
        if user_role(request.user) != UserRole.Role.ADMIN:
            children = children.filter(caregiver=request.user)
        child = get_object_or_404(children, pk=child_id)
        learning_goals = child.learning_goals
        if not isinstance(learning_goals, list) or not learning_goals:
            return Response(
                {
                    "error": (
                        "Add at least one learning goal to this child profile "
                        "before requesting recommendations."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        top_n = data.get("top_n", 5)

        try:
            recommendations = recommend_content(
                age=child.age_months,
                learning_goals=learning_goals,
                top_n=top_n,
            )
        except ValueError as exc:
            return Response(
                {"error": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception:
            logger.exception("Failed to generate content recommendations.")
            return Response(
                {"error": "Recommendation generation failed."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        history = RecommendationHistory.objects.create(
            caregiver=request.user,
            child=child,
            child_id_snapshot=child.pk,
            child_name_snapshot=child.display_name,
            age_months=child.age_months,
            learning_goals=learning_goals,
            recommendations=recommendations,
        )

        return Response(
            {
                "count": len(recommendations),
                "history_id": history.pk,
                "child": {
                    "id": child.pk,
                    "display_name": child.display_name,
                    "age_months": child.age_months,
                },
                "recommendations": recommendations,
            },
            status=status.HTTP_200_OK,
        )


def serialize_recommendation_history(history):
    stored_recommendations = (
        history.recommendations
        if isinstance(history.recommendations, list)
        else []
    )
    recommendation_ids = [
        item.get("id")
        for item in stored_recommendations
        if isinstance(item, dict)
        and isinstance(item.get("id"), int)
        and not isinstance(item.get("id"), bool)
    ]
    currently_eligible_ids = set(
        Content.objects.filter(
            pk__in=recommendation_ids,
            safety_label=Content.SafetyStatus.SAFE,
            moderation_status=Content.ModerationStatus.CLEAR,
            assessment_status=Content.AssessmentStatus.COMPLETED,
            suitability_label__in=[
                Content.SuitabilityStatus.SUITABLE,
                Content.SuitabilityStatus.PARTIALLY_SUITABLE,
            ],
            recommendation_eligible=True,
        ).values_list("pk", flat=True)
    )
    safe_recommendations = [
        item
        for item in stored_recommendations
        if isinstance(item, dict) and item.get("id") in currently_eligible_ids
    ]

    return {
        "id": history.pk,
        "child": {
            "id": history.child_id_snapshot,
            "display_name": history.child_name_snapshot,
            "profile_deleted": history.child_id is None,
        },
        "age_months": history.age_months,
        "learning_goals": history.learning_goals,
        "recommendations": safe_recommendations,
        "feedback": {
            "rating": history.feedback_rating,
            "text": history.feedback_text,
        },
        "activities": [
            {
                "id": activity.pk,
                "content_id": activity.content_id_snapshot,
                "event_type": activity.event_type,
                "details": activity.details,
                "created_at": activity.created_at.isoformat(),
            }
            for activity in history.activities.all()
        ],
        "created_at": history.created_at.isoformat(),
    }


class RecommendationHistoryView(APIView):
    permission_classes = [CaregiverAccess]

    def get(self, request):
        histories = RecommendationHistory.objects.all()
        if user_role(request.user) != UserRole.Role.ADMIN:
            histories = histories.filter(caregiver=request.user)
        queryset = histories.select_related("child").prefetch_related("activities")

        child_id = request.query_params.get("child_id")
        if child_id:
            try:
                child_id = int(child_id)
            except (TypeError, ValueError, OverflowError):
                return Response(
                    {"error": "child_id must be an integer."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            children = ChildProfile.objects.all()
            if user_role(request.user) != UserRole.Role.ADMIN:
                children = children.filter(caregiver=request.user)
            if not children.filter(pk=child_id).exists():
                return Response(
                    {"error": "Child profile not found."},
                    status=status.HTTP_404_NOT_FOUND,
                )

            queryset = queryset.filter(child_id_snapshot=child_id)

        return Response(
            [serialize_recommendation_history(item) for item in queryset],
            status=status.HTTP_200_OK,
        )


class RecommendationFeedbackView(APIView):
    permission_classes = [CaregiverAccess]

    def post(self, request, history_id):
        histories = RecommendationHistory.objects.all()
        if user_role(request.user) != UserRole.Role.ADMIN:
            histories = histories.filter(caregiver=request.user)
        history = get_object_or_404(histories, pk=history_id)
        data = request.data
        if not isinstance(data, dict):
            return Response(
                {"error": "Request body must be a JSON object."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        raw_rating = data.get("rating")
        if isinstance(raw_rating, bool):
            raw_rating = None
        if isinstance(raw_rating, float) and not raw_rating.is_integer():
            raw_rating = None
        try:
            rating = int(raw_rating)
        except (TypeError, ValueError, OverflowError):
            return Response(
                {"error": "rating must be an integer from 1 to 5."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not 1 <= rating <= 5:
            return Response(
                {"error": "rating must be an integer from 1 to 5."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        feedback_text = data.get("text", "")
        if not isinstance(feedback_text, str) or len(feedback_text) > 1000:
            return Response(
                {"error": "text must be a string of at most 1000 characters."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        history.feedback_rating = rating
        history.feedback_text = feedback_text.strip()
        history.save(update_fields=["feedback_rating", "feedback_text"])
        return Response(
            serialize_recommendation_history(history),
            status=status.HTTP_200_OK,
        )


class RecommendationActivityView(APIView):
    permission_classes = [CaregiverAccess]

    def post(self, request, history_id):
        histories = RecommendationHistory.objects.all()
        if user_role(request.user) != UserRole.Role.ADMIN:
            histories = histories.filter(caregiver=request.user)
        history = get_object_or_404(histories, pk=history_id)
        data = request.data
        if not isinstance(data, dict):
            return Response(
                {"error": "Request body must be a JSON object."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        event_type = data.get("event_type")
        if event_type not in RecommendationActivity.EventType.values:
            return Response(
                {
                    "error": "event_type must be viewed, clicked, saved, completed, or dismissed."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        raw_content_id = data.get("content_id")
        if isinstance(raw_content_id, bool):
            raw_content_id = None
        try:
            content_id = int(raw_content_id)
        except (TypeError, ValueError, OverflowError):
            return Response(
                {"error": "Provide a valid content_id."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        recommended_ids = {
            item.get("id")
            for item in history.recommendations
            if isinstance(item, dict)
        }
        if content_id not in recommended_ids:
            return Response(
                {"error": "That content was not in this recommendation result."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        details = data.get("details", {})
        if not isinstance(details, dict):
            return Response(
                {"error": "details must be a JSON object."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        content = Content.objects.filter(pk=content_id).first()
        if (
            content is None
            or content.safety_label != Content.SafetyStatus.SAFE
            or content.moderation_status != Content.ModerationStatus.CLEAR
        ):
            return Response(
                {"error": "Activities must pass safety review before they can be opened."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        activity = RecommendationActivity.objects.create(
            history=history,
            content=content,
            content_id_snapshot=content_id,
            event_type=event_type,
            details=details,
        )
        return Response(
            {
                "id": activity.pk,
                "history_id": history.pk,
                "content_id": activity.content_id_snapshot,
                "event_type": activity.event_type,
                "details": activity.details,
                "created_at": activity.created_at.isoformat(),
            },
            status=status.HTTP_201_CREATED,
        )




