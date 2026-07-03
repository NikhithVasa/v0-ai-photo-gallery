"use client";

import { forwardRef, useCallback, useEffect, useRef } from "react";
import videojs from "video.js";

interface HlsVideoPlayerProps {
  hlsUrl?: string | null;
  mp4Url?: string | null;
  posterUrl?: string | null;
  className?: string;
  videoClassName?: string;
}

function assignForwardedRef<T>(
  ref: React.ForwardedRef<T>,
  value: T | null,
) {
  if (typeof ref === "function") {
    ref(value);
    return;
  }

  if (ref) ref.current = value;
}

export const HlsVideoPlayer = forwardRef<HTMLVideoElement, HlsVideoPlayerProps>(
  function HlsVideoPlayer(
    { hlsUrl, mp4Url, posterUrl, className, videoClassName },
    forwardedRef,
  ) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const playerRef = useRef<ReturnType<typeof videojs> | null>(null);

    const setVideoRef = useCallback(
      (element: HTMLVideoElement | null) => {
        videoRef.current = element;
        assignForwardedRef(forwardedRef, element);
      },
      [forwardedRef],
    );

    useEffect(() => {
      if (!videoRef.current) return;

      const source = hlsUrl
        ? { src: hlsUrl, type: "application/x-mpegURL" }
        : mp4Url
          ? { src: mp4Url, type: "video/mp4" }
          : null;

      if (!source) return;

      if (!playerRef.current) {
        playerRef.current = videojs(videoRef.current, {
          controls: true,
          fill: true,
          playsinline: true,
          poster: posterUrl ?? undefined,
          preload: "metadata",
          sources: [source],
        });
        return;
      }

      playerRef.current.poster(posterUrl ?? "");
      playerRef.current.src(source);
    }, [hlsUrl, mp4Url, posterUrl]);

    useEffect(() => {
      return () => {
        playerRef.current?.dispose();
        playerRef.current = null;
      };
    }, []);

    return (
      <div className={className} data-vjs-player>
        <video
          ref={setVideoRef}
          className={`video-js vjs-big-play-centered ${videoClassName ?? ""}`}
          playsInline
        />
      </div>
    );
  },
);