import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  ChevronRight,
  Columns2,
  FileText,
  KeyRound,
  LayoutTemplate,
  Star,
  Terminal,
  Wand2,
} from "lucide-react";

import ContribGraph from "@/components/ContribGraph";
import Reveal from "@/components/Reveal";
import SectionNav from "@/components/SectionNav";
import TypingDemo from "@/components/TypingDemo";
import PrefaceMark from "@/components/PrefaceMark";
import Wordmark from "@/components/Wordmark";
import { GithubIcon, Label } from "@/components/ui";
import { TEMPLATES } from "@/lib/templates";

const FEATURES = [
  {
    icon: Wand2,
    title: "Dump in, README out",
    body: "Paste a package.json, a file tree, or a pile of source files. Preface parses manifests, detects your stack, and pulls out scripts, environment variables and structure.",
    tag: "parser",
    tone: "success" as const,
  },
  {
    icon: Columns2,
    title: "Split-screen editing",
    body: "Markdown on the left, a GitHub-accurate preview on the right, in both light and dark theme. Form and markdown stay in sync until you take over.",
    tag: "editor",
    tone: "accent" as const,
  },
  {
    icon: GithubIcon,
    title: "Import from a repo",
    body: "Paste a GitHub URL. Description, license, language breakdown, topics and root manifests come back filled in.",
    tag: "import",
    tone: "done" as const,
  },
  {
    icon: BadgeCheck,
    title: "Badge builder",
    body: "Eighty shields.io badges across languages, frameworks, databases and infrastructure, plus live star, issue and last-commit badges.",
    tag: "badges",
    tone: "attention" as const,
  },
  {
    icon: LayoutTemplate,
    title: "Five distinct styles",
    body: "The same content rendered as a minimal library README, a conventional OSS layout, a loud showcase page, a dense reference doc, or a profile README.",
    tag: "templates",
    tone: "accent" as const,
  },
  {
    icon: KeyRound,
    title: "Works with no API key",
    body: "Analyzer, editor, preview, badges and templates are entirely local. Add an Anthropic key only if you want Claude to write the prose on top.",
    tag: "offline",
    tone: "success" as const,
  },
];

const STEPS = [
  {
    n: 1,
    t: "Dump or import",
    d: "Paste project content, or pull straight from a GitHub URL.",
    cmd: "preface import vercel/next.js",
  },
  {
    n: 2,
    t: "Generate",
    d: "Parse it locally in an instant, or hand it to Claude for the prose.",
    cmd: "analyze --local  # or --claude",
  },
  {
    n: 3,
    t: "Shape it",
    d: "Toggle sections, pick badges, switch template. Preview updates live.",
    cmd: "template set showcase",
  },
  {
    n: 4,
    t: "Ship it",
    d: "Copy to clipboard or download README.md. Nothing to sign up for.",
    cmd: "download README.md",
  },
];

const LANG_BAR = [
  { name: "TypeScript", pct: 71.4, color: "#3178c6" },
  { name: "CSS", pct: 19.2, color: "#663399" },
  { name: "JavaScript", pct: 9.4, color: "#f1e05a" },
];

