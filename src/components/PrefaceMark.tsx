/**
 * Preface brand mark: a geometric pilcrow (¶).
 *
 * The pilcrow is the typographic mark for "start of a new passage", which is
 * exactly what a README is to a repository. It reads clearly at 16px, carries
 * no resemblance to GitHub's octocat, and needs no gradient or defs (so it can
 * be repeated on a page without colliding ids).
 *
 * Default is the bare glyph on no background. The green is Primer's foreground
 * green rather than the `#238636` button green, which is tuned to sit
 * behind white text and goes muddy as a small mark on a dark canvas.
 */

const BRAND_GREEN = "#3fb950";

function Pilcrow() {
  return (
    <>
      {/* top bar joining both stems */}
      <rect x="10.25" y="3" width="7.8" height="2.7" rx="1.35" />
      {/* right stem */}
      <rect x="15.35" y="3" width="2.7" height="18" rx="1.35" />
      {/* left stem */}
      <rect x="10.25" y="3" width="2.7" height="18" rx="1.35" />
      {/* bowl */}
      <path d="M11.6 3a5.8 5.8 0 0 0 0 11.6z" />
    </>
  );
}

export default function PrefaceMark({
  size = 28,
  variant = "glyph",
  color = BRAND_GREEN,
}: {
  size?: number;
  /** `glyph` = bare pilcrow, no background. `tile` = white pilcrow on a green square. */
  variant?: "glyph" | "tile";
  /** Any CSS colour, including `currentColor` to inherit from the parent. */
  color?: string;
}) {
  if (variant === "tile") {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="#238636" />
        <g transform="translate(4 4)" fill="#ffffff">
          <Pilcrow />
        </g>
      </svg>
    );
  }

  // The mark spans x 5.8-18.05 and y 3-21 inside the 24 box, so it is already
  // optically centred. Scaling up from the centre restores the presence the
  // tile used to provide, without clipping at the edges.
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true">
      <g transform="translate(12 12) scale(1.16) translate(-12 -12)">
        <Pilcrow />
      </g>
    </svg>
  );
}
