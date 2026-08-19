"use client";

import { useEffect, useState } from "react";
import { BookOpen, GitFork, LayoutTemplate, Workflow } from "lucide-react";

const TABS = [
  { id: "overview", label: "Overview", icon: BookOpen },
  { id: "features", label: "Features", icon: GitFork },
  { id: "templates", label: "Templates", icon: LayoutTemplate },
  { id: "workflow", label: "Workflow", icon: Workflow },
] as const;

/** Counts come from the caller so they cannot drift from the real lists. */
export type SectionCounts = Partial<Record<(typeof TABS)[number]["id"], number>>;

/**
 * Repo-style underline tabs that track the section currently in view.
 *
 * Uses scroll geometry rather than IntersectionObserver so the active tab is
 * correct on first paint and keeps working where observers are throttled.
 */
export default function SectionNav({ counts = {} }: { counts?: SectionCounts }) {
  const [active, setActive] = useState("overview");

  useEffect(() => {
    let frame = 0;

    const compute = () => {
      frame = 0;
      // The section whose top is closest to (but not far past) the nav line.
      const line = window.innerHeight * 0.32;
      let current: (typeof TABS)[number]["id"] = TABS[0].id;
      for (const t of TABS) {
        const el = document.getElementById(t.id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= line) current = t.id;
      }
      setActive(current);
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(compute);
    };

    compute();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <nav className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto overflow-y-hidden px-6">
        {TABS.map((t) => {
          const on = active === t.id;
          return (
            <a
              key={t.id}
              href={`#${t.id}`}
              data-active={on}
              className={`tabline focus-ring flex shrink-0 items-center gap-2 rounded-t-md px-3 py-3 text-sm transition-colors ${
                on ? "font-semibold text-ink" : "text-dim hover:text-ink"
              }`}
            >
              <t.icon size={15} className={on ? "text-ink" : "text-faint"} />
              {t.label}
              {counts[t.id] ? (
                <span className="rounded-full border border-line bg-panel px-1.5 py-px text-[10px] text-dim tabular-nums">
                  {counts[t.id]}
                </span>
              ) : null}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
