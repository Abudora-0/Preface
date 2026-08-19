"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  BADGE_CATALOG,
  BADGE_CATEGORIES,
  badgeById,
  repoBadges,
} from "@/lib/badges";
import { TEMPLATES } from "@/lib/templates";
import type { GenState } from "@/app/builder/page";
import { ALL_SECTIONS, type ProjectSpec, type TemplateId } from "@/lib/types";
import {
  Button,
  Callout,
  Field,
  SectionLabel,
  StringList,
  TextArea,
  TextInput,
  Toggle,
  cx,
} from "./ui";

const REPO_BADGE_IDS = [
  "stars",
  "issues",
  "lastcommit",
  "license-dyn",
  "license-static",
];

type PanelProps = {
  spec: ProjectSpec;
  onSpec: (next: ProjectSpec) => void;
};

// ---------------------------------------------------------------- Import ---

export function ImportPanel({
  onImported,
  onDump,
}: {
  onImported: (spec: ProjectSpec, notes: string[]) => void;
  onDump: (dump: string) => void;
}) {
  const [repo, setRepo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]);

  async function run() {
    if (!repo.trim()) return;
    setBusy(true);
    setError(null);
    setNotes([]);
    try {
      const res = await fetch("/api/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Import failed.");
        return;
      }
      if (data.dump) onDump(data.dump);
      onImported(data.spec, data.notes ?? []);
      setNotes(data.notes ?? []);
    } catch {
      setError("Network error while contacting the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Field
        label="GitHub repository"
        hint="Paste a repo URL or owner/name. Public repositories only."
      >
        <TextInput
          value={repo}
          onChange={setRepo}
          placeholder="vercel/next.js"
          mono
        />
      </Field>
      <Button variant="primary" onClick={run} disabled={busy || !repo.trim()}>
        {busy ? "Importing…" : "Import repository"}
      </Button>

      {error ? <Callout tone="error">{error}</Callout> : null}
      {notes.length ? (
        <Callout tone="ok">
          <ul className="space-y-1">
            {notes.map((n, i) => (
              <li key={i}>• {n}</li>
            ))}
          </ul>
        </Callout>
      ) : null}

      <Callout>
        Import pulls the description, license, language mix, topics and any root
        manifest (<code>package.json</code>, <code>requirements.txt</code>,{" "}
        <code>Cargo.toml</code>, <code>go.mod</code>, <code>.env.example</code>)
        and fills the form from them.
      </Callout>
    </div>
  );
}

// ------------------------------------------------------------------ Dump ---

/**
 * Live progress for the generation pass.
 *
 * The bar tracks how many schema fields the model has actually written, so it
 * only moves when real work lands. The elapsed clock runs separately, because
 * a long field means no field events for a while and a completely frozen
 * panel reads as a hang.
 */
