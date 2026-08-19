"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  Check,
  Columns2,
  Copy,
  Download,
  Eye,
  FileCode2,
  LayoutTemplate,
  Loader2,
  Moon,
  PenLine,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Sun,
  WrapText,
} from "lucide-react";

import Preview from "@/components/Preview";
import PrefaceMark from "@/components/PrefaceMark";
import Toast, { type ToastMessage, type ToastTone } from "@/components/Toast";
import {
  BadgesPanel,
  DetailsPanel,
  DumpPanel,
  ImportPanel,
  SectionsPanel,
  TemplatesPanel,
} from "@/components/panels";
import { Button, GithubIcon, Label, cx } from "@/components/ui";
import { analyzeDump } from "@/lib/analyze";
import { renderReadme } from "@/lib/render";
import { TEMPLATES, templateMeta } from "@/lib/templates";
import { emptySpec, type ProjectSpec, type TemplateId } from "@/lib/types";

const STORAGE_KEY = "preface.state.v1";
/** Pre-rename key; read once so existing drafts survive the rebrand. */
const LEGACY_STORAGE_KEY = "reposcribe.state.v1";

const TABS = [
  { id: "dump", label: "Dump", icon: Sparkles, hint: "Paste project content" },
  { id: "import", label: "Import", icon: GithubIcon, hint: "Pull from a GitHub repo" },
  { id: "details", label: "Details", icon: SlidersHorizontal, hint: "Edit every field" },
  { id: "sections", label: "Sections", icon: FileCode2, hint: "Toggle sections on and off" },
  { id: "badges", label: "Badges", icon: BadgeCheck, hint: "Pick shields.io badges" },
  { id: "templates", label: "Style", icon: LayoutTemplate, hint: "Switch template" },
] as const;

type TabId = (typeof TABS)[number]["id"];
type ViewMode = "split" | "editor" | "preview";

const TEMPLATE_IDS = TEMPLATES.map((t) => t.id);

type AiStatus = {
  provider: "ollama" | "anthropic";
  ai: boolean;
  ollama?: { up: boolean; url: string; model: string; hasModel: boolean; models: string[] };
};

/** Split bounds, as a percentage of the editor+preview area. */
const SPLIT_MIN = 22;
const SPLIT_MAX = 78;
const clampSplit = (n: number) => Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, n));

const VIEWS = [
  { id: "split", label: "Split", icon: Columns2, key: "1" },
  { id: "editor", label: "Code", icon: PenLine, key: "2" },
  { id: "preview", label: "Preview", icon: Eye, key: "3" },
] as const;

function starterSpec(): ProjectSpec {
  const spec = emptySpec();
  spec.name = "Your Project";
  spec.tagline = "A one-line description that tells people what this does.";
  spec.description =
    "Start on the Dump tab: paste your package.json, a file tree, or a few source files and let Preface build the first draft. Every field stays editable afterwards.";
  return spec;
}

