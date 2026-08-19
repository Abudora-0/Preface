"use client";

import { useEffect, useMemo, useState } from "react";

/** GitHub's dark-theme contribution scale. */
const LEVELS = ["#151b23", "#033a16", "#196c2e", "#2ea043", "#56d364"];

/** Deterministic PRNG so server and client render identical markup. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default function ContribGraph({
  cols = 34,
  rows = 7,
  seed = 20260818,
}: {
  cols?: number;
  rows?: number;
  seed?: number;
}) {
  const base = useMemo(() => {
    const rand = mulberry32(seed);
    return Array.from({ length: cols * rows }, () => {
      const r = rand();
      if (r > 0.88) return 4;
      if (r > 0.72) return 3;
      if (r > 0.52) return 2;
      if (r > 0.3) return 1;
      return 0;
    });
  }, [cols, rows, seed]);

  // A single cell lights up at a time, mimicking live activity.
  const [hot, setHot] = useState<number | null>(null);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const total = cols * rows;
    const id = setInterval(() => {
      setHot(Math.floor(Math.random() * total));
    }, 620);
    return () => clearInterval(id);
  }, [cols, rows]);

  return (
    <div
      aria-hidden
      className="flex gap-[3px] overflow-hidden"
      style={{ maskImage: "linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent)" }}
    >
      {Array.from({ length: cols }).map((_, c) => (
        <div key={c} className="flex flex-col gap-[3px]">
          {Array.from({ length: rows }).map((_, r) => {
            const i = c * rows + r;
            const level = hot === i ? 4 : base[i];
            return (
              <span
                key={r}
                className="h-[11px] w-[11px] rounded-[2px]"
                style={{
                  background: LEVELS[level],
                  outline: level === 0 ? "1px solid rgba(240,246,252,0.06)" : "none",
                  outlineOffset: "-1px",
                  animation: "gh-cell-in .4s cubic-bezier(.2,.7,.3,1) both",
                  animationDelay: `${(c * 9 + r * 4) % 700}ms`,
                  transition: "background-color .45s ease",
                }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
