import { ImageResponse } from "next/og";
import {
  fetchSharePreviewLink,
  shareCoverPhotoUrl,
  sharePreviewText,
} from "@/lib/share-preview";
import { SITE_NAME } from "@/lib/seo";

export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";
export const dynamic = "force-dynamic";
export const revalidate = 0;

interface ImageProps {
  params: Promise<{ token: string }>;
}

export default async function Image({ params }: ImageProps) {
  const { token } = await params;
  const share = await fetchSharePreviewLink(token);
  const preview = share
    ? sharePreviewText(share)
    : {
        title: "Private photo gallery",
        description: SITE_NAME,
        albumName: "Private photo gallery",
        customerName: SITE_NAME,
      };
  const coverPhotoUrl = share
    ? await shareCoverPhotoUrl(share.cover_photo_s3_key)
    : null;

  return new ImageResponse(
    <div
      style={{
        background: "#141414",
        color: "#ffffff",
        display: "flex",
        fontFamily: "Inter, Arial, sans-serif",
        height: "100%",
        overflow: "hidden",
        position: "relative",
        width: "100%",
      }}
    >
      {coverPhotoUrl ? (
        <img
          alt=""
          src={coverPhotoUrl}
          style={{
            height: "100%",
            objectFit: "cover",
            position: "absolute",
            width: "100%",
          }}
        />
      ) : null}
      <div
        style={{
          background:
            "linear-gradient(90deg, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.46) 46%, rgba(0,0,0,0.08) 100%)",
          display: "flex",
          height: "100%",
          position: "absolute",
          width: "100%",
        }}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 28,
          justifyContent: "flex-end",
          padding: 72,
          position: "relative",
          width: "100%",
        }}
      >
        <div
          style={{
            color: "rgba(255,255,255,0.76)",
            fontSize: 30,
            fontWeight: 700,
          }}
        >
          {preview.customerName || SITE_NAME}
        </div>
        <div
          style={{
            fontSize: 78,
            fontWeight: 800,
            letterSpacing: 0,
            lineHeight: 0.96,
            maxWidth: 860,
          }}
        >
          {preview.albumName}
        </div>
        <div
          style={{
            color: "rgba(255,255,255,0.82)",
            fontSize: 28,
            fontWeight: 600,
          }}
        >
          View Gallery
        </div>
      </div>
    </div>,
    size,
  );
}