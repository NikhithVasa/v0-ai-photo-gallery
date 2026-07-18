"use client";

import { useEffect, useState } from "react";

const keywords = [
  "corporate event",
  "business event",
  "wedding",
  "live performance",
  "fashion show",
  "art show",
  "community gathering",
  "private party",
  "product photoshoot",
  "conference",
  "concert",
  "cultural festival",
] as const;

const rotationInterval = 1000;
const fadeDuration = 200;

export function RotatingHeroKeyword() {
  const [keywordIndex, setKeywordIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let swapTimer = 0;
    const rotationTimer = window.setInterval(() => {
      setIsVisible(false);
      swapTimer = window.setTimeout(() => {
        setKeywordIndex((currentIndex) =>
          (currentIndex + 1) % keywords.length,
        );
        setIsVisible(true);
      }, fadeDuration);
    }, rotationInterval);

    return () => {
      clearInterval(rotationTimer);
      clearTimeout(swapTimer);
    };
  }, []);

  return (
    <>
      <span className="sr-only">wedding</span>
      <span
        aria-hidden="true"
        className="relative mx-[0.06em] inline-flex h-[0.78em] w-[5.5em] translate-y-[0.06em] items-center justify-center rounded-[0.12em] border-[0.025em] border-pink-500 bg-pink-50/80 px-[0.12em] align-baseline shadow-[0_0_0.18em_rgba(236,72,153,0.28)]"
      >
        <svg
          className="hero-keyword-sparkle absolute -right-[0.07em] -top-[0.09em] h-[0.18em] w-[0.18em] overflow-visible text-pink-500"
          viewBox="0 0 16 16"
          fill="none"
        >
          <path
            d="M8 0c0 4.4 3.6 8 8 8-4.4 0-8 3.6-8 8 0-4.4-3.6-8-8-8 4.4 0 8-3.6 8-8Z"
            fill="currentColor"
          />
        </svg>
        <svg
          className="hero-keyword-sparkle hero-keyword-sparkle--delayed absolute -bottom-[0.07em] -left-[0.06em] h-[0.13em] w-[0.13em] overflow-visible text-pink-400"
          viewBox="0 0 16 16"
          fill="none"
        >
          <path
            d="M8 0c0 4.4 3.6 8 8 8-4.4 0-8 3.6-8 8 0-4.4-3.6-8-8-8 4.4 0 8-3.6 8-8Z"
            fill="currentColor"
          />
        </svg>
        <span
          className={`inline-block whitespace-nowrap font-sans text-[0.38em] font-semibold uppercase leading-none tracking-[0.08em] text-pink-950 transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none ${isVisible ? "scale-100 opacity-100" : "scale-90 opacity-0"}`}
        >
          {keywords[keywordIndex]}
        </span>
      </span>
    </>
  );
}
