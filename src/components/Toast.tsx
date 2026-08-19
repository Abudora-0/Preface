"use client";

import { useEffect } from "react";
import { AlertTriangle, Check, Info } from "lucide-react";

export type ToastTone = "ok" | "error" | "info";
export type ToastMessage = { id: number; text: string; tone: ToastTone };

/**
 * Transient confirmation for actions whose result happens off-screen (a file
 * landing in the downloads folder, text reaching the clipboard). Announced
 * politely so it is not lost on screen readers.
 */
export default function Toast({
  toast,
  onDismiss,
}: {
  toast: ToastMessage | null;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(onDismiss, 2400);
    return () => clearTimeout(id);
  }, [toast, onDismiss]);

  const tones = {
    ok: { icon: Check, cls: "border-[rgba(63,185,80,0.45)] text-lime" },
    error: { icon: AlertTriangle, cls: "border-[rgba(248,81,73,0.45)] text-rose" },
    info: { icon: Info, cls: "border-line text-dim" },
  };

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed right-4 bottom-4 z-50 flex flex-col items-end gap-2"
    >
      {toast
        ? (() => {
            const { icon: Icon, cls } = tones[toast.tone];
            return (
              <div
                key={toast.id}
                className={`toast-in flex items-center gap-2 rounded-md border bg-panel px-3 py-2 text-xs shadow-[0_8px_24px_rgba(1,4,9,0.6)] ${cls}`}
              >
                <Icon size={14} />
                <span className="text-ink">{toast.text}</span>
              </div>
            );
          })()
        : null}
    </div>
  );
}
