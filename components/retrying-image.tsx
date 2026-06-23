"use client";

import {
  type ImgHTMLAttributes,
  type SyntheticEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type RetryingImageProps = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  "src" | "onError"
> & {
  src: string;
  /**
   * Alternate URLs to try (in order) when `src` fails to load. This lets a
   * CloudFront URL that gets blocked by the browser (e.g. ORB on a 403 for an
   * object that does not exist yet) fall back to the same-origin `/api/media`
   * proxy before we resort to retrying with backoff.
   */
  fallbackSrcs?: string[];
};

const MAX_RETRY_DELAY_MS = 15000;

function imageRetryDelay(attempt: number) {
  return Math.min(
    MAX_RETRY_DELAY_MS,
    Math.max(500, 500 * 2 ** Math.min(attempt - 1, 5)),
  );
}

export function RetryingImage({
  src,
  fallbackSrcs,
  onLoad,
  ...props
}: RetryingImageProps) {
  const candidates = useMemo(() => {
    const seen = new Set<string>();
    return [src, ...(fallbackSrcs ?? [])].filter((url): url is string => {
      if (!url || seen.has(url)) return false;
      seen.add(url);
      return true;
    });
  }, [src, fallbackSrcs]);
  const candidatesKey = candidates.join("|");

  const retryTimerRef = useRef<number | null>(null);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setCandidateIndex(0);
    setAttempt(0);
    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    return () => {
      if (retryTimerRef.current !== null) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [candidatesKey]);

  const handleError = useCallback(() => {
    if (retryTimerRef.current !== null) return;

    if (candidateIndex < candidates.length - 1) {
      setCandidateIndex(candidateIndex + 1);
      return;
    }

    const nextAttempt = attempt + 1;
    retryTimerRef.current = window.setTimeout(() => {
      retryTimerRef.current = null;
      setCandidateIndex(0);
      setAttempt(nextAttempt);
    }, imageRetryDelay(nextAttempt));
  }, [attempt, candidateIndex, candidates.length]);

  const handleLoad = useCallback(
    (event: SyntheticEvent<HTMLImageElement>) => {
      if (retryTimerRef.current !== null) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      onLoad?.(event);
    },
    [onLoad],
  );

  const currentSrc = candidates[candidateIndex] ?? src;

  return (
    <img
      {...props}
      key={`${currentSrc}:${attempt}`}
      src={currentSrc}
      onLoad={handleLoad}
      onError={handleError}
    />
  );
}
