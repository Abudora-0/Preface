<div align="center">

<img src="src/app/icon.svg" alt="" width="76" height="76" />

<h1>Preface</h1>

<p><i>Dump your project in, get a well organised README out.</i></p>

<p>
  <img src="https://img.shields.io/github/actions/workflow/status/Abudora-0/Preface/ci.yml?style=for-the-badge&label=CI&labelColor=161b23" alt="CI status" />
  <img src="https://img.shields.io/badge/license-MIT-3fb950?style=for-the-badge" alt="MIT license" />
  <img src="https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript 5" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS 4" />
  <img src="https://img.shields.io/badge/Ollama-local-000000?style=for-the-badge&logo=ollama&logoColor=white" alt="Runs on local Ollama" />
  <img src="https://img.shields.io/badge/tests-99_passing-3fb950?style=for-the-badge" alt="99 tests passing" />
</p>

<p><b>No account. No API key. Nothing leaves your machine.</b></p>

</div>

---

Preface turns a pile of project material into a structured README. Paste a
`package.json`, a file tree, some source files or rough notes, and it parses what
it can, fills a form you control, and renders markdown through one of eight
templates, with a GitHub-accurate live preview beside it.

The parser, editor, preview, badge builder and templates all run locally. The
optional generation pass adds prose on top and runs against a local
[Ollama](https://ollama.com) model by default, so the whole thing works offline
and costs nothing.

## Contents

- [Why it works without a model](#why-it-works-without-a-model)
- [Features](#features)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Templates](#templates)
- [How it works](#how-it-works)
- [Tests](#tests)
- [Project Structure](#project-structure)
- [Implementation notes](#implementation-notes)
- [License](#license)

## Why it works without a model

Most README tools are a prompt wrapped in a text box. Preface is a parser first.

`analyze.ts` reads the dump and extracts the project name, description, license,
author, repository, scripts, environment variables, language mix, dependency list
and file tree, plus `action.yml` inputs and outputs and workspace packages. All
of that is deterministic and instant.

A model is only ever asked to improve the writing on top of that structure. Facts
come from the parser and are never overwritten, which is what makes a small local
model a reasonable choice: a weaker model produces flatter prose, not invented
dependencies.

## Features

| Feature | Detail |
| --- | --- |
| **Dump in, README out** | Parses manifests for npm, pnpm, yarn, bun, pip, cargo and go, then detects the stack, scripts, env vars and structure |
| **Import from GitHub** | Paste a repo URL to pull description, license, language breakdown, topics and root manifests |
| **Live preview** | GitHub-accurate rendering in both light and dark theme, with raw HTML allowed and sanitised |
| **Badge builder** | Around eighty shields.io badges across languages, frameworks, databases and infrastructure, in four styles |
| **Eight templates** | The same structured data rendered eight ways, switchable without losing content |
| **Split editing** | Resizable panes driven by mouse, touch, pen or keyboard, with scroll sync and line numbers |
| **Optional AI pass** | Local Ollama by default, Claude behind an explicit opt-in |

## Getting Started

### Prerequisites

- Node.js 20 or newer
- [Ollama](https://ollama.com), optional, only for the generation pass

### Installation

```bash
npm install
npm run dev
```

The app is then at <http://localhost:3000>.

### Optional: the generation pass

```bash
ollama serve
ollama pull qwen2.5:1.5b
```

The status endpoint asks the daemon directly whether it is running and whether
the configured model is present, so the builder tells you which of those is
missing instead of failing when you press Generate.

## Configuration

Everything is optional. Copy `.env.local.example` to `.env.local` to change any
of it.

| Variable | Default | Purpose |
| --- | --- | --- |
| `OLLAMA_URL` | `http://127.0.0.1:11434` | Where the local Ollama daemon is listening |
| `OLLAMA_MODEL` | `qwen2.5:1.5b` | The model to generate with. Must already be pulled. |
| `AI_PROVIDER` | `ollama` | Set to `anthropic` to use Claude instead |
| `ANTHROPIC_API_KEY` | unset | Only read when `AI_PROVIDER=anthropic` |
| `GITHUB_TOKEN` | unset | Raises repo import from 60 to 5000 requests per hour |

`AI_PROVIDER=anthropic` is required to use Claude even when a key is already
present in the environment. A key can be exported by an unrelated tool, and
billing an API because of an ambient variable is not a decision this app makes
for you.

## Templates

| Template | Best for |
| --- | --- |
| Minimal | Libraries and anything small |
| Standard OSS | Most public repositories |
| Showcase | Portfolio projects and launches |
| Documentation | SDKs, APIs, internal tooling |
| CLI tool | Command line tools and dev utilities |
| GitHub Action | Anything published to the Actions marketplace |
| Monorepo | Workspaces with several published packages |
| Profile README | `github.com/<you>/<you>` |

Two of these carry their own data. Paste or import an `action.yml` and the inputs
and outputs tables fill themselves, then the workflow snippet is generated from
those same inputs so the two cannot drift apart. Paste a workspace and its member
manifests and the package table fills itself, with the root manifest excluded.

## How it works

Everything flows through one `ProjectSpec` object:

```text
dump / repo ──▶ analyzer ──▶ ProjectSpec ──▶ renderer ──▶ markdown
                    │            ▲
              (optional)         │
            Ollama / Claude ─────┘
```

- **`src/lib/analyze.ts`** is the deterministic extraction described above.
- **`src/lib/ai.ts`** is the optional model pass, provider agnostic. It runs the
  analyzer first and feeds the result to the model as grounding, then merges:
  facts from the parser win, prose from the model wins.
- **`src/lib/render.ts`** turns a `ProjectSpec` into markdown. Switching template
  never loses data because all eight render the same spec.

## Tests

The analyzer, renderer and merge logic are pure functions, so they are covered
directly with vitest:

```bash
npm test
npm run test:watch
```

The suite pins the behaviours that are easy to break by accident: blank line
separation in generated markdown, badges emitting real `<img>` tags inside HTML
blocks, table versus list fallbacks, anchors resolving to headings that exist,
the `action.yml` and workspace readers, and the rule that a model can never
rewrite a real script command.

## Project Structure

```text
src/
├── app/
│   ├── api/
│   │   ├── generate/    Model pass, Ollama or Claude
│   │   ├── github/      Repo import
│   │   └── status/      Which integrations are usable right now
│   ├── builder/         The split-screen workspace
│   ├── apple-icon.tsx   180x180 touch icon, generated with next/og
│   ├── icon.svg         Favicon (the pilcrow mark)
│   ├── globals.css      Design tokens, motion, GitHub markdown styles
│   └── page.tsx         Landing page
├── components/
│   ├── ContribGraph.tsx Animated contribution heatmap
│   ├── PrefaceMark.tsx  Brand mark (geometric pilcrow)
│   ├── Preview.tsx      Sanitised GitHub-accurate markdown renderer
│   ├── Reveal.tsx       Scroll reveal wrapper
│   ├── SectionNav.tsx   Scroll-synced repo-style tabs
│   ├── Toast.tsx        Transient action confirmations
│   ├── TypingDemo.tsx   Live markdown-to-preview demo
│   ├── Wordmark.tsx     Per-letter animated wordmark
│   ├── panels.tsx       Import / Dump / Details / Sections / Badges / Style
│   └── ui.tsx           Buttons, boxes, fields, toggles
└── lib/
    ├── ai.ts            Provider-agnostic model pass and spec merge
    ├── analyze.ts       Deterministic project analyzer
    ├── badges.ts        ~80 shields.io badge definitions
    ├── render.ts        ProjectSpec -> markdown, eight templates
    ├── templates.ts     Template metadata
    └── types.ts         ProjectSpec and section keys
```

## Implementation notes

A few things that are easy to get wrong and worth knowing before editing.

**Markdown is not parsed inside raw HTML blocks.** Templates that wrap badges in
a `<p>` emit real `<img>` tags rather than markdown image syntax, otherwise they
render as literal `![Stars](…)` text on GitHub. The badge row at the top of this
file follows the same rule.

**Base element resets live inside `@layer base`.** Unlayered CSS outranks
anything in a layer regardless of specificity, so a bare `textarea { … }` rule
silently beats Tailwind's `font-mono` utility.

**The line-number gutter draws one row per logical line**, so it is only correct
while soft wrap is off. Toggling wrap on hides the gutter rather than showing
numbers that drift.

**Local models get a smaller dump.** The budget scales with parameter count, 8k
characters at 1.5B up to 40k above 9B, against 180k for Claude. Ollama silently
drops anything past `num_ctx` rather than erroring, and small models lose the
thread well before they run out of context.

## License

[MIT](LICENSE)
