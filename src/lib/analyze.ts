import { suggestBadges, techBadge, repoBadges } from "./badges";
import {
  emptySpec,
  type EnvVar,
  type Feature,
  type ProjectSpec,
  type Script,
} from "./types";

/**
 * Deterministic project analyzer.
 *
 * Takes an unstructured dump of project content (manifests, file trees, source
 * files, notes) and extracts as much structured metadata as it can without any
 * model call. This is what makes the builder useful with zero configuration.
 */

const EXT_LANG: Record<string, string> = {
  ts: "TypeScript",
  tsx: "TypeScript",
  js: "JavaScript",
  jsx: "JavaScript",
  mjs: "JavaScript",
  cjs: "JavaScript",
  py: "Python",
  rb: "Ruby",
  go: "Go",
  rs: "Rust",
  java: "Java",
  kt: "Kotlin",
  swift: "Swift",
  c: "C",
  h: "C",
  cpp: "C++",
  cc: "C++",
  hpp: "C++",
  cs: "C#",
  php: "PHP",
  dart: "Dart",
  vue: "Vue",
  svelte: "Svelte",
  html: "HTML",
  css: "CSS",
  scss: "Sass",
  sh: "Shell",
  sql: "SQL",
};

export type Analysis = {
  spec: ProjectSpec;
  /** Human-readable notes about what was detected. */
  notes: string[];
};