export default function BuilderPage() {
  const [spec, setSpec] = useState<ProjectSpec>(starterSpec);
  /**
   * Null means "markdown is derived from the spec". Once the user types in the
   * editor we hold their text here and stop regenerating until they rebuild.
   */
  const [override, setOverride] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("dump");
  const [view, setView] = useState<ViewMode>("split");
  const [ghTheme, setGhTheme] = useState<"light" | "dark">("dark");
  const [copied, setCopied] = useState(false);
  const [wrap, setWrap] = useState(false);
  const [splitPct, setSplitPct] = useState(50);
  const [dragging, setDragging] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const [dump, setDump] = useState("");
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);

  const hydrated = useRef(false);
  const gutterRef = useRef<HTMLDivElement>(null);
  const previewScrollRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const notify = useCallback((text: string, tone: ToastTone = "ok") => {
    setToast({ id: Date.now(), text, tone });
  }, []);

  // Restore the previous session. localStorage cannot be read in a state
  // initializer here because this component is prerendered on the server, so
  // reading it during render would produce a hydration mismatch.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    let restored: ProjectSpec | null = null;
    try {
      const raw =
        localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as {
          spec?: ProjectSpec;
          markdown?: string;
          manual?: boolean;
          dump?: string;
        };
        if (saved.spec) restored = saved.spec;
        if (saved.manual && saved.markdown) setOverride(saved.markdown);
        if (saved.dump) setDump(saved.dump);
      }
    } catch {
      // corrupt storage is not worth surfacing
    }

    /*
     * `?template=` deep link from the landing page. Read straight off
     * `location` rather than via useSearchParams, which would force this page
     * out of static rendering or require a Suspense boundary around it.
     * An explicit click beats whatever template the saved draft had.
     */
    let picked: TemplateId | null = null;
    try {
      const param = new URLSearchParams(window.location.search).get("template");
      if (param && TEMPLATE_IDS.includes(param as TemplateId)) {
        picked = param as TemplateId;
        // Drop the param so a later reload does not re-apply it over an edit.
        window.history.replaceState({}, "", window.location.pathname);
      }
    } catch {
      // malformed URL, nothing to apply
    }

    if (picked) {
      setSpec({ ...(restored ?? starterSpec()), template: picked });
      setTab("templates");
    } else if (restored) {
      setSpec(restored);
    }

    hydrated.current = true;
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Probe which optional integrations are usable right now.
  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((d: AiStatus) => {
        setAiStatus(d);
        setAiAvailable(Boolean(d.ai));
      })
      .catch(() => setAiAvailable(false));
  }, []);

  const aiLabel =
    aiStatus?.provider === "anthropic" ? "Claude" : (aiStatus?.ollama?.model ?? "Ollama");

  /** Why generation is unavailable, phrased as something the user can act on. */
  const aiHint = useMemo(() => {
    if (aiAvailable !== false) return null;
    if (!aiStatus) return "Could not reach the server to check AI availability.";
    if (aiStatus.provider === "anthropic") {
      return "Set ANTHROPIC_API_KEY in .env.local to enable Claude generation.";
    }
    const o = aiStatus.ollama;
    if (!o?.up) {
      return `Ollama is not running at ${o?.url ?? "the configured URL"}. Start it with "ollama serve".`;
    }
    if (!o.hasModel) {
      const have = o.models.length ? ` You have: ${o.models.slice(0, 4).join(", ")}.` : "";
      return `Ollama is running but has no model called "${o.model}". Pull it with "ollama pull ${o.model}", or set OLLAMA_MODEL to one you have.${have}`;
    }
    return "AI generation is unavailable.";
  }, [aiAvailable, aiStatus]);

  // Markdown is derived state, not stored state.
  const generated = useMemo(() => renderReadme(spec), [spec]);
  const markdown = override ?? generated;
  const manual = override !== null;

  // Persist.
  useEffect(() => {
    if (!hydrated.current) return;
    const id = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ spec, markdown, manual, dump }));
      } catch {
        // quota exceeded, not fatal
      }
    }, 400);
    return () => clearTimeout(id);
  }, [spec, markdown, manual, dump]);

  const applySpec = useCallback((next: ProjectSpec) => {
    setSpec(next);
    setOverride(null);
  }, []);

  const runAnalyze = useCallback(() => {
    setError(null);
    setBusy(true);
    try {
      const { spec: parsed, notes: n } = analyzeDump(dump);
      applySpec({ ...parsed, template: spec.template });
      setNotes(n.length ? n : ["Parsed the dump, but found little structure to work with."]);
      notify("Parsed locally");
    } catch {
      setError("Could not parse that content.");
      notify("Could not parse that content", "error");
    } finally {
      setBusy(false);
    }
  }, [dump, spec.template, applySpec, notify]);

  const runGenerate = useCallback(async () => {
    setError(null);
    setNotes([]);
    setBusy(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dump }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Generation failed.");
        notify(data.error ?? "Generation failed", "error");
        return;
      }
      applySpec({ ...data.spec, template: spec.template });
      setNotes(data.notes ?? []);
      notify(`Generated with ${data.provider === "anthropic" ? "Claude" : aiLabel}`);
    } catch {
      setError("Network error while contacting the server.");
      notify("Network error", "error");
    } finally {
      setBusy(false);
    }
  }, [dump, spec.template, applySpec, notify, aiLabel]);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      notify("Markdown copied to clipboard");
      setTimeout(() => setCopied(false), 1600);
    } catch {
      notify("Clipboard access was blocked", "error");
    }
  }, [markdown, notify]);

  const download = useCallback(() => {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "README.md";
    a.click();
    URL.revokeObjectURL(url);
    notify("README.md downloaded");
  }, [markdown, notify]);

  // Keyboard shortcuts. Save is the one people reach for by reflex, so it is
  // intercepted rather than left to the browser's save-page dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const k = e.key.toLowerCase();
      if (k === "s") {
        e.preventDefault();
        download();
      } else if (e.shiftKey && k === "c") {
        e.preventDefault();
        copy();
      } else if (k === "1" || k === "2" || k === "3") {
        e.preventDefault();
        setView(VIEWS[Number(k) - 1].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [download, copy]);

  // Pointer Events rather than mouse events, so one code path serves mouse,
  // touch and pen. The move/up listeners live on the window instead of using
  // setPointerCapture: capture throws if the pointer id is not currently
  // active, and a throw there would abort the drag before it started.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!draggingRef.current || !mainRef.current) return;
      const r = mainRef.current.getBoundingClientRect();
      setSplitPct(clampSplit(((e.clientX - r.left) / r.width) * 100));
    };
    const onUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      setDragging(false);
      document.body.classList.remove("resizing");
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      document.body.classList.remove("resizing");
    };
  }, []);

  const onSplitterDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // Suppress the native text selection / image drag that a press would start.
    e.preventDefault();
    draggingRef.current = true;
    setDragging(true);
    document.body.classList.add("resizing");
  }, []);

  /** Arrow keys nudge, Shift accelerates, Home/End jump, Enter recentres. */
  const onSplitterKey = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 10 : 2;
    const moves: Record<string, () => number> = {
      ArrowLeft: () => splitPct - step,
      ArrowRight: () => splitPct + step,
      Home: () => SPLIT_MIN,
      End: () => SPLIT_MAX,
      Enter: () => 50,
      " ": () => 50,
    };
    const next = moves[e.key];
    if (!next) return;
    e.preventDefault();
    setSplitPct(clampSplit(next()));
  }, [splitPct]);

  // Belt and braces: never leave the page stuck in the resizing cursor state.
  useEffect(() => () => document.body.classList.remove("resizing"), []);

  /** Keep the gutter locked to the text, and scroll the preview proportionally. */
  const onEditorScroll = useCallback((e: React.UIEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    if (gutterRef.current) gutterRef.current.scrollTop = el.scrollTop;

    const p = previewScrollRef.current;
    if (!p) return;
    const eMax = el.scrollHeight - el.clientHeight;
    const pMax = p.scrollHeight - p.clientHeight;
    if (eMax > 4 && pMax > 0) p.scrollTop = (el.scrollTop / eMax) * pMax;
  }, []);

  const lineCount = useMemo(() => markdown.split("\n").length, [markdown]);
  const stats = useMemo(() => {
    const words = markdown.trim() ? markdown.trim().split(/\s+/).length : 0;
    return { lines: lineCount, words, bytes: new Blob([markdown]).size };
  }, [markdown, lineCount]);

  const showEditor = view !== "preview";
  const showPreview = view !== "editor";

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-bg">
      {/* Repo-style header */}
      <header className="flex h-13 shrink-0 items-center gap-3 border-b border-line bg-inset px-4 py-2.5">
        <Link href="/" className="brand flex items-center gap-2 text-ink" title="Back to home">
          <span className="brand-mark">
            <PrefaceMark size={28} />
          </span>
        </Link>

        <span className="flex items-center gap-1.5 font-mono text-sm">
          <span className="text-accent">preface</span>
          <span className="text-faint">/</span>
          <span className="font-semibold text-ink">README.md</span>
        </span>

        <span className="hidden sm:block">
          <Label tone={manual ? "attention" : "success"}>
            {manual ? "edited" : templateMeta(spec.template).name}
          </Label>
        </span>

        <div className="ml-auto flex items-center gap-0.5 rounded-md border border-line bg-panel p-0.5">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              title={`${v.label} (Ctrl+${v.key})`}
              className={cx(
                "focus-ring btn-lift flex items-center gap-1.5 rounded-[4px] px-2.5 py-1 text-xs font-medium",
                view === v.id ? "bg-raised text-ink shadow-sm" : "text-dim hover:text-ink",
              )}
            >
              <v.icon size={13} />
              <span className="hidden md:inline">{v.label}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {manual ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setOverride(null);
                notify("Rebuilt from the form");
              }}
              title="Discard manual edits and rebuild from the form"
            >
              <RotateCcw size={13} />
              <span className="hidden lg:inline">Rebuild</span>
            </Button>
          ) : null}
          <button
            onClick={() => setGhTheme(ghTheme === "dark" ? "light" : "dark")}
            title={`Preview in ${ghTheme === "dark" ? "light" : "dark"} mode`}
            className="focus-ring btn-lift rounded-md border border-line bg-raised p-1.5 text-dim hover:border-faint hover:text-ink"
          >
            <span
              className="block transition-transform duration-300"
              style={{ transform: ghTheme === "dark" ? "rotate(0deg)" : "rotate(180deg)" }}
            >
              {ghTheme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
            </span>
          </button>
          <Button size="sm" onClick={copy} title="Copy markdown (Ctrl+Shift+C)">
            <span className={cx("grid place-items-center", copied && "pop-in")}>
              {copied ? <Check size={13} className="text-lime" /> : <Copy size={13} />}
            </span>
            <span className="hidden sm:inline">{copied ? "Copied!" : "Copy"}</span>
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={download}
            title="Download README.md (Ctrl+S)"
          >
            <Download size={13} />
            <span className="hidden sm:inline">Download</span>
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Tab rail */}
        <nav className="flex w-[4.25rem] shrink-0 flex-col items-stretch gap-0.5 border-r border-line bg-inset px-1.5 py-2">
          {TABS.map((t) => {
            const on = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cx(
                  "rail-item focus-ring press relative flex flex-col items-center gap-1 rounded-md py-2.5 text-[10px] font-medium transition-all duration-150",
                  on ? "bg-raised text-ink" : "text-faint hover:bg-panel hover:text-dim",
                )}
              >
                <span
                  aria-hidden
                  className={cx(
                    "absolute top-1.5 bottom-1.5 -left-1.5 w-[3px] rounded-r-full bg-[#fd8c73] transition-transform duration-200",
                    on ? "scale-y-100" : "scale-y-0",
                  )}
                />
                <t.icon size={16} />
                {t.label}
                <span className="rail-tip">{t.hint}</span>
              </button>
            );
          })}
        </nav>

        {/* Control panel */}
        <aside className="w-[23rem] shrink-0 overflow-y-auto border-r border-line bg-bg">
          <div className="sticky top-0 z-10 border-b border-line bg-panel">
            <div className="flex items-center gap-2 px-3 py-2">
              <span className="text-xs font-semibold text-ink">
                {TABS.find((t) => t.id === tab)?.label}
              </span>
              {busy ? (
                <span className="ml-auto flex items-center gap-1.5 text-[11px] text-dim">
                  <Loader2 size={12} className="spin" />
                  working
                </span>
              ) : null}
            </div>
            {busy ? <div className="shimmer-bar h-0.5 w-full bg-panel" /> : null}
          </div>

          <div key={tab} className="slide-in p-3">
            {tab === "dump" ? (
              <DumpPanel
                dump={dump}
                onDumpChange={setDump}
                onAnalyze={runAnalyze}
                onGenerate={runGenerate}
                aiAvailable={aiAvailable}
                aiLabel={aiLabel}
                aiHint={aiHint}
                busy={busy}
                notes={notes}
                error={error}
              />
            ) : null}
            {tab === "import" ? (
              <ImportPanel
                onDump={setDump}
                onImported={(s, n) => {
                  applySpec({ ...s, template: spec.template });
                  setNotes(n);
                  notify("Repository imported");
                }}
              />
            ) : null}
            {tab === "details" ? <DetailsPanel spec={spec} onSpec={applySpec} /> : null}
            {tab === "sections" ? <SectionsPanel spec={spec} onSpec={applySpec} /> : null}
            {tab === "badges" ? <BadgesPanel spec={spec} onSpec={applySpec} /> : null}
            {tab === "templates" ? <TemplatesPanel spec={spec} onSpec={applySpec} /> : null}
          </div>
        </aside>

        {/* Editor and preview */}
        <div ref={mainRef} className="flex min-w-0 flex-1">
          {showEditor ? (
            <section
              className="flex min-w-0 flex-col"
              style={view === "split" ? { width: `${splitPct}%`, flex: "none" } : { flex: "1 1 0%" }}
            >
              <div className="flex h-9 shrink-0 items-center gap-3 border-b border-line bg-panel px-3 text-[11px]">
                <span className="font-mono text-ink">README.md</span>
                <span className="hidden text-faint lg:inline">
                  {stats.lines} lines · {stats.words} words · {stats.bytes} B
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={() => setWrap((w) => !w)}
                    title={wrap ? "Disable word wrap" : "Enable word wrap (hides line numbers)"}
                    className={cx(
                      "focus-ring press flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors",
                      wrap ? "bg-raised text-ink" : "text-faint hover:text-dim",
                    )}
                  >
                    <WrapText size={12} />
                    wrap
                  </button>
                  <span className="flex items-center gap-1.5 text-faint">
                    <span
                      className={cx(
                        "h-1.5 w-1.5 rounded-full transition-colors",
                        manual ? "bg-amber" : "bg-lime",
                      )}
                    />
                    <span className="hidden sm:inline">
                      {manual ? "manually edited" : "synced with form"}
                    </span>
                  </span>
                </div>
              </div>

              <div className="flex min-h-0 flex-1">
                {/*
                 * The gutter draws one row per logical line, which only lines
                 * up while the text is not wrapping. With wrap on it would
                 * drift, so it is hidden rather than shown wrong.
                 */}
                {!wrap ? (
                  <div
                    ref={gutterRef}
                    aria-hidden
                    className="w-12 shrink-0 overflow-hidden border-r border-line bg-bg py-3 text-right font-mono text-[12.5px] leading-[1.6] text-[#484f58] select-none"
                  >
                    {Array.from({ length: lineCount }).map((_, i) => (
                      <div key={i} className="pr-2.5">
                        {i + 1}
                      </div>
                    ))}
                  </div>
                ) : null}
                <textarea
                  value={markdown}
                  spellCheck={false}
                  wrap={wrap ? "soft" : "off"}
                  onScroll={onEditorScroll}
                  onChange={(e) => setOverride(e.target.value)}
                  className={cx(
                    "min-h-0 flex-1 resize-none bg-bg px-3 py-3 font-mono text-[12.5px] leading-[1.6] text-ink outline-none",
                    wrap
                      ? "overflow-x-hidden whitespace-pre-wrap"
                      : "overflow-x-auto whitespace-pre",
                  )}
                />
              </div>
            </section>
          ) : null}

          {view === "split" ? (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize editor and preview"
              aria-valuenow={Math.round(splitPct)}
              aria-valuemin={SPLIT_MIN}
              aria-valuemax={SPLIT_MAX}
              tabIndex={0}
              data-dragging={dragging}
              onPointerDown={onSplitterDown}
              onKeyDown={onSplitterKey}
              onDoubleClick={() => setSplitPct(50)}
              title="Drag to resize. Focus and use arrow keys, Home, End, or Enter to reset."
              className="splitter focus-ring"
            />
          ) : null}

          {showPreview ? (
            <section className="flex min-w-0 flex-1 flex-col">
              <div className="flex h-9 shrink-0 items-center gap-3 border-b border-line bg-panel px-3 text-[11px]">
                <span className="font-semibold text-ink">Preview</span>
                <span className="hidden text-faint lg:inline">
                  {templateMeta(spec.template).name}
                </span>
                <span className="ml-auto flex items-center gap-1.5 text-faint">
                  <span
                    className={cx(
                      "h-1.5 w-1.5 rounded-full",
                      ghTheme === "dark" ? "bg-[#f0f6fc]" : "bg-amber",
                    )}
                  />
                  GitHub {ghTheme}
                </span>
              </div>
              <div key={spec.template} className="fade-in min-h-0 flex-1">
                <Preview markdown={markdown} theme={ghTheme} scrollRef={previewScrollRef} />
              </div>
            </section>
          ) : null}
        </div>
      </div>

      {/* Shortcut hints */}
      <div className="flex h-7 shrink-0 items-center gap-4 border-t border-line bg-inset px-4 text-[10px] text-faint">
        <span className="flex items-center gap-1.5">
          <span className="kbd">Ctrl</span>
          <span className="kbd">S</span>
          download
        </span>
        <span className="hidden items-center gap-1.5 sm:flex">
          <span className="kbd">Ctrl</span>
          <span className="kbd">Shift</span>
          <span className="kbd">C</span>
          copy
        </span>
        <span className="hidden items-center gap-1.5 md:flex">
          <span className="kbd">Ctrl</span>
          <span className="kbd">1-3</span>
          switch view
        </span>
        <span className="ml-auto hidden lg:block">
          {manual ? "editing markdown directly" : "form and markdown in sync"}
        </span>
      </div>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
