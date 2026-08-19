"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Download,
  House,
  RotateCcw,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import PrefaceMark from "@/components/PrefaceMark";
import { Button } from "@/components/ui";

const STORAGE_KEY = "preface.state.v1";

/**
 * Last line of defence for the whole builder route.
 *
 * The draft lives in localStorage, so a crash here is recoverable but only if
 * the user is given a way to reach it. A corrupt draft can also throw again
 * the moment it is restored, which makes "Try again" a loop. Both exits are
 * therefore offered: take the markdown out, or throw the draft away.
 */
export default function BuilderError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  // Reading localStorage is exactly the external-system sync effects are for,
  // and it cannot happen during render because this page is prerenderable.
  useEffect(() => {
    console.error("[builder] route failed", error);
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { markdown?: string };
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved.markdown?.trim()) setDraft(saved.markdown);
    } catch {
      // an unreadable draft is exactly the case the reset button is for
    }
  }, [error]);

  function download() {
    if (!draft) return;
    const url = URL.createObjectURL(
      new Blob([draft], { type: "text/markdown" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "README.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  function startFresh() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem("reposcribe.state.v1");
    } catch {
      // nothing to clear
    }
    reset();
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-6 py-16">
      <div className="reveal w-full max-w-lg">
        <div className="mb-6 flex items-center gap-2.5">
          <PrefaceMark size={30} />
          <span className="font-mono text-lg font-semibold tracking-tight text-ink">
            Preface
          </span>
        </div>

        <div className="rounded-md border border-line bg-panel">
          <div className="flex items-center gap-2 border-b border-line bg-inset px-4 py-2.5 text-sm font-semibold text-rose">
            <TriangleAlert size={15} />
            The builder stopped
          </div>

          <div className="p-4">
            <p className="mb-3 text-[13px] leading-relaxed text-dim">
              Something in the workspace failed to render. Your saved draft is
              still on this machine, so nothing is lost.
            </p>

            <p className="mb-4 rounded-md border border-line bg-inset px-3 py-2 font-mono text-[11px] break-words text-faint">
              {error.message || "Unknown error"}
              {error.digest ? ` (${error.digest})` : ""}
            </p>

            <div className="flex flex-wrap gap-2">
              <Button variant="primary" size="sm" onClick={reset}>
                <RotateCcw size={13} />
                Try again
              </Button>

              {draft ? (
                <Button size="sm" onClick={download}>
                  <Download size={13} />
                  Save the draft
                </Button>
              ) : null}

              <Link href="/">
                <Button size="sm">
                  <House size={13} />
                  Home
                </Button>
              </Link>
            </div>

            <hr className="my-4 border-line" />

            <p className="mb-2.5 text-[12px] leading-relaxed text-faint">
              If it fails again immediately, the saved draft itself is the
              problem. Save it first if you want to keep it, then clear it.
            </p>

            <Button variant="danger" size="sm" onClick={startFresh}>
              <Trash2 size={13} />
              Clear the draft and restart
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
