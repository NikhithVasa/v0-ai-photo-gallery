"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

const cards = [
  {
    src: "/hero_one.png",
    position: "object-center",
  },
  {
    src: "/filter_1.png",
    position: "object-center",
  },
  {
    src: "/download.png",
    position: "object-top",
  },
  {
    src: "/collage.png",
    position: "object-center",
  },
] as const;

const zIndexByRank = [6, 4, 3, 2] as const;
const phaseDuration = 750;

function easeInOutQuart(progress: number) {
  return progress < 0.5
    ? 8 * progress ** 4
    : 1 - 8 * (1 - progress) ** 4;
}

export function HeroBrowserStack() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let animationFrame = 0;
    let cycleTimer = 0;
    let stopped = false;

    const positionCards = () => {
      Array.from(container.children).forEach((child, rank) => {
        const card = child as HTMLElement;
        card.style.transform = `translateX(${rank * 6}%) translateY(${rank * 8}%)`;
        card.style.opacity = "1";
        card.style.zIndex = String(zIndexByRank[rank] ?? 1);
      });
    };

    const setContainerHeight = () => {
      const firstCard = container.firstElementChild as HTMLElement | null;
      if (!firstCard) return;

      container.style.height = `${firstCard.clientHeight * (1 + 0.08 * (cards.length - 1))}px`;
    };

    positionCards();
    setContainerHeight();

    const resizeObserver = new ResizeObserver(setContainerHeight);
    const firstCard = container.firstElementChild;
    if (firstCard) resizeObserver.observe(firstCard);

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return () => resizeObserver.disconnect();
    }

    const beginCycle = () => {
      if (stopped) return;

      const frontCard = container.firstElementChild as HTMLElement | null;
      if (!frontCard) return;

      const remainingCards = Array.from(container.children).slice(1) as HTMLElement[];
      const frontRect = frontCard.getBoundingClientRect();
      const exitDistance = Math.round(
        window.scrollX + frontRect.left + frontCard.offsetWidth,
      );
      let phaseStartedAt: number | null = null;

      const exitFrontCard = (timestamp: number) => {
        if (stopped) return;
        phaseStartedAt ??= timestamp;

        const progress = Math.min((timestamp - phaseStartedAt) / phaseDuration, 1);
        const easedProgress = easeInOutQuart(progress);
        frontCard.style.transform = `translateX(${-exitDistance * easedProgress}px) translateY(0%)`;

        if (progress < 1) {
          animationFrame = requestAnimationFrame(exitFrontCard);
          return;
        }

        frontCard.style.transform = `translateX(${(cards.length - 1) * 6}%) translateY(${(cards.length - 1) * 8}%)`;
        frontCard.style.opacity = "0";
        container.appendChild(frontCard);
        Array.from(container.children).forEach((child, rank) => {
          const card = child as HTMLElement;
          card.style.opacity = "1";
          card.style.zIndex = String(zIndexByRank[rank] ?? 1);
        });
        phaseStartedAt = null;
        animationFrame = requestAnimationFrame(shiftCardsForward);
      };

      const shiftCardsForward = (timestamp: number) => {
        if (stopped) return;
        phaseStartedAt ??= timestamp;

        const progress = Math.min((timestamp - phaseStartedAt) / phaseDuration, 1);
        const easedProgress = easeInOutQuart(progress);

        remainingCards.forEach((card, index) => {
          card.style.transform = `translateX(${(index + 1 - easedProgress) * 6}%) translateY(${(index + 1 - easedProgress) * 8}%)`;
        });

        if (progress < 1) {
          animationFrame = requestAnimationFrame(shiftCardsForward);
          return;
        }

        positionCards();
        cycleTimer = window.setTimeout(beginCycle, phaseDuration);
      };

      animationFrame = requestAnimationFrame(exitFrontCard);
    };

    cycleTimer = window.setTimeout(beginCycle, 1500);

    return () => {
      stopped = true;
      cancelAnimationFrame(animationFrame);
      clearTimeout(cycleTimer);
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="relative mt-10 w-full max-w-sm pointer-events-none"
    >
      {cards.map((card, rank) => (
        <div
          key={card.src}
          className="hero-browser-card absolute left-0 top-0 aspect-[473/304]"
          style={{
            opacity: 1,
            transform: `translateX(${rank * 6}%) translateY(${rank * 8}%)`,
            zIndex: zIndexByRank[rank],
          }}
        >
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 473 304"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M14.89 14.798 1.269 289.628l13.298 13.234 456.868-.102-.632-288.293-13.4-13.24L14.89 14.799Z"
              fill="#0c0a09"
              stroke="#fff"
              strokeWidth="1.2"
            />
            <path
              d="M1.256 1.32h455.883v288.047H1.256z"
              fill="#0c0a09"
              stroke="#fff"
              strokeWidth="1.2"
            />
            <path
              d="m471.277 302.54-14.21-13.1"
              fill="none"
              stroke="#fff"
              strokeLinecap="square"
              strokeWidth="1.2"
            />
            <g fill="#fff">
              <circle cx="27.107" cy="23.842" r="3.086" />
              <circle cx="37.845" cy="23.842" r="3.086" />
              <circle cx="48.582" cy="23.842" r="3.086" />
            </g>
            <text
              x="446"
              y="27"
              fill="#fff"
              fontFamily="Arial, sans-serif"
              fontSize="9"
              fontWeight="700"
              textAnchor="end"
            >
              SD
            </text>
          </svg>

          <div className="absolute left-[5%] right-[8%] top-[15%] aspect-[1.856/1] overflow-hidden bg-stone-800">
            <Image
              src={card.src}
              alt=""
              fill
              sizes="(min-width: 768px) 320px, 90vw"
              className={`object-cover ${card.position}`}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
