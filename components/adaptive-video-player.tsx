"use client";

import Hls from "hls.js";
import { forwardRef, useEffect, useRef, useState } from "react";

interface AdaptiveVideoPlayerProps {
  hlsUrl?: string | null;
  fallbackUrl?: string | null;
  className?: string;
  controls?: boolean;
  playsInline?: boolean;
  preload?: "none" | "metadata" | "auto";
}

export const AdaptiveVideoPlayer = forwardRef<HTMLVideoElement, AdaptiveVideoPlayerProps>(function AdaptiveVideoPlayer({
  hlsUrl,
  fallbackUrl,
  className,
  controls = true,
  playsInline = true,
  preload = "metadata",
}, ref) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hlsFailed, setHlsFailed] = useState(false);

  useEffect(() => {
    setHlsFailed(false);
  }, [hlsUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const preferredHlsUrl = hlsUrl && !hlsFailed ? hlsUrl : null;
    const fallback = fallbackUrl ?? null;

    if (!preferredHlsUrl) {
      video.src = fallback ?? "";
      return;
    }

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      const onError = () => {
        if (fallback) setHlsFailed(true);
      };

      video.addEventListener("error", onError);
      video.src = preferredHlsUrl;

      return () => {
        video.removeEventListener("error", onError);
      };
    }

    if (!Hls.isSupported()) {
      video.src = fallback ?? preferredHlsUrl;
      return;
    }

    const hls = new Hls({
      enableWorker: true,
    });

    hls.loadSource(preferredHlsUrl);
    hls.attachMedia(video);

    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (!data.fatal) return;
      hls.destroy();
      if (fallback) {
        setHlsFailed(true);
        return;
      }
      video.src = "";
    });

    return () => {
      hls.destroy();
    };
  }, [fallbackUrl, hlsFailed, hlsUrl]);

  return (
    <video
      ref={(node) => {
        videoRef.current = node;
        if (!ref) return;
        if (typeof ref === "function") {
          ref(node);
          return;
        }
        ref.current = node;
      }}
      controls={controls}
      playsInline={playsInline}
      preload={preload}
      className={className}
    />
  );
});
