"use client";

import Link from "next/link";
import { Check, ChevronLeft, ChevronRight, FileUp, ImagePlus, Loader2, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { PresetPageShell } from "@/components/preset-page-shell";
import type { Preset } from "@/lib/preset-types";

const categories = [
  "Wedding",
  "Portrait",
  "Cinematic",
  "Moody",
  "Film",
  "Outdoor",
  "Indoor",
  "Black & White",
  "Golden Hour",
  "Skin Tone",
  "Editorial",
  "Travel",
];

const steps = ["Upload file", "Add details", "Preview images", "Publish"];

function useObjectUrl(file: File | null) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }

    const nextUrl = URL.createObjectURL(file);
    setUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [file]);

  return url;
}

export function UploadPresetPage() {
  const [step, setStep] = useState(0);
  const [presetFile, setPresetFile] = useState<File | null>(null);
  const [beforeImage, setBeforeImage] = useState<File | null>(null);
  const [afterImage, setAfterImage] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creatorName, setCreatorName] = useState("");
  const [category, setCategory] = useState("Wedding");
  const [tags, setTags] = useState("");
  const [bestFor, setBestFor] = useState("");
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  const [ownershipConfirmed, setOwnershipConfirmed] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState("");
  const [publishedPreset, setPublishedPreset] = useState<Preset | null>(null);
  const beforeUrl = useObjectUrl(beforeImage);
  const afterUrl = useObjectUrl(afterImage);

  const resetForm = () => {
    setStep(0);
    setPresetFile(null);
    setBeforeImage(null);
    setAfterImage(null);
    setName("");
    setDescription("");
    setCreatorName("");
    setCategory("Wedding");
    setTags("");
    setBestFor("");
    setVisibility("private");
    setOwnershipConfirmed(false);
    setError("");
    setPublishedPreset(null);
  };

  const canContinue =
    (step === 0 && Boolean(presetFile)) ||
    (step === 1 && Boolean(name.trim() && category)) ||
    (step === 2 && Boolean(beforeImage && afterImage)) ||
    (step === 3 && ownershipConfirmed);

  const publish = async () => {
    if (!presetFile || !beforeImage || !afterImage || isPublishing) return;
    setIsPublishing(true);
    setError("");

    try {
      const formData = new FormData();
      formData.set("presetFile", presetFile);
      formData.set("beforeImage", beforeImage);
      formData.set("afterImage", afterImage);
      formData.set("name", name);
      formData.set("description", description);
      formData.set("creatorName", creatorName);
      formData.set("category", category);
      formData.set(
        "tags",
        JSON.stringify(tags.split(",").map((tag) => tag.trim()).filter(Boolean)),
      );
      formData.set(
        "bestFor",
        JSON.stringify(bestFor.split(",").map((item) => item.trim()).filter(Boolean)),
      );
      formData.set("visibility", visibility);
      formData.set("ownershipConfirmed", String(ownershipConfirmed));

      const response = await fetch("/api/presets", { method: "POST", body: formData });
      const payload = (await response.json()) as { preset?: Preset; error?: string };
      if (!response.ok || !payload.preset) {
        throw new Error(payload.error || "We couldn't upload this preset.");
      }
      setPublishedPreset(payload.preset);
    } catch (publishError) {
      setError(
        publishError instanceof Error
          ? publishError.message
          : "We couldn't upload this preset. Please check the file and try again.",
      );
    } finally {
      setIsPublishing(false);
    }
  };

  if (publishedPreset) {
    return (
      <PresetPageShell>
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-2xl items-center px-4 py-12">
          <div className="w-full rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-sm sm:p-12">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <Check className="h-7 w-7" />
            </span>
            <h1 className="mt-6 font-serif text-4xl">Your preset is live.</h1>
            <p className="mt-3 text-sm text-zinc-500">
              {publishedPreset.name} is ready to preview, save, and apply.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <Link href={`/presets/${publishedPreset.id}`} className="rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white">
                View Preset
              </Link>
              <button type="button" onClick={resetForm} className="cursor-pointer rounded-2xl border border-zinc-200 px-5 py-3 text-sm font-semibold">
                Upload Another
              </button>
              <Link href="/presets/my" className="rounded-2xl border border-zinc-200 px-5 py-3 text-sm font-semibold">
                Go to My Presets
              </Link>
            </div>
          </div>
        </div>
      </PresetPageShell>
    );
  }

  return (
    <PresetPageShell>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-amber-700">Preset creator</p>
        <h1 className="mt-2 font-serif text-4xl sm:text-5xl">Upload Preset</h1>
        <p className="mt-3 text-sm text-zinc-500">Share your editing style with your team or the marketplace.</p>

        <div className="mt-8 grid grid-cols-4 gap-2">
          {steps.map((label, index) => (
            <div key={label}>
              <div className={`h-1.5 rounded-full ${index <= step ? "bg-zinc-950" : "bg-zinc-200"}`} />
              <p className={`mt-2 hidden text-xs font-semibold sm:block ${index === step ? "text-zinc-950" : "text-zinc-400"}`}>
                {label}
              </p>
            </div>
          ))}
        </div>

        <section className="mt-8 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-8">
          {step === 0 && (
            <div>
              <h2 className="text-xl font-semibold">Upload your preset file</h2>
              <p className="mt-2 text-sm text-zinc-500">Supports .cube LUT files up to 25 MB.</p>
              <label className="mt-6 flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-6 text-center transition hover:bg-zinc-100">
                <FileUp className="h-9 w-9 text-zinc-400" />
                <span className="mt-4 font-semibold">{presetFile?.name || "Drag and drop your preset file here"}</span>
                <span className="mt-2 text-sm text-zinc-500">or choose a .cube file</span>
                <input
                  type="file"
                  accept=".cube,text/plain"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    if (file && !file.name.toLowerCase().endsWith(".cube")) {
                      setError("This file type is not supported. Please upload a .cube preset file.");
                      return;
                    }
                    setError("");
                    setPresetFile(file);
                  }}
                />
              </label>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-semibold">Describe the look</h2>
                <p className="mt-2 text-sm text-zinc-500">Use clear, visual language that helps photographers discover it.</p>
              </div>
              <label className="block">
                <span className="text-sm font-semibold">Preset name</span>
                <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Example: Warm Wedding Glow" className="mt-2 h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-200" />
              </label>
              <label className="block">
                <span className="text-sm font-semibold">Description</span>
                <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} placeholder="Describe the look, mood, and best photo types for this preset." className="mt-2 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-200" />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label>
                  <span className="text-sm font-semibold">Category</span>
                  <select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm">
                    {categories.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
                <label>
                  <span className="text-sm font-semibold">Creator name</span>
                  <input value={creatorName} onChange={(event) => setCreatorName(event.target.value)} placeholder="Your studio or name" className="mt-2 h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm" />
                </label>
              </div>
              <label className="block">
                <span className="text-sm font-semibold">Tags</span>
                <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="warm, soft, skin tones, film" className="mt-2 h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm" />
              </label>
              <label className="block">
                <span className="text-sm font-semibold">Best used for</span>
                <input value={bestFor} onChange={(event) => setBestFor(event.target.value)} placeholder="Wedding portraits, golden hour, outdoor ceremonies" className="mt-2 h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm" />
              </label>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="text-xl font-semibold">Add preview images</h2>
              <p className="mt-2 text-sm text-zinc-500">Upload before and after examples so users can understand the style.</p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {[
                  { label: "Before image", file: beforeImage, setFile: setBeforeImage, url: beforeUrl },
                  { label: "After image", file: afterImage, setFile: setAfterImage, url: afterUrl },
                ].map((item) => (
                  <label key={item.label} className="relative flex aspect-[4/3] cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-dashed border-zinc-300 bg-zinc-50">
                    {item.url ? <img src={item.url} alt={item.label} className="h-full w-full object-cover" /> : <div className="text-center"><ImagePlus className="mx-auto h-7 w-7 text-zinc-400" /><p className="mt-3 text-sm font-semibold">{item.label}</p></div>}
                    <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="hidden" onChange={(event) => item.setFile(event.target.files?.[0] ?? null)} />
                  </label>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="text-xl font-semibold">Visibility and publish</h2>
              <p className="mt-2 text-sm text-zinc-500">Choose who can discover and use this preset.</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {[
                  { id: "private", title: "Private", copy: "Only visible to you." },
                  { id: "public", title: "Public Marketplace", copy: "Anyone can view and save this preset." },
                ].map((item) => (
                  <button key={item.id} type="button" onClick={() => setVisibility(item.id as "private" | "public")} className={`rounded-2xl border p-5 text-left transition ${visibility === item.id ? "border-zinc-950 bg-zinc-950 text-white" : "border-zinc-200 bg-white"}`}>
                    <p className="font-semibold">{item.title}</p>
                    <p className={`mt-2 text-sm ${visibility === item.id ? "text-zinc-300" : "text-zinc-500"}`}>{item.copy}</p>
                  </button>
                ))}
              </div>
              <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl bg-zinc-50 p-4">
                <input type="checkbox" checked={ownershipConfirmed} onChange={(event) => setOwnershipConfirmed(event.target.checked)} className="mt-1 h-4 w-4" />
                <span className="text-sm leading-6 text-zinc-600">I confirm I own this preset or have permission to share it.</span>
              </label>
            </div>
          )}

          {error && <p className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

          <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <button type="button" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0 || isPublishing} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-zinc-200 px-5 text-sm font-semibold disabled:opacity-40">
              <ChevronLeft className="h-4 w-4" /> Back
            </button>
            {step < steps.length - 1 ? (
              <button type="button" onClick={() => { setError(""); setStep((current) => current + 1); }} disabled={!canContinue} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-zinc-950 px-5 text-sm font-semibold text-white disabled:opacity-40">
                Continue <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button type="button" onClick={publish} disabled={!canContinue || isPublishing} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-zinc-950 px-5 text-sm font-semibold text-white disabled:opacity-40">
                {isPublishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Publish Preset
              </button>
            )}
          </div>
        </section>
      </div>
    </PresetPageShell>
  );
}
