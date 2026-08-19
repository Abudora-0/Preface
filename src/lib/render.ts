import type { Badge, ProjectSpec, SectionKey } from "./types";

/**
 * Deterministic markdown renderer.
 *
 * Every template consumes the same ProjectSpec, so switching templates never
 * loses data. It only changes the presentation.
 */

type Block = { key: SectionKey; title: string; body: string };

/** GitHub-compatible heading anchor. */
export function slug(text: string): string {
  return text
    .trim()
    .toLowerCase()
  // Emoji and punctuation are removed by the next pass.
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function fence(code: string, lang = ""): string {
  const trimmed = code.replace(/\s+$/, "");
  // If the snippet itself contains a fence, widen ours so it survives.
  const needs = /^```/m.test(trimmed) ? "````" : "```";
  return `${needs}${lang}\n${trimmed}\n${needs}`;
}

function badgeMd(b: Badge): string {
  const img = `![${b.label}](${b.url})`;
  return b.href ? `[${img}](${b.href})` : img;
}

function badgeRow(badges: Badge[], sep = " "): string {
  return badges.map(badgeMd).join(sep);
}

/**
 * Markdown is not parsed inside raw HTML blocks, so any badge that sits inside
 * a <p>/<div> wrapper has to be emitted as a real <img> tag.
 */
function badgeHtml(b: Badge): string {
  const src = safeUrl(b.url);
  if (!src) return "";
  const img = `<img src="${src}" alt="${escHtml(b.label)}" />`;
  const href = safeUrl(b.href);
  return href ? `<a href="${href}">${img}</a>` : img;
}

function badgeRowHtml(badges: Badge[], sep = "\n  "): string {
  return badges.map(badgeHtml).filter(Boolean).join(sep);
}

function repoSlug(spec: ProjectSpec): string | undefined {
  const m = spec.repoUrl?.match(/github\.com\/([\w.-]+)\/([\w.-]+)/i);
  return m ? `${m[1]}/${m[2]}` : undefined;
}

/**
 * Joins lines, dropping only conditionals that evaluated away. Empty strings
 * are deliberate blank-line separators and must survive, because markdown depends on
 * them to separate headings, lists, tables and code fences.
 */
function nonEmpty(lines: (string | undefined | false)[]): string {
  return lines.filter((l) => l !== undefined && l !== false).join("\n");
}

function table(headers: string[], rows: string[][]): string {
  const head = `| ${headers.join(" | ")} |`;
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((r) => `| ${r.join(" | ")} |`).join("\n");
  return `${head}\n${sep}\n${body}`;
}

/**
 * Escapes text being written into a raw HTML context.
 *
 * Several templates build real HTML rather than markdown, and the values going
 * into it are not all the user's own: a repository imported by URL supplies its
 * description and homepage, and those belong to whoever owns that repository.
 * Unescaped, a description that closes its own tag writes arbitrary markup into
 * someone else's README.
 */
function escHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Returns a URL only if it is a well formed http(s) address.
 *
 * Escaping alone is not enough for a link target: an escaped but hostile URL is
 * still a hostile link. Anything else yields null so the caller can leave the
 * link out rather than emit one pointing nowhere. Markdown link syntax uses
 * this directly; HTML attributes go through safeUrlHtml.
 */
function httpUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.href;
  } catch {
    return null;
  }
}

/** httpUrl, escaped for an href or src attribute. */
function safeUrl(url: string | undefined): string | null {
  const ok = httpUrl(url);
  return ok === null ? null : escHtml(ok);
}

function esc(text: string): string {
  return text.replace(/\|/g, "\\|");
}

function runScript(spec: ProjectSpec, name: string): string {
  switch (spec.packageManager) {
    case "yarn":
      return `yarn ${name}`;
    case "pnpm":
      return `pnpm ${name}`;
    case "bun":
      return `bun run ${name}`;
    case "npm":
      return `npm run ${name}`;
    default:
      return name;
  }
}

// ---------------------------------------------------------------------------
// Section bodies (template-independent content, template-specific chrome)
// ---------------------------------------------------------------------------

type Chrome = {
  /** Emoji prefix for section headings, or empty string. */
  emoji: boolean;
  /** Use <details> collapsibles for long sections. */
  collapsible: boolean;
  /** Prefer tables over lists where either works. */
  tables: boolean;
};

