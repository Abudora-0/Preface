import { ImageResponse } from "next/og";

/**
 * Apple touch icon.
 *
 * iOS composites home-screen icons onto an opaque tile and applies its own
 * corner mask, so this deliberately uses the filled `tile` treatment rather
 * than the bare glyph the browser favicon uses, because a transparent mark would land
 * on black, and pre-rounded corners would get double-masked.
 */

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#238636",
        }}
      >
        <svg width="108" height="108" viewBox="2.4 2.5 19 19" fill="#ffffff">
          <rect x="10.25" y="3" width="7.8" height="2.7" rx="1.35" />
          <rect x="15.35" y="3" width="2.7" height="18" rx="1.35" />
          <rect x="10.25" y="3" width="2.7" height="18" rx="1.35" />
          <path d="M11.6 3a5.8 5.8 0 0 0 0 11.6z" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
