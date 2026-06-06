"use client";

import { useEffect, useMemo, useState } from "react";

const RETRY_DELAYS = [0, 500, 1000];

function retrySrc(src: string, attempt: number) {
  if (attempt === 0) return src;
  const separator = src.includes("?") ? "&" : "?";
  return `${src}${separator}avatarRetry=${attempt}`;
}

export function RetryableAvatarImage({
  src,
  alt,
  className = "h-full w-full object-cover",
  onFailed,
}: {
  src: string;
  alt: string;
  className?: string;
  onFailed?: () => void;
}) {
  const [attempt, setAttempt] = useState(0);
  const [hasFailed, setHasFailed] = useState(false);

  useEffect(() => {
    setAttempt(0);
    setHasFailed(false);
  }, [src]);

  const currentSrc = useMemo(() => retrySrc(src, attempt), [attempt, src]);

  if (hasFailed) return null;

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      onError={() => {
        const nextAttempt = attempt + 1;

        if (nextAttempt >= RETRY_DELAYS.length) {
          setHasFailed(true);
          onFailed?.();
          return;
        }

        window.setTimeout(() => setAttempt(nextAttempt), RETRY_DELAYS[nextAttempt]);
      }}
    />
  );
}
