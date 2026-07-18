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
        className="relative mx-[0.05em] inline-flex h-[0.82em] w-[6.2em] translate-y-[0.1em] items-center justify-center align-baseline"
      >
        <svg
          className="absolute inset-0 h-full w-full overflow-visible"
          viewBox="0 0 600 120"
          preserveAspectRatio="none"
          fill="none"
        >
          <path
            d="M14 28C82 12 147 18 219 12 326 3 463 8 588 23l-7 72c-94 5-194 1-288 13-105 12-197-3-276-9 8-23-11-48-3-71Z"
            fill="#f472b6"
            opacity="0.82"
          />
          <path
            d="M8 48c118-20 221-6 331-17 80-8 159-7 253 4"
            stroke="#ec4899"
            strokeLinecap="round"
            strokeWidth="25"
            opacity="0.34"
          />
          <path
            d="M25 91c104 9 193 12 295 0 88-10 173-4 254-2"
            stroke="#f9a8d4"
            strokeLinecap="round"
            strokeWidth="17"
            opacity="0.58"
          />
        </svg>
        <span
          className={`relative z-10 inline-block whitespace-nowrap font-sans text-[0.44em] font-semibold uppercase leading-none tracking-[0.06em] text-stone-950 transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none ${isVisible ? "scale-100 opacity-100" : "scale-90 opacity-0"}`}
        >
          {keywords[keywordIndex]}
        </span>
      </span>
    </>
  );
}
