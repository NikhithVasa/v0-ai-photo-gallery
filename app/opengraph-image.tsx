import { ImageResponse } from "next/og";
import { SITE_DESCRIPTION, SITE_NAME, SITE_PRICING_SUMMARY } from "@/lib/seo";

export const alt = `${SITE_NAME} AI photo gallery platform`;
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "stretch",
        background:
          "linear-gradient(135deg, #FAF7F2 0%, #E8CFC3 48%, #171411 100%)",
        color: "#171411",
        display: "flex",
        fontFamily: "Inter, Arial, sans-serif",
        height: "100%",
        justifyContent: "center",
        padding: 64,
        width: "100%",
      }}
    >
      <div
        style={{
          background: "rgba(255, 255, 255, 0.78)",
          border: "1px solid rgba(31, 27, 22, 0.12)",
          borderRadius: 40,
          display: "flex",
          flexDirection: "column",
          height: "100%",
          justifyContent: "space-between",
          padding: 56,
          width: "100%",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div
            style={{
              alignItems: "center",
              display: "flex",
              fontSize: 28,
              fontWeight: 700,
              gap: 16,
            }}
          >
            <div
              style={{
                alignItems: "center",
                background: "#171411",
                borderRadius: 999,
                color: "#FAF7F2",
                display: "flex",
                height: 56,
                justifyContent: "center",
                width: 56,
              }}
            >
              SD
            </div>
            {SITE_NAME}
          </div>
          <div
            style={{
              fontSize: 74,
              fontWeight: 800,
              letterSpacing: 0,
              lineHeight: 1,
              maxWidth: 820,
            }}
          >
            Free open-source AI photo galleries
          </div>
          <div
            style={{
              color: "#4F473F",
              fontSize: 28,
              lineHeight: 1.35,
              maxWidth: 850,
            }}
          >
            {SITE_DESCRIPTION}
          </div>
        </div>

        <div
          style={{
            alignItems: "center",
            background: "#171411",
            borderRadius: 999,
            color: "#FAF7F2",
            display: "flex",
            fontSize: 24,
            fontWeight: 700,
            height: 58,
            justifyContent: "center",
            padding: "0 28px",
            width: 760,
          }}
        >
          {SITE_PRICING_SUMMARY}
        </div>
      </div>
    </div>,
    size,
  );
}
