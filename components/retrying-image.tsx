"use client";

import {
  type ImgHTMLAttributes,
  type SyntheticEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

type RetryingImageProps = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  "src" | "onError"
> & {
  src: string;
};

const MAX_RETRY_DELAY_MS = 15000;

function imageRetryDelay(attempt: number) {
  return Math.min(
    MAX_RETRY_DELAY_MS,
    Math.max(500, 500 * 2 ** Math.min(attempt - 1, 5)),
  );
}

export function RetryingImage({ src, onLoad, ...props }: RetryingImageProps) {
  const retryTimerRef = useRef<number | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
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
  }, [src]);

  const retry = useCallback(() => {
    if (retryTimerRef.current !== null) return;

    const nextAttempt = attempt + 1;
    retryTimerRef.current = window.setTimeout(() => {
      retryTimerRef.current = null;
      setAttempt(nextAttempt);
    }, imageRetryDelay(nextAttempt));
  }, [attempt]);

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

  return (
    <img
      {...props}
      key={`${src}:${attempt}`}
      src={src}
      onLoad={handleLoad}
      onError={retry}
    />
  );
}
