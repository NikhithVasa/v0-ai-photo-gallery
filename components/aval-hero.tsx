"use client";

import { defineAvalElement } from "@pixel-point/aval-element";
import { useEffect } from "react";

export function AvalHero() {
  useEffect(() => {
    defineAvalElement();
  }, []);

  return (
    <aval-player
      src="/aval/hero.avl"
      motion="auto"
      autoplay="visible"
      fit="cover"
      width={960}
      height={540}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 block h-full w-full overflow-hidden"
    >
      <img
        slot="fallback"
        src="/aval/hero.png"
        alt=""
        width={960}
        height={540}
        className="block h-full w-full object-cover"
      />
    </aval-player>
  );
}
