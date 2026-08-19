"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import Preview from "./Preview";

const SCRIPT = `# orbit-api

> Fast, unopinionated satellite pass tracking for Node.

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)

## Features

- **Pass prediction**: computes visible passes for any lat/long
- **TLE caching**: Redis-backed, six hour TTL
- **Rate limited**: 100 requests per minute per key

## Getting Started

\`\`\`bash
npm install
npm run dev
\`\`\`

## Scripts

| Command | Description |
| --- | --- |
| \`npm run dev\` | Start the development server |
| \`npm test\` | Run the test suite |
`;

/** Cheap line-level colouring for the source pane. */
function lineClass(line: string, inFence: boolean): string {
  if (/^```/.test(line)) return "text-[#7ee787]";
  if (inFence) return "text-[#ffa657]";
  if (/^#{1,6}\s/.test(line)) return "text-[#79c0ff] font-semibold";
  if (/^>\s/.test(line)) return "text-[#8b949e] italic";
  if (/^\|/.test(line)) return "text-[#a5d6ff]";
  if (/^!\[/.test(line)) return "text-[#d2a8ff]";
  return "text-[#e6edf3]";
}

/**
 * Both panes are a fixed height that never changes. The card sits above the
 * fold on a page the user scrolls, so letting it grow with its own content
 * would reflow everything below it on every keystroke. Instead the panes stay
 * put and auto-scroll to follow the caret, which also means the whole document
 * is seen as it is written rather than being clipped at the bottom.
 */
const PANE_HEIGHT = 344;

export default function TypingDemo() {
  const [count, setCount] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [reduced, setReduced] = useState(false);
  const holdRef = useRef(0);
  const sourceRef = useRef<HTMLPreElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // Reading the user's motion preference is an external-system sync; when it is
  // set we skip the animation and show the finished document immediately.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (mq?.matches) {
      setReduced(true);
      setCount(SCRIPT.length);
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (reduced || !playing) return;
    const id = setInterval(() => {
      setCount((c) => {
        if (c >= SCRIPT.length) {
          holdRef.current += 1;
          if (holdRef.current > 70) {
            holdRef.current = 0;
            return 0;
          }
          return c;
        }
        return Math.min(SCRIPT.length, c + 4);
      });
    }, 26);
    return () => clearInterval(id);
  }, [playing, reduced]);

  const typed = SCRIPT.slice(0, count);
  const done = count >= SCRIPT.length;
  const progress = Math.round((count / SCRIPT.length) * 100);

  const lines = useMemo(() => {
    const out: { text: string; cls: string }[] = [];
    let inFence = false;
    for (const line of typed.split("\n")) {
      const isMarker = /^```/.test(line);
      out.push({ text: line, cls: lineClass(line, inFence && !isMarker) });
      if (isMarker) inFence = !inFence;
    }
    return out;
  }, [typed]);

  // Keep the newest content in view. Writing scrollTop on an overflow-hidden
  // element scrolls it without ever showing a scrollbar.
  useEffect(() => {
    if (sourceRef.current) sourceRef.current.scrollTop = sourceRef.current.scrollHeight;
    if (previewRef.current) previewRef.current.scrollTop = previewRef.current.scrollHeight;
  }, [typed]);

  return (
    <div className="overflow-hidden rounded-md border border-line bg-bg text-left shadow-[0_16px_48px_rgba(1,4,9,0.6)]">
      <div className="flex items-center gap-2 border-b border-line bg-panel px-3 py-2">
        <span className="flex items-center gap-1.5 font-mono text-xs text-ink">
          <span className="text-dim">preface</span>
          <span className="text-faint">/</span>
          <span className="font-semibold">README.md</span>
        </span>

        <span className="ml-2 hidden items-center gap-1 rounded-full border border-line px-2 py-0.5 text-[10px] text-dim sm:inline-flex">
          <span
            className={`h-1.5 w-1.5 rounded-full ${done ? "bg-lime" : "bg-amber"}`}
            style={done ? undefined : { animation: "gh-blink 1s steps(1) infinite" }}
          />
          {done ? "rendered" : "generating"}
        </span>

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setPlaying((p) => !p)}
            title={playing ? "Pause" : "Play"}
            className="focus-ring press rounded-md p-1.5 text-dim transition-colors hover:bg-raised hover:text-ink"
          >
            {playing ? <Pause size={13} /> : <Play size={13} />}
          </button>
          <button
            onClick={() => {
              setCount(0);
              holdRef.current = 0;
              setPlaying(true);
            }}
            title="Restart"
            className="focus-ring press rounded-md p-1.5 text-dim transition-colors hover:bg-raised hover:text-ink"
          >
            <RotateCcw size={13} />
          </button>
        </div>
      </div>

      <div className="h-0.5 w-full bg-panel">
        <div
          className="h-full bg-brand transition-[width] duration-100 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="grid sm:grid-cols-2">
        <div
          className="flex flex-col border-b border-line bg-bg sm:border-r sm:border-b-0"
          style={{ height: PANE_HEIGHT }}
        >
          <div className="shrink-0 border-b border-line px-3 py-1.5 font-mono text-[10px] tracking-wide text-faint uppercase">
            Markdown
          </div>
          <pre
            ref={sourceRef}
            className="flex-1 overflow-hidden px-3 py-3 font-mono text-[11.5px] leading-[1.65] sm:text-[12px]"
          >
            {lines.map((l, i) => (
              <div key={i} className="flex">
                <span className="w-7 shrink-0 pr-3 text-right text-[#484f58] select-none">
                  {i + 1}
                </span>
                <span className={l.cls}>
                  {l.text || " "}
                  {i === lines.length - 1 && !done ? (
                    <span className="caret text-[#e6edf3]" />
                  ) : null}
                </span>
              </div>
            ))}
          </pre>
        </div>

        <div className="flex flex-col bg-[#0d1117]" style={{ height: PANE_HEIGHT }}>
          <div className="shrink-0 border-b border-line px-3 py-1.5 font-mono text-[10px] tracking-wide text-faint uppercase">
            Preview
          </div>
          <div ref={previewRef} className="flex-1 overflow-hidden">
            <div className="gh px-4 py-3 text-[13px]" data-theme="dark">
              <Preview markdown={typed} theme="dark" embedded />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