const EMOJI: Partial<Record<SectionKey, string>> = {
  demo: "🔗",
  about: "📖",
  features: "✨",
  techStack: "🛠️",
  install: "🚀",
  usage: "💡",
  scripts: "📜",
  env: "🔐",
  structure: "🗂️",
  roadmap: "🗺️",
  contributing: "🤝",
  faq: "❓",
  license: "📄",
  acknowledgements: "🙏",
  author: "👤",
};

const TITLES: Record<SectionKey, string> = {
  badges: "Badges",
  toc: "Table of Contents",
  demo: "Links",
  about: "About",
  features: "Features",
  techStack: "Tech Stack",
  install: "Getting Started",
  usage: "Usage",
  scripts: "Scripts",
  env: "Environment Variables",
  structure: "Project Structure",
  roadmap: "Roadmap",
  contributing: "Contributing",
  faq: "FAQ",
  license: "License",
  acknowledgements: "Acknowledgements",
  author: "Author",
};

function heading(key: SectionKey, chrome: Chrome): string {
  const e = chrome.emoji ? EMOJI[key] : undefined;
  return e ? `${e} ${TITLES[key]}` : TITLES[key];
}

function buildBlocks(spec: ProjectSpec, chrome: Chrome): Block[] {
  const blocks: Block[] = [];
  const add = (key: SectionKey, body: string) => {
    if (!spec.sections[key]) return;
    const trimmed = body.trim();
    if (!trimmed) return;
    blocks.push({ key, title: heading(key, chrome), body: trimmed });
  };

  // Links
  const links: string[] = [];
  const demoLink = httpUrl(spec.demoUrl);
  const docsLink = httpUrl(spec.docsUrl);
  const repoLink = httpUrl(spec.repoUrl);
  if (demoLink) links.push(`- **Live demo**: <${demoLink}>`);
  if (docsLink) links.push(`- **Documentation**: <${docsLink}>`);
  if (repoLink) links.push(`- **Repository**: <${repoLink}>`);
  add("demo", links.join("\n"));

  // About
  add("about", spec.description);

  // Features
  if (spec.features.length) {
    // A table only reads well when most rows actually have a description;
    // otherwise it is a column of blanks and a list is better.
    const described = spec.features.filter((f) => f.desc).length;
    const body =
      chrome.tables && described >= Math.ceil(spec.features.length / 2)
        ? table(
            ["Feature", "Description"],
            spec.features.map((f) => [`**${esc(f.title)}**`, esc(f.desc ?? "")]),
          )
        : spec.features
            .map((f) => (f.desc ? `- **${f.title}**: ${f.desc}` : `- ${f.title}`))
            .join("\n");
    add("features", body);
  }

  // Tech stack
  if (spec.techStack.length) {
    const techBadges = spec.badges.filter(
      (b) => !["stars", "issues", "lastcommit", "license-dyn", "license-static"].includes(b.id),
    );
    const body = techBadges.length
      ? badgeRow(techBadges)
      : spec.techStack.map((t) => `- ${t}`).join("\n");
    add("techStack", body);
  }

  // Getting started
  {
    const parts: string[] = [];
    if (spec.prerequisites.length) {
      parts.push("### Prerequisites\n");
      parts.push(spec.prerequisites.map((p) => `- ${p}`).join("\n"));
      parts.push("");
    }
    if (spec.install.length) {
      parts.push("### Installation\n");
      parts.push(fence(spec.install.join("\n"), "bash"));
      parts.push("");
    }
    if (spec.runCmd) {
      parts.push("### Running locally\n");
      parts.push(fence(spec.runCmd, "bash"));
    }
    add("install", parts.join("\n"));
  }

  // Usage
  if (spec.usage) add("usage", fence(spec.usage, spec.usageLang || ""));

  // Scripts
  if (spec.scripts.length) {
    const body = table(
      ["Command", "Description"],
      spec.scripts.map((s) => [
        `\`${esc(runScript(spec, s.name))}\``,
        esc(s.desc ?? `Runs \`${s.cmd}\``),
      ]),
    );
    add("scripts", body);
  }

  // Env
  if (spec.env.length) {
    const intro = "Create a `.env` file in the project root:\n";
    const dotenv = fence(
      spec.env.map((e) => `${e.key}=${e.example ?? ""}`).join("\n"),
      "bash",
    );
    // Skip the reference table entirely when no variable has a description:
    // an all-blank column is worse than no table.
    const ref = spec.env.some((e) => e.desc)
      ? "\n\n" +
        table(
          ["Variable", "Description"],
          spec.env.map((e) => [`\`${esc(e.key)}\``, esc(e.desc ?? "")]),
        )
      : "";
    add("env", `${intro}\n${dotenv}${ref}`);
  }

  // Structure
  if (spec.structure) add("structure", fence(spec.structure, "text"));

  // Roadmap
  if (spec.roadmap.length) {
    add("roadmap", spec.roadmap.map((r) => `- [ ] ${r}`).join("\n"));
  }

  // Contributing
  {
    const repo = repoSlug(spec);
    const body = nonEmpty([
      "Contributions are welcome. To propose a change:",
      "",
      "1. Fork the repository",
      "2. Create a branch (`git checkout -b feature/your-feature`)",
      "3. Commit your changes (`git commit -m 'Add your feature'`)",
      "4. Push the branch (`git push origin feature/your-feature`)",
      "5. Open a pull request",
      repo && "",
      repo && `Please open an [issue](https://github.com/${repo}/issues) first for anything substantial.`,
    ]);
    add("contributing", body);
  }

  // FAQ
  if (spec.faq.length) {
    const body = chrome.collapsible
      ? spec.faq
          .map((f) => `<details>\n<summary><b>${escHtml(f.q)}</b></summary>\n\n${f.a}\n\n</details>`)
          .join("\n\n")
      : spec.faq.map((f) => `**${f.q}**\n\n${f.a}`).join("\n\n");
    add("faq", body);
  }

  // License
  {
    const repo = repoSlug(spec);
    const name = spec.license || "MIT";
    const link = repo ? `[LICENSE](https://github.com/${repo}/blob/main/LICENSE)` : "`LICENSE`";
    add("license", `Distributed under the ${name} License. See ${link} for details.`);
  }

  // Acknowledgements
  if (spec.acknowledgements.length) {
    add("acknowledgements", spec.acknowledgements.map((a) => `- ${a}`).join("\n"));
  }

  // Author
  if (spec.author) {
    const who = spec.authorUrl ? `[${spec.author}](${spec.authorUrl})` : `**${spec.author}**`;
    add("author", `Built by ${who}.`);
  }

  return blocks;
}

