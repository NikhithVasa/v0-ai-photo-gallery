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
};

const MAX_RETRY_DELAY_MS = 15000;

const SIGNED_QUERY_PARAMS = [
  "X-Amz-Signature",
  "X-Amz-Credential",
  "X-Amz-Algorithm",
  "Signature",
  "Policy",
  "Key-Pair-Id",
];

export function imageRetryDelay(attempt: number) {
  return Math.min(
    MAX_RETRY_DELAY_MS,
    Math.max(500, 500 * 2 ** Math.min(attempt - 1, 5)),
  );
}

function hasSignedQueryParams(url: URL) {
  return SIGNED_QUERY_PARAMS.some((param) => url.searchParams.has(param));
}

export function retryingImageSrc(src: string, attempt: number) {
  if (attempt <= 0 || typeof window === "undefined") return src;

  try {
    const url = new URL(src, window.location.href);
    if (hasSignedQueryParams(url)) return src;

    url.searchParams.set("_imgRetry", String(attempt));

    if (url.origin === window.location.origin && src.startsWith("/")) {
      return `${url.pathname}${url.search}${url.hash}`;
    }

    return url.toString();
  } catch {
    return src;
  }
}

export function RetryingImage({ src, onLoad, ...props }: RetryingImageProps) {
  const retryTimerRef = useRef<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  const retrySrc = useMemo(() => retryingImageSrc(src, attempt), [attempt, src]);

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
      src={retrySrc}
      onLoad={handleLoad}
      onError={retry}
    />
  );
}
