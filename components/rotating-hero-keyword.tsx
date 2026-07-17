"use client";

import { useEffect, useState } from "react";

const keywords = [
  "wedding",
  "party",
  "portrait",
  "product",
  "photoshoot",
  "event",
  "celebration",
] as const;

const rotationInterval = 2500;
const fadeDuration = 300;

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
        className={`inline-block transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none ${isVisible ? "translate-y-0 opacity-100" : "-translate-y-[0.18em] opacity-0"}`}
      >
        {keywords[keywordIndex]}
      </span>
    </>
  );
}