function GenerationProgress({ progress }: { progress: GenState }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const tick = () =>
      setElapsed(Math.floor((Date.now() - progress.startedAt) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [progress.startedAt]);

  const pct =
    progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const clock = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;

  return (
    <div
      className="rounded-md border border-line bg-panel p-3"
      role="status"
      aria-live="polite"
    >
      <div className="mb-2 flex items-center gap-2 text-[12px]">
        <Loader2 size={13} className="spin text-brand" />
        <span className="text-ink">
          {progress.isPhase ? progress.field : `Writing ${progress.field}`}
        </span>
        <span className="ml-auto font-mono text-[11px] text-faint tabular-nums">
          {clock}
        </span>
      </div>

      <div className="h-1 w-full overflow-hidden rounded-full bg-inset">
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-500 ease-out"
          style={{ width: `${Math.max(pct, 2)}%` }}
        />
      </div>

      <p className="mt-2 text-[11px] text-faint">
        {progress.total > 0
          ? `${progress.done} of ${progress.total} fields written.`
          : "A small local model takes a minute or two to load and start writing."}
      </p>
    </div>
  );
}

export function DumpPanel({
  dump,
  onDumpChange,
  onAnalyze,
  onGenerate,
  aiAvailable,
  aiLabel,
  aiHint,
  busy,
  progress,
  notes,
  error,
}: {
  dump: string;
  onDumpChange: (v: string) => void;
  onAnalyze: () => void;
  onGenerate: () => void;
  aiAvailable: boolean | null;
  aiLabel: string;
  aiHint: string | null;
  busy: boolean;
  progress: GenState | null;
  notes: string[];
  error: string | null;
}) {
  const chars = dump.length;
  const [dropping, setDropping] = useState(false);

  /** Accept dropped text files so a manifest can be dragged straight in. */
  async function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDropping(false);
    const files = [...e.dataTransfer.files].slice(0, 8);
    if (!files.length) return;
    const parts: string[] = [];
    for (const f of files) {
      if (f.size > 2_000_000) continue;
      try {
        parts.push(`--- ${f.name} ---\n${await f.text()}`);
      } catch {
        // unreadable file, skip it
      }
    }
    if (parts.length)
      onDumpChange([dump, ...parts].filter(Boolean).join("\n\n"));
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDropping(true);
        }}
        onDragLeave={() => setDropping(false)}
        onDrop={onDrop}
        className={cx(
          "rounded-md transition-all duration-150",
          dropping && "ring-2 ring-brand ring-offset-2 ring-offset-[#0d1117]",
        )}
      >
        <Field
          label="Project content"
          hint="Dump anything, or drag files straight in: package.json, a file tree, source files, rough notes."
        >
          <TextArea
            value={dump}
            onChange={onDumpChange}
            rows={16}
            mono
            placeholder={`Paste or drop your package.json, file tree, source files, or notes here…

{
  "name": "my-api",
  "dependencies": { "express": "^4.19.0", "pg": "^8.11.0" }
}

src/
├── index.ts
└── routes/users.ts`}
          />
        </Field>
      </div>

      <div className="flex items-center justify-between text-xs text-faint">
        <span>
          {chars.toLocaleString()} characters
          {dropping ? (
            <span className="ml-2 text-lime">release to add files</span>
          ) : null}
        </span>
        {chars > 0 ? (
          <button className="hover:text-ink" onClick={() => onDumpChange("")}>
            Clear
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={onAnalyze} disabled={busy || chars < 20}>
          Analyze locally
        </Button>
        <Button
          variant="primary"
          onClick={onGenerate}
          disabled={busy || chars < 20 || aiAvailable === false}
          title={
            aiAvailable === false
              ? (aiHint ?? "AI generation is unavailable")
              : undefined
          }
        >
          {busy ? "Generating…" : `Generate with ${aiLabel}`}
        </Button>
      </div>

      {progress ? <GenerationProgress progress={progress} /> : null}

      {error ? <Callout tone="error">{error}</Callout> : null}
      {notes.length ? (
        <Callout tone="ok">
          <ul className="space-y-1">
            {notes.map((n, i) => (
              <li key={i}>• {n}</li>
            ))}
          </ul>
        </Callout>
      ) : null}

      {aiAvailable === false ? (
        <Callout tone="warn">
          {aiHint}
          <br />
          <strong>Analyze locally</strong> still works. It parses manifests,
          detects your stack, and fills the form with no model at all.
        </Callout>
      ) : (
        <Callout>
          <strong>Analyze locally</strong> is instant and offline.{" "}
          <strong>Generate with {aiLabel}</strong> runs the same analysis first,
          then writes the prose on top of it.
        </Callout>
      )}
    </div>
  );
}

// --------------------------------------------------------------- Details ---