function stripFences(text: string): string {
  return text.replace(/^```[a-zA-Z0-9]*\s*$/gm, "");
}

/** Pull a balanced JSON object out of text, starting at `from`. */
function extractJsonAt(text: string, from: number): string | null {
  let depth = 0;
  let inStr = false;
  let escaped = false;
  for (let i = from; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(from, i + 1);
    }
  }
  return null;
}

type PackageJson = {
  name?: string;
  version?: string;
  description?: string;
  license?: string;
  author?: string | { name?: string; url?: string };
  homepage?: string;
  repository?: string | { url?: string };
  keywords?: string[];
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  workspaces?: string[] | { packages?: string[] };
};

function findPackageJson(text: string): PackageJson | null {
  // Look for an object that has the shape of a package.json.
  const candidates: number[] = [];
  const re = /\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) candidates.push(m.index);

  for (const idx of candidates) {
    const raw = extractJsonAt(text, idx);
    if (!raw || raw.length < 20) continue;
    if (!/"(name|scripts|dependencies|devDependencies)"\s*:/.test(raw))
      continue;
    try {
      const parsed = JSON.parse(raw) as PackageJson;
      if (parsed.name || parsed.scripts || parsed.dependencies) return parsed;
    } catch {
      // keep scanning
    }
  }
  return null;
}

const SCRIPT_DESCRIPTIONS: { test: RegExp; desc: string }[] = [
  { test: /^dev$|^start:dev$/, desc: "Start the development server" },
  { test: /^start$|^serve$/, desc: "Start the application" },
  { test: /^build$/, desc: "Create a production build" },
  { test: /^test/, desc: "Run the test suite" },
  { test: /^lint/, desc: "Lint the codebase" },
  { test: /^format|^fmt/, desc: "Format source files" },
  { test: /^typecheck|^tsc/, desc: "Type-check without emitting" },
  { test: /^migrate|^db:/, desc: "Run database migrations" },
  { test: /^seed/, desc: "Seed the database" },
  { test: /^deploy/, desc: "Deploy the application" },
  { test: /^clean/, desc: "Remove build artifacts" },
];

function describeScript(name: string): string | undefined {
  return SCRIPT_DESCRIPTIONS.find((s) => s.test.test(name))?.desc;
}

function parseRepo(text: string): string | undefined {
  const m = text.match(
    /github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:["'\s/)]|$)/i,
  );
  if (!m) return undefined;
  return `${m[1]}/${m[2]}`;
}

function detectLanguages(text: string): string[] {
  const counts = new Map<string, number>();
  const re = /[\w./-]+\.([a-zA-Z0-9]+)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const lang = EXT_LANG[m[1].toLowerCase()];
    if (lang) counts.set(lang, (counts.get(lang) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([lang]) => lang);
}

function detectEnvVars(text: string): EnvVar[] {
  const found = new Map<string, EnvVar>();

  // .env style assignments
  const envLine = /^\s*(?:export\s+)?([A-Z][A-Z0-9_]{2,})\s*=\s*(.*)$/gm;
  let m: RegExpExecArray | null;
  while ((m = envLine.exec(text)) !== null) {
    const key = m[1];
    const example = m[2].trim().replace(/^["']|["']$/g, "");
    if (!found.has(key)) {
      found.set(key, {
        key,
        example: example && example.length < 60 ? example : undefined,
      });
    }
  }

  // process.env.X / os.environ["X"] / os.getenv("X")
  const usages = [
    /process\.env\.([A-Z][A-Z0-9_]{2,})/g,
    /process\.env\[["']([A-Z][A-Z0-9_]{2,})["']\]/g,
    /os\.environ(?:\.get)?\[?\(?["']([A-Z][A-Z0-9_]{2,})["']/g,
    /os\.getenv\(\s*["']([A-Z][A-Z0-9_]{2,})["']/g,
    /ENV\[["']([A-Z][A-Z0-9_]{2,})["']\]/g,
  ];
  for (const re of usages) {
    while ((m = re.exec(text)) !== null) {
      if (!found.has(m[1])) found.set(m[1], { key: m[1] });
    }
  }

  return [...found.values()].slice(0, 20);
}

/**
 * Pulls the `inputs:` / `outputs:` blocks out of an action.yml.
 *
 * Deliberately a narrow reader rather than a YAML parser: it only understands
 * the two-level shape those blocks always take (a name, then description /
 * required / default beneath it), which keeps the dependency count at zero.
 * Folded and block scalars are skipped rather than mangled.
 */
function parseActionBlock(text: string, key: "inputs" | "outputs") {
  const start = new RegExp(`^${key}:[ \\t]*$`, "m").exec(text);
  if (!start) return [];

  const lines = text.slice(start.index + start[0].length).split(/\r?\n/);
  const entries: {
    name: string;
    desc?: string;
    required?: boolean;
    default?: string;
  }[] = [];
  let baseIndent: number | null = null;
  let current: (typeof entries)[number] | null = null;

  for (const raw of lines) {
    if (!raw.trim()) continue;
    const indent = raw.length - raw.trimStart().length;
    if (indent === 0) break; // dedented back out of the block

    const pair = raw.trim().match(/^([\w.-]+):\s*(.*)$/);
    if (!pair) continue;
    if (baseIndent === null) baseIndent = indent;

    if (indent === baseIndent) {
      current = { name: pair[1] };
      entries.push(current);
      continue;
    }
    if (!current) continue;

    const value = pair[2].trim().replace(/^['"]|['"]$/g, "");
    if (value === "|" || value === ">") continue;
    const field = pair[1].toLowerCase();
    if (field === "description") current.desc = value || undefined;
    else if (field === "required") current.required = value === "true";
    else if (field === "default") current.default = value || undefined;
  }

  return entries.filter((e) => e.name);
}

/** True when the dump smells like an action.yml rather than any other YAML. */
function looksLikeAction(text: string): boolean {
  return (
    /^runs:[ \t]*$/m.test(text) && /^(inputs|outputs|description):/m.test(text)
  );
}

/**
 * Every package.json-shaped object in the dump, paired with the `--- path ---`
 * header above it when one is present. People pasting a monorepo tend to
 * include several manifests, which is the signal this leans on.
 */
function findAllPackageJson(
  text: string,
): { pkg: PackageJson; path?: string }[] {
  const found: { pkg: PackageJson; path?: string }[] = [];
  const seen = new Set<string>();
  const re = /\{/g;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    const raw = extractJsonAt(text, m.index);
    if (!raw || raw.length < 20) continue;
    if (!/"(name|version|dependencies)"\s*:/.test(raw)) continue;
    let pkg: PackageJson;
    try {
      pkg = JSON.parse(raw) as PackageJson;
    } catch {
      continue;
    }
    if (!pkg.name || seen.has(pkg.name)) continue;
    seen.add(pkg.name);

    // Nearest preceding `--- some/path/package.json ---` marker, if any.
    const before = text.slice(Math.max(0, m.index - 400), m.index);
    const header = [
      ...before.matchAll(/---\s*([\w./@-]*?)package\.json\s*---/g),
    ].pop();
    const path = header?.[1]?.replace(/\/$/, "");
    found.push({ pkg, path: path || undefined });

    // Skip past this object so nested braces are not rescanned as manifests.
    re.lastIndex = m.index + raw.length;
  }
  return found;
}

/** Workspace globs declared in package.json or pnpm-workspace.yaml. */
function detectWorkspaceGlobs(
  text: string,
  root: PackageJson | null,
): string[] {
  const globs: string[] = [];
  const ws = root?.workspaces;
  if (Array.isArray(ws)) globs.push(...ws.filter((w) => typeof w === "string"));
  else if (ws && !Array.isArray(ws) && Array.isArray(ws.packages))
    globs.push(...ws.packages);

  if (/pnpm-workspace|^packages:/m.test(text)) {
    const block = /^packages:\s*$((?:\s*-\s*.+\s*)+)/m.exec(text);
    for (const line of block?.[1].split(/\r?\n/) ?? []) {
      const entry = line.trim().match(/^-\s*['"]?([^'"]+?)['"]?$/);
      if (entry) globs.push(entry[1].trim());
    }
  }
  return [...new Set(globs)].filter((g) => g.includes("*") || g.includes("/"));
}

function detectStructure(text: string): string | undefined {
  const lines = text.split(/\r?\n/);
  let best: string[] = [];
  let current: string[] = [];
  const treeChar = /[├└│]|^\s{2,}[\w.-]+\/?$/;
  for (const line of lines) {
    if (treeChar.test(line) && line.trim().length > 0) {
      current.push(line);
    } else {
      if (current.length > best.length) best = current;
      current = [];
    }
  }
  if (current.length > best.length) best = current;
  if (best.length < 4) return undefined;

  // A tree usually starts with an unindented root like `src/` on the line
  // before the first branch character; pull it in so the block makes sense.
  const firstIdx = lines.indexOf(best[0]);
  const prev = firstIdx > 0 ? lines[firstIdx - 1] : "";
  if (/^[\w.@-]+\/?\s*$/.test(prev)) best = [prev.trim(), ...best];

  return best.join("\n");
}

/**
 * One TOML table's body: the lines between its header and the next one.
 *
 * Deliberately not a TOML parser, in the same spirit as the action.yml reader
 * above. A dump is a pile of pasted fragments rather than a valid document, so
 * a real parser would reject the whole thing over one malformed line. This
 * reads the few keys worth having and ignores everything else.
 */
function tomlTable(text: string, header: string): string | null {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === header);
  if (start === -1) return null;

  const body: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].trim().startsWith("[")) break;
    body.push(lines[i]);
  }
  return body.join("\n");
}

/** Splits `key = value`, returning the value only for an exact key match. */
function tomlValue(line: string, key: string): string | null {
  const eq = line.indexOf("=");
  if (eq === -1) return null;
  if (line.slice(0, eq).trim() !== key) return null;
  return line.slice(eq + 1).trim();
}

/** A quoted value, or the `text` field of an inline table (PEP 621 license). */
function tomlString(table: string, key: string): string | undefined {
  for (const line of table.split(/\r?\n/)) {
    const value = tomlValue(line, key);
    if (value === null) continue;

    const quoted = /^"([^"]*)"/.exec(value);
    if (quoted) return quoted[1].trim() || undefined;

    const inline = /text\s*=\s*"([^"]*)"/.exec(value);
    if (inline) return inline[1].trim() || undefined;
  }
  return undefined;
}

/** First entry of an array of quoted strings, e.g. Cargo's `authors`. */
function tomlFirstOfArray(table: string, key: string): string | undefined {
  for (const line of table.split(/\r?\n/)) {
    const value = tomlValue(line, key);
    if (value === null) continue;
    const first = /"([^"]+)"/.exec(value);
    if (first) return first[1].trim() || undefined;
  }
  return undefined;
}

/** Dependency names from a table of `name = "^1.0"` or `name = { … }` lines. */
function tomlDepNames(table: string): string[] {
  const names: string[] = [];
  for (const line of table.split(/\r?\n/)) {
    const m = /^\s*([A-Za-z][\w.-]*)\s*=/.exec(line);
    if (m) names.push(m[1].toLowerCase());
  }
  return names;
}

type TomlManifest = {
  name?: string;
  description?: string;
  license?: string;
  repoUrl?: string;
  homepage?: string;
  author?: string;
  scripts: Script[];
  deps: string[];
};

/**
 * Reads the identity fields out of a Cargo.toml or a pyproject.toml.
 *
 * Without this a Rust or Python project came back titled "My Project": name,
 * description and license were read from package.json alone, so every
 * non-JavaScript dump lost the three fields a README most needs.
 */
function parseTomlManifest(text: string): TomlManifest | null {
  // Cargo's [package], PEP 621's [project], and Poetry's older [tool.poetry].
  const table =
    tomlTable(text, "[package]") ??
    tomlTable(text, "[project]") ??
    tomlTable(text, "[tool.poetry]");
  if (table === null) return null;

  const name = tomlString(table, "name");
  const description = tomlString(table, "description");
  if (!name && !description) return null;

  // Console entry points read as commands a user can actually run.
  const scripts: Script[] = [];
  for (const header of ["[project.scripts]", "[tool.poetry.scripts]"]) {
    const body = tomlTable(text, header);
    if (body === null) continue;
    for (const line of body.split(/\r?\n/)) {
      const m = /^\s*([A-Za-z][\w.-]*)\s*=\s*"[^"]+"/.exec(line);
      if (m) scripts.push({ name: m[1], cmd: m[1] });
    }
  }

  const deps = [
    ...tomlDepNames(tomlTable(text, "[dependencies]") ?? ""),
    ...tomlDepNames(tomlTable(text, "[tool.poetry.dependencies]") ?? ""),
  ];

  return {
    name,
    description,
    license: tomlString(table, "license"),
    repoUrl: tomlString(table, "repository"),
    homepage: tomlString(table, "homepage"),
    author: tomlFirstOfArray(table, "authors") ?? tomlString(table, "authors"),
    scripts: scripts.slice(0, 20),
    deps,
  };
}

function detectPythonDeps(text: string): string[] {
  const deps: string[] = [];
  const reqBlock = text.match(
    /(?:^|\n)([a-zA-Z0-9_.-]+(?:[=<>~!]=[\d.*]+)?\s*(?:\n[a-zA-Z0-9_.-]+(?:[=<>~!]=[\d.*]+)?\s*){2,})/,
  );
  if (reqBlock) {
    for (const line of reqBlock[1].split(/\r?\n/)) {
      const name = line.trim().split(/[=<>~!\[ ]/)[0];
      if (name && /^[a-zA-Z][\w.-]*$/.test(name)) deps.push(name.toLowerCase());
    }
  }
  const imports = /^\s*(?:from|import)\s+([a-zA-Z_][\w]*)/gm;
  let m: RegExpExecArray | null;
  while ((m = imports.exec(text)) !== null) deps.push(m[1].toLowerCase());
  return [...new Set(deps)];
}

function detectPackageManager(text: string): ProjectSpec["packageManager"] {
  if (/pnpm-lock\.yaml|\bpnpm (install|add|run)\b/.test(text)) return "pnpm";
  if (/\byarn\.lock\b|\byarn (add|install)\b/.test(text)) return "yarn";
  if (/\bbun\.lockb?\b|\bbun (install|add|run)\b/.test(text)) return "bun";
  if (/package-lock\.json|\bnpm (install|run|ci)\b|"dependencies"/.test(text))
    return "npm";
  if (/requirements\.txt|pyproject\.toml|\bpip install\b/.test(text))
    return "pip";
  if (/Cargo\.toml|\bcargo (build|run)\b/.test(text)) return "cargo";
  if (/\bgo\.mod\b|\bgo (build|run|mod)\b/.test(text)) return "go";
  return "other";
}

function installCommands(pm: ProjectSpec["packageManager"]): string[] {
  switch (pm) {
    case "npm":
      return ["npm install"];
    case "yarn":
      return ["yarn install"];
    case "pnpm":
      return ["pnpm install"];
    case "bun":
      return ["bun install"];
    case "pip":
      return [
        "python -m venv .venv",
        "source .venv/bin/activate",
        "pip install -r requirements.txt",
      ];
    case "cargo":
      return ["cargo build"];
    case "go":
      return ["go mod download"];
    default:
      return [];
  }
}

function runCommand(
  pm: ProjectSpec["packageManager"],
  scripts: Script[],
): string | undefined {
  const dev =
    scripts.find((s) => s.name === "dev") ??
    scripts.find((s) => s.name === "start");
  if (dev) {
    if (pm === "npm") return `npm run ${dev.name}`;
    if (pm === "yarn") return `yarn ${dev.name}`;
    if (pm === "pnpm") return `pnpm ${dev.name}`;
    if (pm === "bun") return `bun run ${dev.name}`;
  }
  if (pm === "cargo") return "cargo run";
  if (pm === "go") return "go run .";
  if (pm === "pip") return "python main.py";
  return undefined;
}

/** Grab the first fenced code block that looks like usage. */
function detectUsage(text: string): { code: string; lang: string } | undefined {
  const re = /```([a-zA-Z0-9]*)\r?\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  let best: { code: string; lang: string } | undefined;
  while ((m = re.exec(text)) !== null) {
    const lang = m[1] || "";
    const code = m[2].trim();
    if (code.length < 20 || code.length > 1200) continue;
    if (/^\s*[{[]/.test(code)) continue; // raw JSON
    if (
      /^(npm|yarn|pnpm|pip|cargo|go|git|docker)\b/m.test(code) &&
      code.split("\n").length < 5
    )
      continue;
    if (!best || code.length > best.code.length)
      best = { code, lang: lang || "bash" };
  }
  return best;
}

/** Split prose into candidate feature bullets. */
function detectFeatures(text: string): Feature[] {
  const out: Feature[] = [];
  const bullet = /^\s*[-*+]\s+(?:\[[ xX]\]\s*)?(.{6,140})$/gm;
  let m: RegExpExecArray | null;
  while ((m = bullet.exec(text)) !== null) {
    const line = m[1].trim();
    if (/^https?:\/\//.test(line)) continue;
    if (/^[\w.-]+\s*[:=]\s*[\d^~]/.test(line)) continue; // dependency line
    const split = line.match(/^\*\*(.+?)\*\*\s*[-–—:]?\s*(.*)$/);
    if (split)
      out.push({ title: split[1].trim(), desc: split[2].trim() || undefined });
    else out.push({ title: line });
    if (out.length >= 12) break;
  }
  return out;
}

function titleCase(s: string): string {
  return s
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export function analyzeDump(dump: string): Analysis {
  const spec = emptySpec();
  const notes: string[] = [];
  const text = dump;

  const pkg = findPackageJson(text);
  if (pkg) {
    notes.push("Parsed package.json");
    if (pkg.name) spec.name = titleCase(pkg.name.replace(/^@[^/]+\//, ""));
    if (pkg.description) {
      spec.tagline = pkg.description;
      spec.description = pkg.description;
    }
    if (pkg.license) spec.license = pkg.license;
    if (typeof pkg.author === "string")
      spec.author = pkg.author.replace(/\s*<.*$/, "").trim();
    else if (pkg.author?.name) {
      spec.author = pkg.author.name;
      spec.authorUrl = pkg.author.url;
    }
    if (pkg.homepage) spec.demoUrl = pkg.homepage;
    const repoUrl =
      typeof pkg.repository === "string" ? pkg.repository : pkg.repository?.url;
    if (repoUrl)
      spec.repoUrl = repoUrl.replace(/^git\+/, "").replace(/\.git$/, "");
    if (pkg.scripts) {
      spec.scripts = Object.entries(pkg.scripts)
        .filter(([, cmd]) => typeof cmd === "string")
        .slice(0, 20)
        .map(([name, cmd]) => ({ name, cmd, desc: describeScript(name) }));
    }
  }

  /*
   * Cargo.toml and pyproject.toml fill the same fields, but only where
   * package.json left a gap. A polyglot repo that ships both is still a
   * JavaScript package first, and the manifest naming the published artifact
   * should win over one describing a sidecar.
   */
  const toml = parseTomlManifest(text);
  if (toml) {
    notes.push("Parsed a Cargo or Python manifest");
    if (!spec.name && toml.name) spec.name = titleCase(toml.name);
    if (!spec.tagline && toml.description) {
      spec.tagline = toml.description;
      spec.description = toml.description;
    }
    if (!spec.license && toml.license) spec.license = toml.license;
    if (!spec.author && toml.author) {
      spec.author = toml.author.replace(/\s*<.*$/, "").trim();
    }
    if (!spec.demoUrl && toml.homepage) spec.demoUrl = toml.homepage;
    if (!spec.repoUrl && toml.repoUrl)
      spec.repoUrl = toml.repoUrl.replace(/\.git$/, "");
    if (!spec.scripts.length && toml.scripts.length)
      spec.scripts = toml.scripts;
  }

  if (!spec.repoUrl) {
    const repo = parseRepo(text);
    if (repo) spec.repoUrl = `https://github.com/${repo}`;
  }

  // Name fallbacks
  if (!spec.name) {
    const heading = text.match(/^\s*#\s+(.{2,60})$/m);
    if (heading) spec.name = heading[1].replace(/[#*`]/g, "").trim();
  }
  if (!spec.name && spec.repoUrl) {
    const seg = spec.repoUrl.split("/").filter(Boolean).pop();
    if (seg) spec.name = titleCase(seg);
  }
  if (!spec.name) spec.name = "My Project";

  // Dependencies -> tech stack
  const deps = new Set<string>();
  if (pkg) {
    for (const group of [
      pkg.dependencies,
      pkg.devDependencies,
      pkg.peerDependencies,
    ]) {
      for (const dep of Object.keys(group ?? {})) deps.add(dep.toLowerCase());
    }
  }
  for (const d of detectPythonDeps(text)) deps.add(d);
  for (const d of toml?.deps ?? []) deps.add(d);
  for (const kw of pkg?.keywords ?? []) deps.add(kw.toLowerCase());

  spec.languages = detectLanguages(text);
  for (const lang of spec.languages) deps.add(lang.toLowerCase());

  const matched = suggestBadges([...deps]);
  spec.techStack = matched.map((d) => d.label);
  spec.badges = matched.slice(0, 10).map((d) => techBadge(d));
  if (matched.length) notes.push(`Detected ${matched.length} technologies`);

  const repoSlug = spec.repoUrl ? parseRepo(spec.repoUrl) : undefined;
  spec.badges = [...repoBadges(repoSlug, spec.license), ...spec.badges];

  spec.packageManager = detectPackageManager(text);
  spec.install = installCommands(spec.packageManager);
  if (spec.repoUrl && spec.install.length) {
    const dir = spec.repoUrl.split("/").filter(Boolean).pop() ?? "project";
    spec.install = [
      `git clone ${spec.repoUrl}.git`,
      `cd ${dir}`,
      ...spec.install,
    ];
  }
  spec.runCmd = runCommand(spec.packageManager, spec.scripts);

  spec.env = detectEnvVars(text);
  if (spec.env.length)
    notes.push(`Found ${spec.env.length} environment variables`);

  const structure = detectStructure(text);
  if (structure) {
    spec.structure = structure;
    notes.push("Extracted project structure");
  }

  const usage = detectUsage(text);
  if (usage) {
    spec.usage = usage.code;
    spec.usageLang = usage.lang;
  }

  spec.features = detectFeatures(text);
  if (spec.features.length)
    notes.push(`Collected ${spec.features.length} feature bullets`);

  {
    const manifests = findAllPackageJson(text);
    const globs = detectWorkspaceGlobs(text, pkg);
    // The root manifest is not a workspace member, so drop it from the table.
    const members = manifests.filter((m) => m.pkg.name !== pkg?.name);

    if (members.length) {
      spec.packages = members.slice(0, 40).map((m) => ({
        name: m.pkg.name as string,
        path: m.path,
        desc: m.pkg.description,
      }));
      notes.push(`Found ${spec.packages.length} workspace packages`);
    } else if (globs.length) {
      notes.push(`Workspace globs declared: ${globs.join(", ")}`);
    }
  }

  if (looksLikeAction(text)) {
    spec.inputs = parseActionBlock(text, "inputs");
    spec.outputs = parseActionBlock(text, "outputs").map(({ name, desc }) => ({
      name,
      desc,
    }));

    // action.yml has its own name/description, which beat anything guessed.
    const actionName = text
      .match(/^name:\s*(.+)$/m)?.[1]
      ?.trim()
      .replace(/^['"]|['"]$/g, "");
    const actionDesc = text
      .match(/^description:\s*(.+)$/m)?.[1]
      ?.trim()
      .replace(/^['"]|['"]$/g, "");
    if (actionName) spec.name = actionName;
    if (actionDesc) {
      spec.tagline = actionDesc;
      if (!spec.description) spec.description = actionDesc;
    }

    notes.push(
      `Detected a GitHub Action: ${spec.inputs.length} inputs, ${spec.outputs.length} outputs`,
    );
  }

  if (!spec.tagline) {
    const stripped = stripFences(text);
    const prose = stripped
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find(
        (l) =>
          l.length > 30 &&
          l.length < 200 &&
          !/^[#>*\-|`]/.test(l) &&
          !/[{};=]/.test(l) &&
          /\s/.test(l),
      );
    if (prose) {
      spec.tagline = prose;
      if (!spec.description) spec.description = prose;
    }
  }
  if (!spec.tagline)
    spec.tagline = `A ${spec.languages[0] ?? "software"} project.`;
  if (!spec.description) spec.description = spec.tagline;

  // Turn off sections with nothing to show.
  spec.sections.env = spec.env.length > 0;
  spec.sections.structure = Boolean(spec.structure);
  spec.sections.scripts = spec.scripts.length > 0;
  spec.sections.features = spec.features.length > 0;
  spec.sections.usage = Boolean(spec.usage);
  spec.sections.techStack = spec.techStack.length > 0;
  spec.sections.demo = Boolean(spec.demoUrl);

  return { spec, notes };
}