function toc(blocks: Block[]): string {
  return blocks
    .filter((b) => b.key !== "toc" && b.key !== "badges")
    .map((b) => `- [${b.title}](#${slug(b.title)})`)
    .join("\n");
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

function renderMinimal(spec: ProjectSpec): string {
  const chrome: Chrome = { emoji: false, collapsible: false, tables: false };
  const keep: SectionKey[] = ["about", "install", "usage", "license"];
  const scoped: ProjectSpec = {
    ...spec,
    sections: Object.fromEntries(
      Object.keys(spec.sections).map((k) => [k, keep.includes(k as SectionKey) && spec.sections[k as SectionKey]]),
    ) as ProjectSpec["sections"],
  };
  const blocks = buildBlocks(scoped, chrome);

  return nonEmpty([
    `# ${spec.name}`,
    "",
    spec.tagline,
    "",
    ...blocks.flatMap((b) => [`## ${b.title}`, "", b.body, ""]),
  ]).trim() + "\n";
}

function renderStandard(spec: ProjectSpec): string {
  const chrome: Chrome = { emoji: false, collapsible: false, tables: true };
  const blocks = buildBlocks(spec, chrome);

  const out: string[] = [`# ${spec.name}`, "", `> ${spec.tagline}`, ""];

  if (spec.sections.badges && spec.badges.length) {
    out.push(badgeRow(spec.badges), "");
  }
  if (spec.sections.toc && blocks.length > 2) {
    out.push("## Table of Contents", "", toc(blocks), "");
  }
  for (const b of blocks) {
    out.push(`## ${b.title}`, "", b.body, "");
  }
  return nonEmpty(out).trim() + "\n";
}

function renderShowcase(spec: ProjectSpec): string {
  const chrome: Chrome = { emoji: true, collapsible: true, tables: true };
  const blocks = buildBlocks(spec, chrome);
  const repo = repoSlug(spec);

  const out: string[] = ["<div align=\"center\">", ""];

  const logo = safeUrl(spec.logo);
  if (logo) {
    out.push(`<img src="${logo}" alt="${escHtml(spec.name)} logo" width="120" />`, "");
  }
  out.push(`<h1>${escHtml(spec.name)}</h1>`, "");
  out.push(`<p><i>${escHtml(spec.tagline)}</i></p>`, "");

  if (spec.sections.badges && spec.badges.length) {
    out.push(`<p>
  ${badgeRowHtml(spec.badges)}
</p>`, "");
  }

  const navLinks: string[] = [];
  const demo = safeUrl(spec.demoUrl);
  const docs = safeUrl(spec.docsUrl);
  if (demo) navLinks.push(`<a href="${demo}"><b>Live Demo</b></a>`);
  if (docs) navLinks.push(`<a href="${docs}"><b>Docs</b></a>`);
  if (repo) navLinks.push(`<a href="https://github.com/${repo}/issues"><b>Report Bug</b></a>`);
  if (repo) navLinks.push(`<a href="https://github.com/${repo}/issues"><b>Request Feature</b></a>`);
  if (navLinks.length) out.push(`<p>${navLinks.join(" · ")}</p>`, "");

  out.push("</div>", "", "---", "");

  if (spec.sections.toc && blocks.length > 2) {
    out.push("<details>", "<summary><b>Table of Contents</b></summary>", "", toc(blocks), "", "</details>", "");
  }

  for (const b of blocks) {
    out.push(`## ${b.title}`, "", b.body, "", "---", "");
  }

  out.push("<div align=\"center\">", "");
  out.push(`<sub>If this project helped you, consider leaving a star ⭐</sub>`, "");
  out.push("</div>");

  return nonEmpty(out).trim() + "\n";
}

function renderDocs(spec: ProjectSpec): string {
  const chrome: Chrome = { emoji: false, collapsible: false, tables: true };
  const blocks = buildBlocks(spec, chrome);

  const out: string[] = [`# ${spec.name}`, "", spec.tagline, ""];

  const meta: string[][] = [];
  if (spec.license) meta.push(["License", spec.license]);
  if (spec.languages.length) meta.push(["Language", spec.languages.join(", ")]);
  if (spec.packageManager !== "other") meta.push(["Package manager", spec.packageManager]);
  if (spec.repoUrl) meta.push(["Repository", spec.repoUrl]);
  if (meta.length) {
    out.push(table(["", ""], meta), "");
  }

  if (spec.sections.toc && blocks.length > 2) {
    out.push("## Contents", "", toc(blocks), "");
  }
  for (const b of blocks) {
    out.push(`## ${b.title}`, "", b.body, "");
  }
  return nonEmpty(out).trim() + "\n";
}

/**
 * Workspace-shaped README: the package table comes first, because the question
 * a monorepo README has to answer immediately is "what lives in here".
 */
function renderMonorepo(spec: ProjectSpec): string {
  const chrome: Chrome = { emoji: false, collapsible: false, tables: true };
  const blocks = buildBlocks(spec, chrome);
  const pick = (key: SectionKey) => blocks.find((b) => b.key === key);
  const repo = repoSlug(spec);

  const out: string[] = [`# ${spec.name}`, "", `> ${spec.tagline}`, ""];

  if (spec.sections.badges && spec.badges.length) out.push(badgeRow(spec.badges), "");
  if (spec.sections.about && spec.description) out.push(spec.description, "");

  if (spec.packages.length) {
    const hasPaths = spec.packages.some((p) => p.path);
    const headers = hasPaths ? ["Package", "Path", "Description"] : ["Package", "Description"];
    const rows = spec.packages.map((p) => {
      // Link the path to the directory on GitHub when we know the repo.
      const pathCell = p.path
        ? repo
          ? `[\`${esc(p.path)}\`](https://github.com/${repo}/tree/main/${p.path})`
          : `\`${esc(p.path)}\``
        : "";
      const name = `\`${esc(p.name)}\``;
      return hasPaths ? [name, pathCell, esc(p.desc ?? "")] : [name, esc(p.desc ?? "")];
    });
    out.push("## Packages", "", table(headers, rows), "");
  }

  for (const key of ["install", "usage", "scripts", "structure"] as const) {
    const b = pick(key);
    if (b) out.push(`## ${b.title}`, "", b.body, "");
  }

  for (const key of [
    "features",
    "env",
    "roadmap",
    "faq",
    "contributing",
    "license",
    "author",
  ] as const) {
    const b = pick(key);
    if (b) out.push(`## ${b.title}`, "", b.body, "");
  }

  return nonEmpty(out).trim() + "\n";
}

/**
 * Marketplace-shaped README for a GitHub Action: a workflow snippet people can
 * paste, then the inputs and outputs reference. The snippet is generated from
 * the declared inputs so it always matches the table below it.
 */
function renderAction(spec: ProjectSpec): string {
  const chrome: Chrome = { emoji: false, collapsible: false, tables: true };
  const blocks = buildBlocks(spec, chrome);
  const pick = (key: SectionKey) => blocks.find((b) => b.key === key);

  const repo = repoSlug(spec);
  const uses = spec.actionRef || (repo ? `${repo}@v1` : "owner/repo@v1");

  const out: string[] = [`# ${spec.name}`, "", `> ${spec.tagline}`, ""];

  if (spec.sections.badges && spec.badges.length) out.push(badgeRow(spec.badges), "");
  if (spec.sections.about && spec.description) out.push(spec.description, "");

  // Workflow snippet. Required inputs are shown uncommented, optional ones
  // commented out with their default, so the snippet works as pasted.
  const withLines = spec.inputs.map((i) => {
    const value = i.default ? i.default : i.desc ? `<${i.name}>` : '""';
    return i.required
      ? `    ${i.name}: ${value}`
      : `    # ${i.name}: ${value}`;
  });

  const snippet = [
    "steps:",
    `  - uses: actions/checkout@v4`,
    `  - name: ${spec.name}`,
    `    uses: ${uses}`,
    ...(withLines.length ? ["    with:", ...withLines.map((l) => l.replace(/^ {4}/, "      "))] : []),
  ].join("\n");

  out.push("## Usage", "", fence(snippet, "yaml"), "");

  if (spec.inputs.length) {
    out.push(
      "## Inputs",
      "",
      table(
        ["Name", "Description", "Required", "Default"],
        spec.inputs.map((i) => [
          `\`${esc(i.name)}\``,
          esc(i.desc ?? ""),
          i.required ? "yes" : "no",
          i.default ? `\`${esc(i.default)}\`` : "",
        ]),
      ),
      "",
    );
  }

  if (spec.outputs.length) {
    out.push(
      "## Outputs",
      "",
      table(
        ["Name", "Description"],
        spec.outputs.map((o) => [`\`${esc(o.name)}\``, esc(o.desc ?? "")]),
      ),
      "",
    );
  }

  if (spec.sections.usage && spec.usage) {
    out.push("## Example", "", fence(spec.usage, spec.usageLang || "yaml"), "");
  }

  for (const key of [
    "features",
    "roadmap",
    "faq",
    "contributing",
    "license",
    "author",
  ] as const) {
    const b = pick(key);
    if (b) out.push(`## ${b.title}`, "", b.body, "");
  }

  return nonEmpty(out).trim() + "\n";
}

/**
 * Terminal-shaped README: what to install, what to type, what each command
 * does. Scripts render as the command reference, since that is the closest
 * thing the spec already models to a subcommand list.
 */
function renderCli(spec: ProjectSpec): string {
  const chrome: Chrome = { emoji: false, collapsible: false, tables: true };
  const blocks = buildBlocks(spec, chrome);
  const pick = (key: SectionKey) => blocks.find((b) => b.key === key);

  const out: string[] = [`# ${spec.name}`, "", `> ${spec.tagline}`, ""];

  if (spec.sections.badges && spec.badges.length) out.push(badgeRow(spec.badges), "");
  if (spec.sections.about && spec.description) out.push(spec.description, "");

  if (spec.sections.install && spec.install.length) {
    out.push("## Install", "", fence(spec.install.join("\n"), "bash"), "");
  }

  // For a CLI the usage block is the headline, so it sits right after install.
  if (spec.sections.usage && spec.usage) {
    out.push("## Usage", "", fence(spec.usage, spec.usageLang || "bash"), "");
  } else if (spec.runCmd) {
    out.push("## Usage", "", fence(spec.runCmd, "bash"), "");
  }

  if (spec.sections.scripts && spec.scripts.length) {
    out.push(
      "## Commands",
      "",
      table(
        ["Command", "Description"],
        spec.scripts.map((s) => [`\`${esc(s.name)}\``, esc(s.desc ?? `Runs \`${s.cmd}\``)]),
      ),
      "",
    );
  }

  const env = pick("env");
  if (env) out.push("## Configuration", "", env.body, "");

  for (const key of [
    "features",
    "roadmap",
    "faq",
    "contributing",
    "license",
    "author",
  ] as const) {
    const b = pick(key);
    if (b) out.push(`## ${b.title}`, "", b.body, "");
  }

  return nonEmpty(out).trim() + "\n";
}

function renderProfile(spec: ProjectSpec): string {
  const handle = spec.repoUrl?.match(/github\.com\/([\w.-]+)/i)?.[1] ?? "your-handle";
  const techBadges = spec.badges.filter(
    (b) => !["stars", "issues", "lastcommit", "license-dyn", "license-static"].includes(b.id),
  );

  const out: string[] = [
    `<h1 align="center">Hi 👋, I'm ${escHtml(spec.author || spec.name)}</h1>`,
    "",
    `<h3 align="center">${escHtml(spec.tagline)}</h3>`,
    "",
  ];

  out.push("---", "");
  out.push("### 🧑‍💻 About Me", "");
  out.push(spec.description, "");

  if (spec.features.length) {
    out.push(
      ...spec.features.slice(0, 6).map((f) => `- ${f.desc ? `**${f.title}**: ${f.desc}` : f.title}`),
      "",
    );
  }

  if (techBadges.length) {
    out.push("### 🛠️ Tech Stack", "");
    out.push(`<p align="left">
  ${badgeRowHtml(techBadges)}
</p>`, "");
  }

  out.push("### 📊 GitHub Stats", "");
  out.push('<p align="center">');
  out.push(
    `  <img src="https://github-readme-stats.vercel.app/api?username=${handle}&show_icons=true&theme=tokyonight&hide_border=true" height="165" alt="stats" />`,
  );
  out.push(
    `  <img src="https://github-readme-stats.vercel.app/api/top-langs/?username=${handle}&layout=compact&theme=tokyonight&hide_border=true" height="165" alt="top languages" />`,
  );
  out.push("</p>", "");
  out.push(
    `<p align="center"><img src="https://github-readme-streak-stats.herokuapp.com/?user=${handle}&theme=tokyonight&hide_border=true" alt="streak" /></p>`,
    "",
  );

  const site = httpUrl(spec.demoUrl);
  const blog = httpUrl(spec.docsUrl);
  const profile = httpUrl(spec.authorUrl);
  if (site || blog || profile) {
    out.push("### 🌐 Find Me Online", "");
    const links: string[] = [];
    if (site) links.push(`[Website](${site})`);
    if (blog) links.push(`[Blog](${blog})`);
    if (profile) links.push(`[Profile](${profile})`);
    out.push(links.join(" · "), "");
  }

  out.push(
    `<p align="center"><img src="https://komarev.com/ghpvc/?username=${handle}&label=Profile%20views&color=0e75b6&style=flat" alt="profile views" /></p>`,
  );

  return nonEmpty(out).trim() + "\n";
}

export function renderReadme(spec: ProjectSpec): string {
  switch (spec.template) {
    case "minimal":
      return renderMinimal(spec);
    case "showcase":
      return renderShowcase(spec);
    case "docs":
      return renderDocs(spec);
    case "cli":
      return renderCli(spec);
    case "action":
      return renderAction(spec);
    case "monorepo":
      return renderMonorepo(spec);
    case "profile":
      return renderProfile(spec);
    case "standard":
    default:
      return renderStandard(spec);
  }
}