export function DetailsPanel({ spec, onSpec }: PanelProps) {
  const set = <K extends keyof ProjectSpec>(key: K, value: ProjectSpec[K]) =>
    onSpec({ ...spec, [key]: value });

  return (
    <div className="space-y-5">
      <SectionLabel>Identity</SectionLabel>
      <Field label="Project name">
        <TextInput
          value={spec.name}
          onChange={(v) => set("name", v)}
          placeholder="Preface"
        />
      </Field>
      <Field
        label="Tagline"
        hint="One sentence shown directly under the title."
      >
        <TextInput
          value={spec.tagline}
          onChange={(v) => set("tagline", v)}
          placeholder="Generate a README worth reading"
        />
      </Field>
      <Field label="Description">
        <TextArea
          value={spec.description}
          onChange={(v) => set("description", v)}
          rows={4}
          placeholder="Two to four sentences on what this does and who it's for."
        />
      </Field>

      <SectionLabel>Links</SectionLabel>
      <Field label="Repository URL">
        <TextInput
          value={spec.repoUrl ?? ""}
          onChange={(v) => set("repoUrl", v)}
          mono
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Demo URL">
          <TextInput
            value={spec.demoUrl ?? ""}
            onChange={(v) => set("demoUrl", v)}
            mono
          />
        </Field>
        <Field label="Docs URL">
          <TextInput
            value={spec.docsUrl ?? ""}
            onChange={(v) => set("docsUrl", v)}
            mono
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Author">
          <TextInput
            value={spec.author ?? ""}
            onChange={(v) => set("author", v)}
          />
        </Field>
        <Field label="License">
          <TextInput
            value={spec.license ?? ""}
            onChange={(v) => set("license", v)}
            placeholder="MIT"
          />
        </Field>
      </div>

      <SectionLabel>Features</SectionLabel>
      <div className="space-y-2">
        {spec.features.map((f, i) => (
          <div
            key={i}
            className="rounded-lg border border-line bg-panel-2 p-2.5"
          >
            <div className="mb-1.5 flex gap-1.5">
              <input
                value={f.title}
                placeholder="Feature name"
                onChange={(e) => {
                  const next = [...spec.features];
                  next[i] = { ...next[i], title: e.target.value };
                  set("features", next);
                }}
                className="focus-ring w-full rounded-md border border-line bg-panel px-2.5 py-1.5 text-sm font-medium text-ink placeholder:text-faint"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  set(
                    "features",
                    spec.features.filter((_, j) => j !== i),
                  )
                }
              >
                ✕
              </Button>
            </div>
            <input
              value={f.desc ?? ""}
              placeholder="One-sentence description (optional)"
              onChange={(e) => {
                const next = [...spec.features];
                next[i] = { ...next[i], desc: e.target.value };
                set("features", next);
              }}
              className="focus-ring w-full rounded-md border border-line bg-panel px-2.5 py-1.5 text-xs text-dim placeholder:text-faint"
            />
          </div>
        ))}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => set("features", [...spec.features, { title: "" }])}
        >
          + Add feature
        </Button>
      </div>

      <SectionLabel>Installation</SectionLabel>
      <Field label="Prerequisites">
        <StringList
          items={spec.prerequisites}
          onChange={(v) => set("prerequisites", v)}
          placeholder="Node.js 20+"
          addLabel="Add prerequisite"
        />
      </Field>
      <Field label="Install commands" hint="One shell command per line.">
        <StringList
          items={spec.install}
          onChange={(v) => set("install", v)}
          placeholder="npm install"
          addLabel="Add command"
          mono
        />
      </Field>
      <Field label="Run command">
        <TextInput
          value={spec.runCmd ?? ""}
          onChange={(v) => set("runCmd", v)}
          mono
          placeholder="npm run dev"
        />
      </Field>

      <SectionLabel>Usage</SectionLabel>
      <div className="grid grid-cols-[1fr_7rem] gap-3">
        <Field label="Code example">
          <TextArea
            value={spec.usage ?? ""}
            onChange={(v) => set("usage", v)}
            rows={6}
            mono
            placeholder="import { thing } from 'my-lib'"
          />
        </Field>
        <Field label="Language">
          <TextInput
            value={spec.usageLang ?? ""}
            onChange={(v) => set("usageLang", v)}
            mono
            placeholder="ts"
          />
        </Field>
      </div>

      <SectionLabel>Scripts</SectionLabel>
      <div className="space-y-1.5">
        {spec.scripts.map((s, i) => (
          <div key={i} className="flex gap-1.5">
            <input
              value={s.name}
              placeholder="dev"
              onChange={(e) => {
                const next = [...spec.scripts];
                next[i] = { ...next[i], name: e.target.value };
                set("scripts", next);
              }}
              className="focus-ring w-28 shrink-0 rounded-md border border-line bg-panel-2 px-2.5 py-1.5 font-mono text-[13px] text-ink"
            />
            <input
              value={s.desc ?? ""}
              placeholder="What it does"
              onChange={(e) => {
                const next = [...spec.scripts];
                next[i] = { ...next[i], desc: e.target.value };
                set("scripts", next);
              }}
              className="focus-ring w-full rounded-md border border-line bg-panel-2 px-2.5 py-1.5 text-sm text-ink placeholder:text-faint"
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                set(
                  "scripts",
                  spec.scripts.filter((_, j) => j !== i),
                )
              }
            >
              ✕
            </Button>
          </div>
        ))}
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            set("scripts", [...spec.scripts, { name: "", cmd: "" }])
          }
        >
          + Add script
        </Button>
      </div>

      <SectionLabel>Environment variables</SectionLabel>
      <div className="space-y-1.5">
        {spec.env.map((e, i) => (
          <div key={i} className="flex gap-1.5">
            <input
              value={e.key}
              placeholder="API_KEY"
              onChange={(ev) => {
                const next = [...spec.env];
                next[i] = { ...next[i], key: ev.target.value };
                set("env", next);
              }}
              className="focus-ring w-40 shrink-0 rounded-md border border-line bg-panel-2 px-2.5 py-1.5 font-mono text-[13px] text-ink"
            />
            <input
              value={e.desc ?? ""}
              placeholder="What it's for"
              onChange={(ev) => {
                const next = [...spec.env];
                next[i] = { ...next[i], desc: ev.target.value };
                set("env", next);
              }}
              className="focus-ring w-full rounded-md border border-line bg-panel-2 px-2.5 py-1.5 text-sm text-ink placeholder:text-faint"
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                set(
                  "env",
                  spec.env.filter((_, j) => j !== i),
                )
              }
            >
              ✕
            </Button>
          </div>
        ))}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => set("env", [...spec.env, { key: "" }])}
        >
          + Add variable
        </Button>
      </div>

      {/* Same idea as the Action fields below: only show what applies. */}
      {spec.template === "monorepo" || spec.packages.length > 0 ? (
        <>
          <SectionLabel>Workspace packages</SectionLabel>
          <div className="space-y-1.5">
            {spec.packages.map((pkgEntry, i) => (
              <div
                key={i}
                className="slide-in rounded-md border border-line bg-panel p-2"
              >
                <div className="mb-1.5 flex gap-1.5">
                  <input
                    value={pkgEntry.name}
                    placeholder="@scope/package"
                    onChange={(e) => {
                      const next = [...spec.packages];
                      next[i] = { ...next[i], name: e.target.value };
                      set("packages", next);
                    }}
                    className="focus-ring w-full rounded-md border border-line bg-panel-2 px-2.5 py-1.5 font-mono text-[13px] text-ink"
                  />
                  <input
                    value={pkgEntry.path ?? ""}
                    placeholder="packages/core"
                    onChange={(e) => {
                      const next = [...spec.packages];
                      next[i] = { ...next[i], path: e.target.value };
                      set("packages", next);
                    }}
                    className="focus-ring w-36 shrink-0 rounded-md border border-line bg-panel-2 px-2.5 py-1.5 font-mono text-[11px] text-dim"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      set(
                        "packages",
                        spec.packages.filter((_, j) => j !== i),
                      )
                    }
                  >
                    X
                  </Button>
                </div>
                <input
                  value={pkgEntry.desc ?? ""}
                  placeholder="What this package does"
                  onChange={(e) => {
                    const next = [...spec.packages];
                    next[i] = { ...next[i], desc: e.target.value };
                    set("packages", next);
                  }}
                  className="focus-ring w-full rounded-md border border-line bg-panel-2 px-2.5 py-1.5 text-xs text-dim"
                />
              </div>
            ))}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => set("packages", [...spec.packages, { name: "" }])}
            >
              + Add package
            </Button>
          </div>
        </>
      ) : null}

      {/*
        Action fields are only meaningful for the Action template, so they stay
        out of the way unless it is selected or the analyzer already found an
        action.yml.
      */}
      {spec.template === "action" ||
      spec.inputs.length > 0 ||
      spec.outputs.length > 0 ? (
        <>
          <SectionLabel>Action inputs</SectionLabel>
          <div className="space-y-1.5">
            {spec.inputs.map((inp, i) => (
              <div
                key={i}
                className="slide-in rounded-md border border-line bg-panel p-2"
              >
                <div className="mb-1.5 flex gap-1.5">
                  <input
                    value={inp.name}
                    placeholder="who-to-greet"
                    onChange={(e) => {
                      const next = [...spec.inputs];
                      next[i] = { ...next[i], name: e.target.value };
                      set("inputs", next);
                    }}
                    className="focus-ring w-full rounded-md border border-line bg-panel-2 px-2.5 py-1.5 font-mono text-[13px] text-ink"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      set(
                        "inputs",
                        spec.inputs.filter((_, j) => j !== i),
                      )
                    }
                  >
                    ✕
                  </Button>
                </div>
                <input
                  value={inp.desc ?? ""}
                  placeholder="What this input controls"
                  onChange={(e) => {
                    const next = [...spec.inputs];
                    next[i] = { ...next[i], desc: e.target.value };
                    set("inputs", next);
                  }}
                  className="focus-ring mb-1.5 w-full rounded-md border border-line bg-panel-2 px-2.5 py-1.5 text-xs text-dim"
                />
                <div className="flex items-center gap-2">
                  <input
                    value={inp.default ?? ""}
                    placeholder="default value"
                    onChange={(e) => {
                      const next = [...spec.inputs];
                      next[i] = { ...next[i], default: e.target.value };
                      set("inputs", next);
                    }}
                    className="focus-ring w-full rounded-md border border-line bg-panel-2 px-2.5 py-1 font-mono text-[11px] text-dim"
                  />
                  <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[11px] text-dim">
                    <input
                      type="checkbox"
                      checked={Boolean(inp.required)}
                      onChange={(e) => {
                        const next = [...spec.inputs];
                        next[i] = { ...next[i], required: e.target.checked };
                        set("inputs", next);
                      }}
                      className="accent-[#238636]"
                    />
                    required
                  </label>
                </div>
              </div>
            ))}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => set("inputs", [...spec.inputs, { name: "" }])}
            >
              + Add input
            </Button>
          </div>

          <SectionLabel>Action outputs</SectionLabel>
          <div className="space-y-1.5">
            {spec.outputs.map((o, i) => (
              <div key={i} className="slide-in flex gap-1.5">
                <input
                  value={o.name}
                  placeholder="time"
                  onChange={(e) => {
                    const next = [...spec.outputs];
                    next[i] = { ...next[i], name: e.target.value };
                    set("outputs", next);
                  }}
                  className="focus-ring w-32 shrink-0 rounded-md border border-line bg-panel-2 px-2.5 py-1.5 font-mono text-[13px] text-ink"
                />
                <input
                  value={o.desc ?? ""}
                  placeholder="What it returns"
                  onChange={(e) => {
                    const next = [...spec.outputs];
                    next[i] = { ...next[i], desc: e.target.value };
                    set("outputs", next);
                  }}
                  className="focus-ring w-full rounded-md border border-line bg-panel-2 px-2.5 py-1.5 text-sm text-ink placeholder:text-faint"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    set(
                      "outputs",
                      spec.outputs.filter((_, j) => j !== i),
                    )
                  }
                >
                  ✕
                </Button>
              </div>
            ))}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => set("outputs", [...spec.outputs, { name: "" }])}
            >
              + Add output
            </Button>
          </div>

          <Field
            label="Action reference"
            hint="The value people put after uses:"
          >
            <TextInput
              value={spec.actionRef ?? ""}
              onChange={(v) => set("actionRef", v)}
              mono
              placeholder="owner/repo@v1"
            />
          </Field>
        </>
      ) : null}

      <SectionLabel>Project structure</SectionLabel>
      <Field label="File tree" hint="Rendered inside a code block.">
        <TextArea
          value={spec.structure ?? ""}
          onChange={(v) => set("structure", v)}
          rows={7}
          mono
          placeholder={"src/\n├── index.ts\n└── lib/"}
        />
      </Field>

      <SectionLabel>Roadmap</SectionLabel>
      <StringList
        items={spec.roadmap}
        onChange={(v) => set("roadmap", v)}
        placeholder="Add plugin support"
        addLabel="Add roadmap item"
      />

      <SectionLabel>FAQ</SectionLabel>
      <div className="space-y-2">
        {spec.faq.map((f, i) => (
          <div
            key={i}
            className="rounded-lg border border-line bg-panel-2 p-2.5"
          >
            <div className="mb-1.5 flex gap-1.5">
              <input
                value={f.q}
                placeholder="Question"
                onChange={(e) => {
                  const next = [...spec.faq];
                  next[i] = { ...next[i], q: e.target.value };
                  set("faq", next);
                }}
                className="focus-ring w-full rounded-md border border-line bg-panel px-2.5 py-1.5 text-sm font-medium text-ink"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  set(
                    "faq",
                    spec.faq.filter((_, j) => j !== i),
                  )
                }
              >
                ✕
              </Button>
            </div>
            <textarea
              value={f.a}
              rows={2}
              placeholder="Answer"
              onChange={(e) => {
                const next = [...spec.faq];
                next[i] = { ...next[i], a: e.target.value };
                set("faq", next);
              }}
              className="focus-ring w-full resize-y rounded-md border border-line bg-panel px-2.5 py-1.5 text-xs text-dim"
            />
          </div>
        ))}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => set("faq", [...spec.faq, { q: "", a: "" }])}
        >
          + Add question
        </Button>
      </div>
    </div>
  );
}

