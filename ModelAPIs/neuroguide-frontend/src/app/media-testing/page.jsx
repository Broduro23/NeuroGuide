"use client";

import RoleGate from "../../components/RoleGate";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "../../components/navbar";
import Sidebar from "../../components/Sidebar";
import { apiFetch, hasAccessToken } from "../../lib/api";

const navigationItems = [
  { label: "Home", href: "/" },
  { label: "Recommendations", href: "/recommendations" },
  { label: "Content Library", href: "/content-management" },
  { label: "Media Testing", href: "/media-testing" },
  { label: "Activity", href: "/activity" },
  { label: "Progress", href: "/progress" },
  { label: "Profile", href: "/profile" },
  { label: "Settings", href: "/settings" },
];

const emptyForm = {
  title: "",
  content_type: "video",
  age_min: "36",
  age_max: "60",
};

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-[#b6ccd1] bg-white px-3.5 py-3 text-sm text-[#183940] outline-none transition placeholder:text-[#80969b] focus:border-[#287a71] focus:ring-4 focus:ring-[#287a71]/10";

function formatDuration(seconds) {
  if (seconds == null) return "Duration pending";
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes ? `${minutes}m ${remainder}s` : `${remainder}s`;
}

function StatusPill({ children, tone = "neutral" }) {
  const tones = {
    good: "border-emerald-200 bg-emerald-50 text-emerald-800",
    bad: "border-rose-200 bg-rose-50 text-rose-800",
    working: "border-sky-200 bg-sky-50 text-sky-800",
    neutral: "border-[#c9dadd] bg-[#edf4f5] text-[#536c73]",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold capitalize ${tones[tone]}`}>
      {children}
    </span>
  );
}

function toneForSafety(label) {
  if (label === "safe") return "good";
  if (["unsafe", "inconclusive", "failed"].includes(label)) return "bad";
  if (["pending", "processing", "transcribed"].includes(label)) return "working";
  return "neutral";
}

function toneForProcessing(status) {
  if (status === "completed") return "good";
  if (status === "failed") return "bad";
  if (status === "processing" || status === "pending") return "working";
  return "neutral";
}

function AssessmentPanel({ content }) {
  const visual = content.visual_assessment || {};
  const audio = content.audio_assessment || {};
  const flaggedFrames = (visual.frames || []).filter((frame) => frame.unsafe);

  return (
    <div className="mt-5 grid gap-4 lg:grid-cols-2">
      <section className="rounded-2xl border border-[#c9dadd] bg-[#f6fafb] p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold text-[#183940]">Video frame check</h3>
          <StatusPill tone={toneForSafety(visual.status)}>{visual.status || "waiting"}</StatusPill>
        </div>
        <p className="mt-2 text-sm leading-6 text-[#536c73]">
          {content.content_type === "audio"
            ? "Video frame screening does not apply to this audio-only upload."
            : visual.frames_checked != null
              ? `${visual.frames_checked} frames checked with ${visual.model || "the configured image model"}.`
              : "Frame results will appear here when processing finishes."}
        </p>
        {flaggedFrames.length > 0 ? (
          <ul className="mt-3 space-y-2 text-sm text-rose-800">
            {flaggedFrames.map((frame) => (
              <li key={frame.frame} className="rounded-lg bg-rose-50 px-3 py-2">
                {frame.frame}: NSFW score {Number(frame.nsfw_score).toFixed(3)}
              </li>
            ))}
          </ul>
        ) : null}
        {(visual.frames || []).length > 0 ? (
          <details className="mt-3 rounded-lg border border-[#c9dadd] bg-white px-3 py-2">
            <summary className="cursor-pointer text-xs font-semibold text-[#176b5b]">Inspect sampled frame scores</summary>
            <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto text-xs text-[#536c73]">
              {visual.frames.map((frame) => (
                <li key={frame.frame} className="border-t border-[#e0ebed] pt-2">
                  <span className="font-semibold">{frame.frame}</span>
                  <span className="ml-2">NSFW {Number(frame.nsfw_score).toFixed(3)}</span>
                  <span className="mt-1 block">{(frame.label_scores || []).map((entry, index) => `${entry.label} ${Number(entry.score).toFixed(3)}${index < frame.label_scores.length - 1 ? " · " : ""}`)}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
        {visual.error ? <p className="mt-3 text-sm text-rose-700">{visual.error}</p> : null}
      </section>

      <section className="rounded-2xl border border-[#c9dadd] bg-[#f6fafb] p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold text-[#183940]">Audio and transcript check</h3>
          <StatusPill tone={toneForSafety(audio.transcript_safety?.label)}>
            {audio.transcript_safety?.label || audio.status || "waiting"}
          </StatusPill>
        </div>
        <p className="mt-2 text-sm leading-6 text-[#536c73]">
          {content.content_type === "video" && audio.status === "not_applicable"
            ? "No audio stream was present in this video."
            : audio.transcript_safety
            ? `Transcript classified ${audio.transcript_safety.label} (${Number(audio.transcript_safety.confidence).toFixed(3)} confidence).`
            : audio.status === "no_speech_detected"
              ? "No speech was detected in the audio."
              : "Whisper transcription and transcript safety results will appear here."}
        </p>
        {audio.error ? <p className="mt-3 text-sm text-rose-700">{audio.error}</p> : null}
      </section>

      <section className="rounded-2xl border border-[#c9dadd] bg-white p-4 sm:p-5 lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold text-[#183940]">Transcript developmental assessment</h3>
          <StatusPill tone={content.suitability_label === "Suitable" ? "good" : "neutral"}>
            {content.suitability_label || "Not assessed"}
          </StatusPill>
        </div>
        {Object.keys(content.developmental_scores || {}).length > 0 ? (
          <details className="mt-3 rounded-lg border border-[#c9dadd] bg-[#f6fafb] px-3 py-2">
            <summary className="cursor-pointer text-xs font-semibold text-[#176b5b]">
              View transcript domain probabilities
            </summary>
            <ul className="mt-3 grid gap-2 text-xs text-[#536c73] sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(content.developmental_scores)
                .sort((left, right) => Number(right[1]) - Number(left[1]))
                .map(([domain, score]) => (
                  <li key={domain} className="flex justify-between gap-3 border-b border-[#e0ebed] pb-1">
                    <span>{domain.replaceAll("_", " ")}</span>
                    <strong>{Math.round(Number(score) * 100)}%</strong>
                  </li>
                ))}
            </ul>
          </details>
        ) : (
          <p className="mt-2 text-sm leading-6 text-[#536c73]">
            A safe, non-empty transcript is required to calculate developmental probabilities and suitability.
          </p>
        )}
      </section>

      {content.transcript ? (
        <section className="rounded-2xl border border-[#c9dadd] bg-white p-4 sm:p-5 lg:col-span-2">
          <h3 className="font-semibold text-[#183940]">Transcribed speech</h3>
          <p className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-[#36535b]">
            {content.transcript}
          </p>
        </section>
      ) : null}

      {content.safety_assessment?.error ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 lg:col-span-2">
          Processing note: {content.safety_assessment.error}
        </p>
      ) : null}
    </div>
  );
}

function MediaTestingPageContent() {
  const router = useRouter();
  const [contents, setContents] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const fileInputRef = useRef(null);

  const loadContents = useCallback(async () => {
    const records = await apiFetch("content/");
    setContents(records);
    return records;
  }, []);

  useEffect(() => {
    if (!hasAccessToken()) {
      router.replace("/login?next=/media-testing");
      return;
    }
    loadContents()
      .catch((loadError) => setError(loadError.message))
      .finally(() => setIsLoading(false));
  }, [loadContents, router]);

  const hasPendingJobs = useMemo(
    () => contents.some((item) =>
      ["audio", "video"].includes(item.content_type) &&
      (
        ["pending", "processing"].includes(item.processing_status) ||
        item.assessment_status === "pending"
      )
    ),
    [contents],
  );

  useEffect(() => {
    if (!hasPendingJobs) return undefined;
    const timer = window.setInterval(() => {
      loadContents().catch(() => {});
    }, 3500);
    return () => window.clearInterval(timer);
  }, [hasPendingJobs, loadContents]);

  const mediaItems = useMemo(
    () => contents.filter((item) => ["audio", "video"].includes(item.content_type)),
    [contents],
  );
  const selectedContent = mediaItems.find((item) => item.id === selectedId) || mediaItems[0];

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    if (field === "content_type") setSelectedFile(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setNotice("");

    const minimum = Number(form.age_min);
    const maximum = Number(form.age_max);
    if (!selectedFile) {
      setError(`Choose a ${form.content_type} file to upload.`);
      return;
    }
    if (!Number.isInteger(minimum) || !Number.isInteger(maximum) || minimum < 0 || maximum > 83 || minimum > maximum) {
      setError("Age range must be between 0 and 83 months, with minimum no greater than maximum.");
      return;
    }
    if (selectedFile.size > 100 * 1024 * 1024) {
      setError("The current upload limit is 100 MB.");
      return;
    }

    setIsSubmitting(true);
    const body = new FormData();
    body.append("title", form.title.trim() || selectedFile.name.replace(/\.[^.]+$/, ""));
    body.append("content_type", form.content_type);
    body.append("age_min", String(minimum));
    body.append("age_max", String(maximum));
    body.append("media_file", selectedFile);

    try {
      const response = await apiFetch("content/", { method: "POST", body });
      setContents((current) => [
        response.content,
        ...current.filter((item) => item.id !== response.content.id),
      ]);
      setSelectedId(response.content.id);
      setNotice(response.message || "Upload queued for assessment.");
      setForm(emptyForm);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (submitError) {
      setError(submitError.message);
      loadContents().catch(() => {});
    } finally {
      setIsSubmitting(false);
    }
  }

  async function reassess(content) {
    setError("");
    setNotice("");
    setBusyId(content.id);
    try {
      const response = await apiFetch(`content/${content.id}/assess/`, { method: "POST" });
      setContents((current) => current.map((item) => item.id === content.id ? response.content : item));
      setNotice(response.message || "Assessment queued.");
    } catch (requestError) {
      setError(requestError.message);
      loadContents().catch(() => {});
    } finally {
      setBusyId(null);
    }
  }

  const accepts = form.content_type === "video"
    ? ".mp4,.mov,.mkv,.webm,.avi,.mpeg,.mpg,video/*"
    : ".mp3,.wav,.m4a,.ogg,.flac,.webm,.mpeg,.mpga,audio/*";

  return (
    <div className="flex min-h-screen flex-col bg-[#f3f8f9] text-[#183940]">
      <Navbar />
      <div className="flex flex-1 flex-col sm:flex-row">
        <Sidebar items={navigationItems} activeItem="Media Testing" />
        <main className="min-w-0 flex-1">
          <div className="flex min-h-14 items-center justify-between border-b border-[#c9dadd] bg-white px-5 sm:px-8">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#287a71]">Assessment workspace</p>
              <h1 className="text-lg font-bold tracking-tight sm:text-xl">Audio &amp; video testing</h1>
            </div>
            <button
              type="button"
              onClick={() => loadContents().catch((loadError) => setError(loadError.message))}
              className="rounded-xl border border-[#b6ccd1] bg-white px-3.5 py-2 text-xs font-semibold text-[#36535b] transition hover:bg-[#edf4f5]"
            >
              Refresh results
            </button>
          </div>

          <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-6 sm:px-7 lg:grid-cols-[minmax(320px,0.78fr)_minmax(0,1.22fr)] lg:px-9">
            <section className="h-fit rounded-3xl border border-[#c9dadd] bg-white p-5 shadow-[0_12px_36px_rgba(34,85,91,0.06)] sm:p-7">
              <div className="mb-6">
                <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-800">New assessment</span>
                <h2 className="mt-3 text-2xl font-bold tracking-tight">Upload media</h2>
                <p className="mt-2 text-sm leading-6 text-[#647d83]">
                  Check spoken language and sample video frames before a resource enters recommendations.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <label className="block text-xs font-semibold text-[#36535b]">
                  Resource title <span className="font-normal text-[#80969b]">(optional)</span>
                  <input
                    value={form.title}
                    onChange={(event) => updateForm("title", event.target.value)}
                    maxLength={255}
                    className={fieldClass}
                    placeholder="Uses the uploaded filename if blank"
                  />
                </label>

                <label className="block text-xs font-semibold text-[#36535b]">
                  Media type
                  <select
                    value={form.content_type}
                    onChange={(event) => updateForm("content_type", event.target.value)}
                    className={fieldClass}
                  >
                    <option value="video">Video: frame screening + speech</option>
                    <option value="audio">Audio: transcription + text safety</option>
                  </select>
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-xs font-semibold text-[#36535b]">
                    Minimum age (months)
                    <input type="number" min="0" max="83" required value={form.age_min} onChange={(event) => updateForm("age_min", event.target.value)} className={fieldClass} />
                  </label>
                  <label className="block text-xs font-semibold text-[#36535b]">
                    Maximum age (months)
                    <input type="number" min="0" max="83" required value={form.age_max} onChange={(event) => updateForm("age_max", event.target.value)} className={fieldClass} />
                  </label>
                </div>

                <label className="block text-xs font-semibold text-[#36535b]">
                  Choose {form.content_type} file
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={accepts}
                    required
                    onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                    className="mt-1.5 block w-full cursor-pointer rounded-xl border border-dashed border-[#9dbdc3] bg-[#f6fafb] p-3 text-xs text-[#536c73] file:mr-3 file:rounded-lg file:border-0 file:bg-[#176b5b] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-[#115648]"
                  />
                  <span className="mt-1.5 block font-normal text-[#647d83]">
                    Up to 100 MB and 10 minutes. Supported formats include MP4/MOV/WebM video and MP3/WAV/M4A/OGG audio.
                  </span>
                </label>

                {selectedFile ? (
                  <div className="flex items-center gap-3 rounded-xl border border-[#c9dadd] bg-[#f6fafb] p-3 text-xs text-[#36535b]">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-800" aria-hidden="true">♫</span>
                    <span className="min-w-0 flex-1 truncate font-semibold">{selectedFile.name}</span>
                    <span className="shrink-0 text-[#647d83]">{(selectedFile.size / (1024 * 1024)).toFixed(1)} MB</span>
                  </div>
                ) : null}

                {error ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p> : null}
                {notice ? <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p> : null}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#176b5b] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#115648] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287a71] disabled:cursor-wait disabled:opacity-60"
                >
                  {isSubmitting ? "Uploading…" : "Upload & run checks"}
                </button>
                <p className="text-center text-[11px] leading-5 text-[#80969b]">
                  Processing runs in the background. This page refreshes queued jobs automatically.
                </p>
              </form>
            </section>

            <section className="min-w-0">
              <div className="mb-4 flex items-end justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#287a71]">Recent runs</p>
                  <h2 className="mt-1 text-xl font-bold">Assessment results</h2>
                </div>
                <span className="text-xs text-[#647d83]">{mediaItems.length} media {mediaItems.length === 1 ? "item" : "items"}</span>
              </div>

              {isLoading ? (
                <div className="rounded-2xl border border-[#c9dadd] bg-white p-8 text-center text-sm text-[#647d83]">Loading media assessments…</div>
              ) : mediaItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#9dbdc3] bg-white p-8 text-center sm:p-12">
                  <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-sky-50 text-2xl text-sky-700" aria-hidden="true">◉</div>
                  <h3 className="mt-4 font-semibold">No media assessments yet</h3>
                  <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#647d83]">Upload a short audio or video file to see its transcript, frame checks, and final safety decision here.</p>
                  <Link href="/content-management" className="mt-5 inline-flex rounded-xl border border-[#b6ccd1] px-4 py-2.5 text-xs font-semibold text-[#176b5b] no-underline hover:bg-[#edf4f5]">Open text content library</Link>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {mediaItems.map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => setSelectedId(item.id)}
                        className={`rounded-2xl border p-4 text-left transition ${selectedContent?.id === item.id ? "border-[#287a71] bg-[#eff8f5] shadow-[0_6px_22px_rgba(34,85,91,0.08)]" : "border-[#c9dadd] bg-white hover:border-[#9dbdc3] hover:bg-[#f8fbfc]"}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sm font-bold uppercase text-sky-800">{item.content_type === "video" ? "▶" : "♫"}</span>
                          <StatusPill tone={toneForProcessing(item.processing_status)}>{item.processing_status || "pending"}</StatusPill>
                        </div>
                        <p className="mt-3 truncate text-sm font-bold text-[#183940]">{item.title}</p>
                        <p className="mt-1 truncate text-xs text-[#647d83]">{item.source_filename || item.media_file || item.content_type}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <StatusPill tone={toneForSafety(item.safety_label)}>Safety: {item.safety_label || "pending"}</StatusPill>
                        </div>
                      </button>
                    ))}
                  </div>

                  {selectedContent ? (
                    <article className="rounded-3xl border border-[#c9dadd] bg-white p-5 shadow-[0_12px_36px_rgba(34,85,91,0.06)] sm:p-7">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#287a71]">{selectedContent.content_type} assessment · {formatDuration(selectedContent.media_duration_seconds)}</p>
                          <h3 className="mt-1 break-words text-xl font-bold tracking-tight">{selectedContent.title}</h3>
                          <p className="mt-1 break-all text-xs text-[#80969b]">{selectedContent.source_filename || selectedContent.media_file}</p>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <StatusPill tone={toneForProcessing(selectedContent.processing_status)}>{selectedContent.processing_status || "pending"}</StatusPill>
                          <StatusPill tone={toneForSafety(selectedContent.safety_label)}>Safety: {selectedContent.safety_label}</StatusPill>
                        </div>
                      </div>

                      {selectedContent.processing_status === "pending" || selectedContent.processing_status === "processing" ? (
                        <div className="mt-5 flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
                          <span className="size-2 animate-pulse rounded-full bg-sky-600" aria-hidden="true" />
                          The worker is transcribing speech, checking transcript safety, and scoring developmental domains. Frame results can appear before transcript scoring finishes. Results refresh automatically.
                        </div>
                      ) : null}

                      <AssessmentPanel content={selectedContent} />

                      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#e0ebed] pt-4">
                        <div>
                          <StatusPill tone={selectedContent.recommendation_eligible ? "good" : "neutral"}>
                            {selectedContent.recommendation_eligible ? "Eligible for recommendations" : "Not eligible for recommendations"}
                          </StatusPill>
                          <p className="mt-2 text-[11px] text-[#80969b]">Assessment: {selectedContent.assessment_status || "pending"}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => reassess(selectedContent)}
                          disabled={busyId === selectedContent.id || ["pending", "processing"].includes(selectedContent.processing_status)}
                          className="rounded-xl border border-[#b6ccd1] bg-white px-4 py-2.5 text-xs font-semibold text-[#176b5b] transition hover:bg-[#edf4f5] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {busyId === selectedContent.id ? "Queueing…" : "Run checks again"}
                        </button>
                      </div>
                    </article>
                  ) : null}
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function MediaTestingPage() {
  return <RoleGate><MediaTestingPageContent /></RoleGate>;
}
