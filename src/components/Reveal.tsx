"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Reveals children on scroll.
 *
 * IntersectionObserver is the primary trigger, but it is backed by a geometry
 * check on mount and a passive scroll listener. Without those, anything the
 * observer never reports on (hidden/background tabs, throttled observers,
 * browsers without IO) would stay at opacity:0 forever, leaving content that is
 * invisible rather than merely un-animated. The CSS honours
 * prefers-reduced-motion.
 */
export default function Reveal({
  children,
  delay = 0,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  /** milliseconds */
  delay?: number;
  className?: string;
  as?: "div" | "section" | "li" | "span";
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    let done = false;
    const reveal = () => {
      if (done) return;
      done = true;
      setShown(true);
      cleanup();
    };

    /** True when the element is inside (or above) the viewport. */
    const inView = () => {
      const rect = node.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      return rect.top < vh * 0.92 && rect.bottom > 0;
    };

    let observer: IntersectionObserver | null = null;
    const onScroll = () => {
      if (inView()) reveal();
    };

    function cleanup() {
      observer?.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    }

    // Already on screen at mount, so reveal without waiting for the observer.
    if (inView()) {
      setShown(true);
      return;
    }

    if (typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) reveal();
        },
        { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
      );
      observer.observe(node);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    return cleanup;
  }, []);

  return (
    <Tag
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={ref as any}
      style={{ transitionDelay: `${delay}ms` }}
      className={[className, "reveal", shown ? "in" : ""].filter(Boolean).join(" ")}
    >
      {children}
    </Tag>
  );
}