// -------------------------------------------------------------- Sections ---

export function SectionsPanel({ spec, onSpec }: PanelProps) {
  return (
    <div className="space-y-3">
      <Callout>
        Turn sections on or off. The table of contents and anchors update
        automatically.
      </Callout>
      <div className="space-y-0.5">
        {ALL_SECTIONS.map((s) => (
          <Toggle
            key={s.key}
            label={s.label}
            checked={spec.sections[s.key]}
            onChange={(v) =>
              onSpec({ ...spec, sections: { ...spec.sections, [s.key]: v } })
            }
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Badges ---

const BADGE_STYLES = [
  "for-the-badge",
  "flat",
  "flat-square",
  "plastic",
] as const;

export function BadgesPanel({ spec, onSpec }: PanelProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("All");
  const [style, setStyle] = useState<string>("for-the-badge");

  const selectedIds = useMemo(
    () =>
      spec.badges
        .filter((b) => !REPO_BADGE_IDS.includes(b.id))
        .map((b) => b.id),
    [spec.badges],
  );

  const repoSlug = spec.repoUrl?.match(/github\.com\/([\w.-]+\/[\w.-]+)/i)?.[1];
  const hasRepoBadges = spec.badges.some((b) => REPO_BADGE_IDS.includes(b.id));

  function rebuild(ids: string[], nextStyle = style, withRepo = hasRepoBadges) {
    const tech = ids
      .map((id) => badgeById(id, nextStyle))
      .filter(Boolean) as ProjectSpec["badges"];
    const repo = withRepo ? repoBadges(repoSlug, spec.license, nextStyle) : [];
    onSpec({ ...spec, badges: [...repo, ...tech] });
  }

  const visible = BADGE_CATALOG.filter((b) => {
    if (category !== "All" && b.category !== category) return false;
    if (!query.trim()) return true;
    return b.label.toLowerCase().includes(query.toLowerCase().trim());
  });

  return (
    <div className="space-y-4">
      <Field label="Badge style">
        <div className="inline-flex flex-wrap gap-0.5 rounded-md border border-line bg-panel p-0.5">
          {BADGE_STYLES.map((s) => (
            <button
              key={s}
              onClick={() => {
                setStyle(s);
                rebuild(selectedIds, s);
              }}
              className={cx(
                "focus-ring press rounded-[4px] px-2 py-1 font-mono text-[11px] transition-all duration-150",
                style === s
                  ? "bg-raised text-ink shadow-sm"
                  : "text-dim hover:text-ink",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </Field>

      <Toggle
        label="Repository badges (stars, issues, last commit, license)"
        checked={hasRepoBadges}
        onChange={(v) => rebuild(selectedIds, style, v)}
      />
      {hasRepoBadges && !repoSlug ? (
        <Callout tone="warn">
          Set a GitHub repository URL in <strong>Details</strong> for live star
          and issue counts. Until then only a static license badge is emitted.
        </Callout>
      ) : null}

      <Field label="Search technologies">
        <TextInput
          value={query}
          onChange={setQuery}
          placeholder="react, postgres, docker…"
        />
      </Field>

      <div className="flex flex-wrap gap-1">
        {["All", ...BADGE_CATEGORIES].map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={cx(
              "focus-ring press rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-all duration-150",
              category === c
                ? "border-[rgba(56,139,253,0.4)] bg-[rgba(56,139,253,0.15)] text-accent"
                : "border-line text-dim hover:border-faint hover:text-ink",
            )}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {visible.map((def, i) => {
          const on = selectedIds.includes(def.id);
          return (
            <button
              key={def.id}
              style={{ animationDelay: `${Math.min(i, 24) * 18}ms` }}
              onClick={() =>
                rebuild(
                  on
                    ? selectedIds.filter((id) => id !== def.id)
                    : [...selectedIds, def.id],
                )
              }
              className={cx(
                "focus-ring press fade-in flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all duration-150",
                on
                  ? "border-brand bg-[rgba(63,185,80,0.12)] text-ink"
                  : "border-line text-dim hover:border-faint hover:text-ink",
              )}
            >
              <span
                aria-hidden
                className={cx(
                  "h-2 w-2 shrink-0 rounded-full transition-transform duration-150",
                  on ? "scale-125" : "scale-100",
                )}
                style={{ background: `#${def.color}` }}
              />
              {def.label}
              {on ? <span className="text-lime">✓</span> : null}
            </button>
          );
        })}
        {visible.length === 0 ? (
          <p className="text-xs text-faint">
            No technologies match that search.
          </p>
        ) : null}
      </div>

      {spec.badges.length ? (
        <>
          <SectionLabel>Preview ({spec.badges.length})</SectionLabel>
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-line bg-white p-3">
            {spec.badges.map((b) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={b.id} src={b.url} alt={b.label} className="h-7" />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------- Templates ---

export function TemplatesPanel({ spec, onSpec }: PanelProps) {
  return (
    <div className="stagger space-y-2">
      {TEMPLATES.map((t, i) => {
        const active = spec.template === t.id;
        return (
          <button
            key={t.id}
            style={{ "--i": i } as React.CSSProperties}
            onClick={() => onSpec({ ...spec, template: t.id as TemplateId })}
            className={cx(
              "focus-ring press lift block w-full rounded-md border p-3 text-left",
              active
                ? "border-brand bg-[rgba(63,185,80,0.08)]"
                : "border-line bg-bg hover:bg-panel",
            )}
          >
            <div className="mb-1 flex items-center gap-2">
              {/* radio indicator */}
              <span
                aria-hidden
                className={cx(
                  "grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full border transition-colors duration-150",
                  active ? "border-brand" : "border-faint",
                )}
              >
                <span
                  className={cx(
                    "h-1.5 w-1.5 rounded-full bg-brand transition-transform duration-150",
                    active ? "scale-100" : "scale-0",
                  )}
                />
              </span>
              <span className="text-sm font-semibold text-ink">{t.name}</span>
              <span className="ml-auto font-mono text-[10px] text-faint">
                {t.id}
              </span>
            </div>
            <p className="mb-2 pl-5.5 text-xs leading-relaxed text-dim">
              {t.blurb}
            </p>
            <p className="pl-5.5 text-[11px] text-faint">
              <span className="text-lime">{t.vibe}</span> · Best for {t.best}
            </p>
          </button>
        );
      })}
    </div>
  );
}
