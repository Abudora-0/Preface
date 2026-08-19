/**
 * The "Preface" wordmark, split into per-character spans so each letter can be
 * staggered independently: a rise-and-settle on load, and a wave on hover
 * (driven from the parent `.brand`, so hovering the mark animates the text too).
 *
 * The split letters are hidden from assistive tech and the whole lockup is
 * announced once via aria-label, otherwise screen readers spell it out.
 */
export default function Wordmark({
  text = "Preface",
  label,
  className,
}: {
  /** The glyphs actually drawn. */
  text?: string;
  /** Accessible name. Defaults to `text`; set it when the two should differ. */
  label?: string;
  className?: string;
}) {
  return (
    <span className={["wordmark", className].filter(Boolean).join(" ")} aria-label={label ?? text}>
      {text.split("").map((ch, i) => (
        <span
          key={i}
          aria-hidden="true"
          className="wm-ch"
          style={{ "--i": i } as React.CSSProperties}
        >
          {ch}
        </span>
      ))}
    </span>
  );
}
