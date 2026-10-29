"use client";

import { useEffect, useState } from "react";
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
  text: "",
  content_type: "text",
  age_min: "36",
  age_max: "60",
};

const inputClasses =
  "w-full rounded-md border border-[#b6ccd1] bg-white px-3 py-2.5 text-sm text-[#183940] outline-none focus:border-[#287a71] focus:ring-2 focus:ring-[#287a71]/20";

function formatAgeRange(minimum, maximum) {
  return `${minimum}–${maximum} months`;
}

function StatusBadge({ children, positive = false }) {
  return (
    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold capitalize ${positive ? "border-[#a7d8c3] bg-[#e7f5ee] text-[#176b4d]" : "border-[#c9dadd] bg-[#edf4f5] text-[#536c73]"}`}>
      {children}
    </span>
  );
}

export default function ContentManagement() {
  const router = useRouter();
  const [contents, setContents] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadContents() {
    const records = await apiFetch("content/");
    setContents(records);
  }

  useEffect(() => {
    let active = true;
    if (!hasAccessToken()) {
      router.replace("/login?next=/content-management");
      return () => {
        active = false;
      };
    }

    apiFetch("content/")
      .then((records) => {
        if (active) setContents(records);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    const hasQueuedMedia = contents.some((item) =>
      ["audio", "video"].includes(item.content_type) &&
      ["pending", "processing"].includes(item.processing_status),
    );
    if (!hasQueuedMedia) return undefined;

    const intervalId = window.setInterval(() => {
      apiFetch("content/").then(setContents).catch(() => {});
    }, 4000);
    return () => window.clearInterval(intervalId);
  }, [contents]);

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setSelectedFile(null);
    setError("");
    setNotice("");
  }

  function editContent(content) {
    setEditingId(content.id);
    setForm({
      title: content.title,
      text: content.text,
      content_type: content.content_type || "text",
      age_min: String(content.age_min),
      age_max: String(content.age_max),
    });
    setSelectedFile(null);
    setError("");
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSave(event) {
    event.preventDefault();
    setError("");
    setNotice("");

    const ageMin = Number(form.age_min);
    const ageMax = Number(form.age_max);
    if (!form.title.trim()) {
      setError("Enter a title for this learning resource.");
      return;
    }
    if (!Number.isInteger(ageMin) || !Number.isInteger(ageMax) || ageMin < 0 || ageMax > 83 || ageMin > ageMax) {
      setError("Age range must be between 0 and 83 months, with the minimum no greater than the maximum.");
      return;
    }
    if (!editingId && form.content_type === "text" && !selectedFile && !form.text.trim()) {
      setError("Enter the learning content or choose a .txt file.");
      return;
    }
    if (!editingId && form.content_type !== "text" && !selectedFile) {
      setError(`Choose a ${form.content_type} file to upload.`);
      return;
    }

    setIsSaving(true);
    const payload = {
      title: form.title.trim(),
      text: form.text,
      content_type: form.content_type.trim() || "text",
      age_min: ageMin,
      age_max: ageMax,
    };

    try {
      if (editingId) {
        const response = await apiFetch(`content/${editingId}/`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setContents((current) => current.map((item) => item.id === editingId ? response.content : item));
        setNotice(response.message);
      } else {
        let body = JSON.stringify(payload);
        if (selectedFile) {
          const formData = new FormData();
          formData.append("title", payload.title);
          formData.append("content_type", payload.content_type);
          formData.append("age_min", String(payload.age_min));
          formData.append("age_max", String(payload.age_max));
          formData.append(payload.content_type === "text" ? "file" : "media_file", selectedFile);
          body = formData;
        }
        const response = await apiFetch("content/", {
          method: "POST",
          body,
        });
        setContents((current) => [response.content, ...current]);
        setNotice(response.message);
      }
      setForm(emptyForm);
      setEditingId(null);
      setSelectedFile(null);
    } catch (saveError) {
      setError(saveError.message);
      if (!editingId) {
        try {
          await loadContents();
        } catch {
          // Keep the original submission error visible if the list refresh fails.
        }
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function reassessContent(contentId) {
    setError("");
    setNotice("");
    setBusyId(contentId);
    try {
      const response = await apiFetch(`content/${contentId}/assess/`, {
        method: "POST",
      });
      setContents((current) => current.map((item) => item.id === contentId ? response.content : item));
      setNotice(response.message);
    } catch (assessError) {
      setError(assessError.message);
      try {
        await loadContents();
      } catch {
        // Keep the assessment error visible if refreshing the list also fails.
      }
    } finally {
      setBusyId(null);
    }
  }

  async function deleteContent(content) {
    if (!window.confirm(`Delete “${content.title}”? This cannot be undone.`)) return;
    setError("");
    setNotice("");
    setBusyId(content.id);
    try {
      await apiFetch(`content/${content.id}/`, { method: "DELETE" });
      setContents((current) => current.filter((item) => item.id !== content.id));
      if (editingId === content.id) resetForm();
      setNotice("Content deleted.");
    } catch (deleteError) {
      setError(deleteError.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#f3f8f9] text-[#183940]">
      <Navbar />
      <div className="flex flex-1 flex-col sm:flex-row">
        <Sidebar items={navigationItems} activeItem="Content Library" />

        <main className="min-w-0 flex-1">
          <div className="relative flex min-h-12 items-center justify-center border-b border-[#c9dadd] bg-white px-16">
            <Link href="/" className="absolute left-4 text-xs font-medium uppercase tracking-wide text-[#36535b] no-underline hover:text-black">‹ &nbsp; Back</Link>
            <h1 className="text-center text-xs font-bold uppercase tracking-[0.14em]">Content Library</h1>
          </div>

          <div className="mx-auto w-full max-w-6xl space-y-7 px-4 pb-12 pt-6 sm:px-8">
            <section className="rounded-xl border border-[#c9dadd] bg-white p-5 sm:p-7">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-[#d9e9e8] pb-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#647d83]">Learning resources</p>
                  <h2 className="mt-1 text-xl font-bold">{editingId ? "Edit content" : "Add content"}</h2>
                  <p className="mt-1 text-xs leading-5 text-[#647d83]">Text is assessed for safety and developmental areas. Safe audio and video are offered as general age-appropriate activities without developmental labels.</p>
                </div>
                {editingId ? <button type="button" onClick={resetForm} className="rounded-md border border-[#b6ccd1] px-3 py-2 text-xs text-[#36535b] hover:bg-[#eef5f5]">Cancel edit</button> : null}
              </div>

              <form onSubmit={handleSave} className="grid gap-4 md:grid-cols-2">
                <label className="block text-xs font-semibold text-[#36535b]">
                  Title
                  <input required maxLength={255} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} className={`${inputClasses} mt-1.5 font-normal`} />
                </label>
                <label className="block text-xs font-semibold text-[#36535b]">
                  Content type
                  <select value={form.content_type} disabled={Boolean(editingId)} onChange={(event) => { setSelectedFile(null); setForm((current) => ({ ...current, content_type: event.target.value })); }} className={`${inputClasses} mt-1.5 font-normal disabled:bg-[#edf4f5]`}>
                    <option value="text">Text resource</option>
                    <option value="audio">Audio</option>
                    <option value="video">Video</option>
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-xs font-semibold text-[#36535b]">
                    Minimum age (months)
                    <input required type="number" min="0" max="83" value={form.age_min} onChange={(event) => setForm((current) => ({ ...current, age_min: event.target.value }))} className={`${inputClasses} mt-1.5 font-normal`} />
                  </label>
                  <label className="block text-xs font-semibold text-[#36535b]">
                    Maximum age (months)
                    <input required type="number" min="0" max="83" value={form.age_max} onChange={(event) => setForm((current) => ({ ...current, age_max: event.target.value }))} className={`${inputClasses} mt-1.5 font-normal`} />
                  </label>
                </div>
                {!editingId ? (
                  <label className="block text-xs font-semibold text-[#36535b]">
                    {form.content_type === "text" ? "Import a text file (optional)" : `Choose ${form.content_type} file`}
                    <input required={form.content_type !== "text"} type="file" accept={form.content_type === "text" ? ".txt,text/plain" : form.content_type === "video" ? "video/*,.mp4,.mov,.mkv,.webm,.avi,.mpeg,.mpg" : "audio/*,.mp3,.wav,.m4a,.ogg,.flac,.webm,.mpeg,.mpga"} onChange={(event) => setSelectedFile(event.target.files?.[0] || null)} className="mt-1.5 block w-full text-xs file:mr-3 file:rounded-md file:border file:border-[#b6ccd1] file:bg-[#edf4f5] file:px-3 file:py-2 file:text-xs" />
                    <span className="mt-1 block font-normal text-[#647d83]">{form.content_type === "text" ? "UTF-8 .txt file, up to 2 MB." : "Media is checked for safety, then appears as a general activity without developmental labels."}</span>
                  </label>
                ) : null}
                {form.content_type === "text" ? (
                  <label className="block text-xs font-semibold text-[#36535b] md:col-span-2">
                    Learning content
                    <textarea required={!selectedFile} maxLength={100000} rows={7} value={form.text} onChange={(event) => setForm((current) => ({ ...current, text: event.target.value }))} className={`${inputClasses} mt-1.5 resize-y font-normal leading-6`} placeholder="Paste the activity, story, or learning instructions here…" />
                    <span className="mt-1 block font-normal text-[#647d83]">Maximum 100,000 characters. Editing the text or age range resets its assessment.</span>
                  </label>
                ) : null}

                {error ? <p role="alert" className="text-sm text-red-700 md:col-span-2">{error}</p> : null}
                {notice ? <p role="status" className="text-sm text-[#176b4d] md:col-span-2">{notice}</p> : null}
                <div className="flex flex-wrap gap-2 md:col-span-2">
                  <button type="submit" disabled={isSaving} className="min-h-10 rounded-md border border-[#176b5b] bg-[#176b5b] px-5 text-xs font-bold uppercase tracking-wide text-white hover:bg-[#115648] disabled:cursor-wait disabled:opacity-60">
                    {isSaving ? (editingId ? "Saving…" : "Uploading…") : (editingId ? "Save changes" : "Submit content")}
                  </button>
                  <span className="self-center text-[10px] text-[#647d83]">Age values use months, from 0 to 83.</span>
                </div>
              </form>
            </section>

            <section aria-labelledby="content-list-title">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#647d83]">Stored resources</p>
                  <h2 id="content-list-title" className="mt-1 text-xl font-bold">Manage content</h2>
                </div>
                <span className="text-xs text-[#647d83]">{contents.length} {contents.length === 1 ? "item" : "items"}</span>
              </div>

              {isLoading ? (
                <p className="rounded-lg border border-[#c9dadd] bg-white p-6 text-center text-sm text-[#536c73]">Loading content…</p>
              ) : contents.length === 0 ? (
                <div className="rounded-xl border border-[#c9dadd] bg-white p-8 text-center">
                  <p className="text-sm text-[#445f67]">No content has been added yet.</p>
                  <p className="mt-2 text-xs text-[#647d83]">Use the form above to submit a learning resource.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {contents.map((content) => (
                    <article key={content.id} className="rounded-xl border border-[#c9dadd] bg-white p-4 sm:p-5">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-bold">{content.title}</h3>
                            <StatusBadge positive={content.recommendation_eligible}>{content.recommendation_eligible ? "Eligible" : "Not eligible"}</StatusBadge>
                          </div>
                          <p className="mt-1 text-xs text-[#647d83]">{content.content_type} · Ages {formatAgeRange(content.age_min, content.age_max)}</p>
                          <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-[#445f67]">
                            {content.text || content.transcript || (content.media_file ? "Uploaded media. Open Media Testing to review its transcription and safety results." : "")}
                          </p>
                          {content.media_file ? (
                            <Link href={`/activity?contentId=${encodeURIComponent(content.id)}`} className="mt-2 inline-flex text-xs font-semibold text-[#176b5b] underline underline-offset-4 hover:text-[#115648]">
                              View {content.content_type}
                            </Link>
                          ) : null}
                          <div className="mt-3 flex flex-wrap gap-2">
                            <StatusBadge positive={content.safety_label === "safe"}>Safety: {content.safety_label}</StatusBadge>
                            <StatusBadge positive={content.assessment_status === "completed"}>Assessment: {content.assessment_status}</StatusBadge>
                          </div>
                          {content.content_type === "text" && content.recommendation_eligible && content.developmental_scores ? (
                            <p className="mt-3 text-xs text-[#647d83]">
                              Developmental areas: {Object.keys(content.developmental_scores).join(", ") || "None returned"}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
                          {content.content_type === "text" ? (
                            <button type="button" onClick={() => editContent(content)} className="rounded-md border border-[#b6ccd1] bg-white px-3 py-2 text-xs font-semibold text-[#36535b] hover:bg-[#eef5f5]">Edit</button>
                          ) : null}
                          <button type="button" onClick={() => reassessContent(content.id)} disabled={busyId === content.id} className="rounded-md border border-[#b6ccd1] bg-white px-3 py-2 text-xs font-semibold text-[#36535b] hover:bg-[#eef5f5] disabled:opacity-60">{busyId === content.id ? "Working…" : "Reassess"}</button>
                          <button type="button" onClick={() => deleteContent(content)} disabled={busyId === content.id} className="rounded-md border border-[#c7aaaa] bg-white px-3 py-2 text-xs font-semibold text-[#854747] hover:bg-[#fff7f7] disabled:opacity-60">Delete</button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