export default function Home() {
  return (
    <div className="min-h-dvh">
      {/* ---------------------------------------------------------------- */}
      {/* Global nav: GitHub's near-black bar                              */}
      {/* ---------------------------------------------------------------- */}
      <header className="border-b border-line bg-inset">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-3">
          <Link href="/" className="brand flex items-center gap-2.5 text-ink">
            <span className="brand-mark">
              <PrefaceMark size={32} />
            </span>
            <Wordmark className="font-mono text-xl font-semibold tracking-tight" />
          </Link>

          <nav className="ml-3 hidden items-center gap-1 text-sm text-dim md:flex">
            <a href="#features" className="navlink focus-ring">
              Features
            </a>
            <a href="#templates" className="navlink focus-ring">
              Templates
            </a>
            <a href="#workflow" className="navlink focus-ring">
              Workflow
            </a>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-md border border-line bg-raised px-2.5 py-1 text-xs text-dim sm:inline-flex">
              <Star size={13} className="text-amber" />
              Star
              <span className="ml-1 border-l border-line pl-1.5 tabular-nums">1.2k</span>
            </span>
            <Link
              href="/builder"
              className="focus-ring btn-lift btn-glow group inline-flex items-center gap-1.5 rounded-md border border-[rgba(240,246,252,0.1)] bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-soft"
            >
              Open builder
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </header>

      <SectionNav
        counts={{
          features: FEATURES.length,
          templates: TEMPLATES.length,
          workflow: STEPS.length,
        }}
      />

      {/* ---------------------------------------------------------------- */}
      {/* Hero                                                              */}
      {/* ---------------------------------------------------------------- */}
      <section id="overview" className="mx-auto max-w-6xl scroll-mt-14 px-6 pt-14 pb-10">
        <div className="grid items-start gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <div
              className="mb-5 flex items-center gap-2 font-mono text-sm"
              style={{ animation: "gh-fade-up .5s cubic-bezier(.2,.7,.3,1) both" }}
            >
              <FileText size={15} className="text-dim" />
              <span className="text-accent">preface</span>
              <span className="text-faint">/</span>
              <span className="font-semibold text-ink">README.md</span>
              <Label tone="success">public</Label>
            </div>

            <h1
              className="text-4xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-5xl"
              style={{ animation: "gh-fade-up .5s cubic-bezier(.2,.7,.3,1) 60ms both" }}
            >
              Your code deserves a README
              <span className="text-lime"> people actually read.</span>
            </h1>

            <p
              className="mt-5 max-w-xl text-base leading-relaxed text-dim text-pretty"
              style={{ animation: "gh-fade-up .5s cubic-bezier(.2,.7,.3,1) 120ms both" }}
            >
              Dump your project in (manifests, file trees, half-written notes) and get back a
              structured README. Then shape it with a live GitHub-accurate preview, a badge
              builder, and five very different templates.
            </p>

            <div
              className="mt-7 flex flex-wrap items-center gap-3"
              style={{ animation: "gh-fade-up .5s cubic-bezier(.2,.7,.3,1) 180ms both" }}
            >
              <Link
                href="/builder"
                className="focus-ring btn-lift btn-glow inline-flex items-center gap-2 rounded-md border border-[rgba(240,246,252,0.1)] bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-soft"
              >
                <Terminal size={15} />
                Start writing
              </Link>
              <Link
                href="/builder"
                className="focus-ring btn-lift btn-shadow sheen inline-flex items-center gap-2 rounded-md border border-line bg-raised px-4 py-2.5 text-sm font-medium text-ink hover:border-faint hover:bg-[#262c36]"
              >
                <GithubIcon size={15} />
                Import a repo
              </Link>
            </div>

            {/* Language bar, like a repo sidebar */}
            <div
              className="mt-9 max-w-md"
              style={{ animation: "gh-fade-up .5s cubic-bezier(.2,.7,.3,1) 240ms both" }}
            >
              <div className="flex h-2 overflow-hidden rounded-full">
                {LANG_BAR.map((l) => (
                  <span
                    key={l.name}
                    title={`${l.name} ${l.pct}%`}
                    className="h-full transition-[flex-grow] duration-500"
                    style={{ background: l.color, flexGrow: l.pct }}
                  />
                ))}
              </div>
              <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-dim">
                {LANG_BAR.map((l) => (
                  <span key={l.name} className="inline-flex items-center gap-1.5">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: l.color }}
                    />
                    <span className="font-medium text-ink">{l.name}</span>
                    <span className="tabular-nums">{l.pct}%</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Contribution graph card */}
          <div
            className="rounded-md border border-line bg-bg p-4"
            style={{ animation: "gh-fade-up .55s cubic-bezier(.2,.7,.3,1) 200ms both" }}
          >
            <p className="mb-3 text-xs text-dim">
              <span className="font-semibold text-ink">1,284 READMEs</span> generated this year
            </p>
            <ContribGraph />
            <div className="mt-3 flex items-center gap-2 text-[11px] text-faint">
              <span>Less</span>
              {["#151b23", "#033a16", "#196c2e", "#2ea043", "#56d364"].map((c) => (
                <span
                  key={c}
                  className="h-[10px] w-[10px] rounded-[2px]"
                  style={{
                    background: c,
                    outline: c === "#151b23" ? "1px solid rgba(240,246,252,0.06)" : "none",
                    outlineOffset: "-1px",
                  }}
                />
              ))}
              <span>More</span>
            </div>
          </div>
        </div>

        {/* Live demo */}
        <Reveal className="mt-12">
          <TypingDemo />
        </Reveal>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Features                                                          */}
      {/* ---------------------------------------------------------------- */}
      <section id="features" className="mx-auto max-w-6xl scroll-mt-14 px-6 py-16">
        <Reveal>
          <div className="mb-8 flex items-end justify-between gap-4 border-b border-line pb-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Everything the first draft needs</h2>
              <p className="mt-1.5 text-sm text-dim">
                Preface does the mechanical work so the only thing left is the part that needs you.
              </p>
            </div>
            <Label tone="accent">{FEATURES.length} features</Label>
          </div>
        </Reveal>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 60}>
              <div className="lift sheen group h-full rounded-md border border-line bg-bg p-5">
                <div className="mb-3 flex items-center justify-between">
                  <span className="grid h-9 w-9 place-items-center rounded-md border border-line bg-panel text-dim transition-colors group-hover:border-faint group-hover:text-ink">
                    <f.icon size={17} />
                  </span>
                  <Label tone={f.tone}>{f.tag}</Label>
                </div>
                <h3 className="mb-1.5 text-sm font-semibold text-ink">{f.title}</h3>
                <p className="text-[13px] leading-relaxed text-dim">{f.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Templates: GitHub file-list rows                                 */}
      {/* ---------------------------------------------------------------- */}
      <section id="templates" className="mx-auto max-w-6xl scroll-mt-14 px-6 py-16">
        <Reveal>
          <div className="mb-8 flex items-end justify-between gap-4 border-b border-line pb-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">One spec, every template</h2>
              <p className="mt-1.5 text-sm text-dim">
                Switching template never loses content. The same structured data is re-rendered
                with different chrome.
              </p>
            </div>
            <Label tone="done">{TEMPLATES.length} templates</Label>
          </div>
        </Reveal>

        <Reveal>
          <div className="overflow-hidden rounded-md border border-line">
            <div className="flex items-center gap-2 border-b border-line bg-panel px-4 py-2.5 text-xs text-dim">
              <LayoutTemplate size={14} />
              <span className="font-semibold text-ink">src/lib/templates.ts</span>
              <span className="ml-auto hidden font-mono sm:inline">{TEMPLATES.length} objects</span>
            </div>
            <ul>
              {TEMPLATES.map((t, i) => (
                <li key={t.id}>
                  <Link
                    href={`/builder?template=${t.id}`}
                    className="group flex items-center gap-3 border-b border-line px-4 py-3 transition-colors last:border-b-0 hover:bg-panel"
                    style={{
                      animation: "gh-fade-up .4s cubic-bezier(.2,.7,.3,1) both",
                      animationDelay: `${i * 60}ms`,
                    }}
                  >
                    <FileText size={15} className="shrink-0 text-dim transition-colors group-hover:text-accent" />
                    <span className="w-36 shrink-0 truncate text-sm font-medium text-accent group-hover:underline">
                      {t.name}
                    </span>
                    <span className="hidden flex-1 truncate text-[13px] text-dim md:block">
                      {t.blurb}
                    </span>
                    <span className="ml-auto hidden shrink-0 font-mono text-[11px] text-faint lg:block">
                      {t.best}
                    </span>
                    <ChevronRight
                      size={15}
                      className="shrink-0 text-faint transition-transform duration-200 group-hover:translate-x-1 group-hover:text-ink"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Workflow: Actions-style pipeline                                 */}
      {/* ---------------------------------------------------------------- */}
      <section id="workflow" className="mx-auto max-w-6xl scroll-mt-14 px-6 py-16">
        <Reveal>
          <div className="mb-8 flex items-end justify-between gap-4 border-b border-line pb-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
              <p className="mt-1.5 text-sm text-dim">Four steps, about thirty seconds.</p>
            </div>
            <Label tone="success">{STEPS.length} jobs</Label>
          </div>
        </Reveal>

        <ol className="relative space-y-3">
          {/* Connector line */}
          <span
            aria-hidden
            className="absolute top-4 bottom-4 left-[15px] w-px bg-line"
          />
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 90} as="li">
              <div className="relative flex gap-4">
                <span className="relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line bg-panel text-xs font-semibold text-lime">
                  {s.n}
                </span>
                <div className="lift flex-1 rounded-md border border-line bg-bg p-4">
                  <h3 className="text-sm font-semibold text-ink">{s.t}</h3>
                  <p className="mt-1 text-[13px] text-dim">{s.d}</p>
                  <div className="mt-3 flex items-center gap-2 rounded-md border border-line bg-inset px-3 py-2 font-mono text-[11.5px] text-lime">
                    <span className="text-faint select-none">$</span>
                    {s.cmd}
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* CTA                                                               */}
      {/* ---------------------------------------------------------------- */}
      <section className="mx-auto max-w-6xl px-6 pt-4 pb-20">
        <Reveal>
          <div className="overflow-hidden rounded-md border border-line">
            <div className="border-b border-line bg-panel px-5 py-2.5 font-mono text-xs text-dim">
              README.md · 0 bytes
            </div>
            <div className="bg-bg px-6 py-12 text-center">
              <h2 className="text-2xl font-semibold tracking-tight text-balance">
                Stop shipping a README that just says the project name.
              </h2>
              <p className="mx-auto mt-3 max-w-lg text-sm text-dim text-pretty">
                No account, no upload, nothing to configure. Open the builder and paste something.
              </p>
              <Link
                href="/builder"
                className="focus-ring btn-lift btn-glow mt-7 inline-flex items-center gap-2 rounded-md border border-[rgba(240,246,252,0.1)] bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-soft"
              >
                Open the builder
                <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-line bg-inset">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
            <div>
              <Link href="/" className="brand mb-3 inline-flex items-center gap-2.5 text-ink">
                <span className="brand-mark">
                  <PrefaceMark size={26} />
                </span>
                <Wordmark className="font-mono text-lg font-semibold tracking-tight" />
              </Link>
              <p className="max-w-xs text-[13px] leading-relaxed text-dim">
                Dump your project in, get a well organised README out. No account, no upload,
                nothing to configure.
              </p>
            </div>

            <div>
              <h3 className="mb-3 text-xs font-semibold text-ink">Product</h3>
              <ul className="space-y-2 text-[13px] text-dim">
                <li>
                  <Link href="/builder" className="ulink transition-colors hover:text-ink">
                    Builder
                  </Link>
                </li>
                <li>
                  <a href="#templates" className="ulink transition-colors hover:text-ink">
                    Templates
                  </a>
                </li>
                <li>
                  <a href="#features" className="ulink transition-colors hover:text-ink">
                    Badges
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="mb-3 text-xs font-semibold text-ink">Learn</h3>
              <ul className="space-y-2 text-[13px] text-dim">
                <li>
                  <a href="#overview" className="ulink transition-colors hover:text-ink">
                    Overview
                  </a>
                </li>
                <li>
                  <a href="#features" className="ulink transition-colors hover:text-ink">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#workflow" className="ulink transition-colors hover:text-ink">
                    Workflow
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="mb-3 text-xs font-semibold text-ink">Status</h3>
              <ul className="space-y-2 text-[13px] text-dim">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-lime" />
                  Runs locally
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-lime" />
                  No API key needed
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  Claude pass optional
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-line pt-6 text-xs text-faint sm:flex-row">
            <span>Preface, a README generator and editor.</span>
            <span className="font-mono">built with next.js, tailwind and the claude api</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
