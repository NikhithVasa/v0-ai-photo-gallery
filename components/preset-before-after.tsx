"use client";

import { useState } from "react";

export function PresetBeforeAfter({
  beforeUrl,
  afterUrl,
  alt,
  className = "",
}: {
  beforeUrl: string | null;
  afterUrl: string | null;
  alt: string;
  className?: string;
}) {
  const [position, setPosition] = useState(55);

  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-br from-amber-100 via-rose-100 to-zinc-200 ${className}`}
    >
      {beforeUrl && (
        <img src={beforeUrl} alt={`${alt} before`} className="h-full w-full object-cover" />
      )}
      {afterUrl && (
        <div
          className="absolute inset-y-0 left-0 overflow-hidden"
          style={{ width: `${position}%` }}
        >
          <img
            src={afterUrl}
            alt={`${alt} after`}
            className="h-full max-w-none object-cover"
            style={{ width: `${10000 / position}%` }}
          />
        </div>
      )}
      <div
        className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow"
        style={{ left: `${position}%` }}
      >
        <span className="absolute left-1/2 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-xs font-bold text-zinc-800 shadow">
          ↔
        </span>
      </div>
      <span className="absolute bottom-2 left-2 rounded-full bg-black/55 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
        After
      </span>
      <span className="absolute bottom-2 right-2 rounded-full bg-black/55 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
        Before
      </span>
      <input
        type="range"
        min="5"
        max="95"
        value={position}
        onChange={(event) => setPosition(Number(event.target.value))}
        className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
        aria-label={`Compare before and after for ${alt}`}
      />
    </div>
  );
}
