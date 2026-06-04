"use client";

import Link from "next/link";
import { Bookmark, Eye, Globe2, Lock, Trash2 } from "lucide-react";
import { PresetBeforeAfter } from "@/components/preset-before-after";
import type { Preset } from "@/lib/preset-types";

export function PresetCard({
  preset,
  onSave,
  onDelete,
}: {
  preset: Preset;
  onSave?: (preset: Preset) => void;
  onDelete?: (preset: Preset) => void;
}) {
  return (
    <article className="group overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <PresetBeforeAfter
        beforeUrl={preset.previewBeforeUrl}
        afterUrl={preset.previewAfterUrl}
        alt={preset.name}
        className="aspect-[4/3]"
      />
      <div className="space-y-4 p-4">
        <div>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold">{preset.name}</h2>
              <p className="truncate text-sm text-zinc-500">
                By {preset.creatorName}
              </p>
            </div>
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-zinc-100 px-2 py-1 text-[11px] font-semibold text-zinc-600">
              {preset.visibility === "public" ? (
                <Globe2 className="h-3 w-3" />
              ) : (
                <Lock className="h-3 w-3" />
              )}
              {preset.visibility === "public" ? "Public" : "Private"}
            </span>
          </div>
          <p className="mt-3 line-clamp-2 min-h-10 text-sm leading-5 text-zinc-600">
            {preset.description || `${preset.category} editing style`}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
              {preset.category}
            </span>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
              Free
            </span>
            <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600">
              {preset.saveCount} saves
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Link
            href={`/presets/${preset.id}`}
            className="flex h-10 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50"
          >
            <Eye className="h-4 w-4" />
            Preview
          </Link>
          {onDelete ? (
            <button
              type="button"
              onClick={() => onDelete(preset)}
              className="flex h-10 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
            >
              <Trash2 className="h-4 w-4" />
              Remove
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onSave?.(preset)}
              disabled={preset.isOwner}
              className={`flex h-10 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition disabled:cursor-default ${
                preset.isSaved
                  ? "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                  : "bg-zinc-950 text-white hover:bg-zinc-800"
              }`}
            >
              <Bookmark className={`h-4 w-4 ${preset.isSaved ? "fill-current" : ""}`} />
              {preset.isOwner ? "Your preset" : preset.isSaved ? "Saved" : "Save"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
