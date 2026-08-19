export type Badge = {
  id: string;
  label: string;
  /** Full shields.io image URL */
  url: string;
  /** Optional link target */
  href?: string;
};

export type Script = { name: string; cmd: string; desc?: string };
export type EnvVar = { key: string; desc?: string; example?: string };
export type FaqItem = { q: string; a: string };
export type Feature = { title: string; desc?: string };

/** A GitHub Action input, as declared under `inputs:` in action.yml. */
export type ActionInput = {
  name: string;
  desc?: string;
  required?: boolean;
  default?: string;
};

/** One workspace member of a monorepo. */
export type PackageEntry = { name: string; path?: string; desc?: string };

/** A GitHub Action output, as declared under `outputs:` in action.yml. */
export type ActionOutput = { name: string; desc?: string };

export type SectionKey =
  | "badges"
  | "toc"
  | "demo"
  | "about"
  | "features"
  | "techStack"
  | "install"
  | "usage"
  | "scripts"
  | "env"
  | "structure"
  | "roadmap"
  | "contributing"
  | "faq"
  | "license"
  | "acknowledgements"
  | "author";

export const ALL_SECTIONS: { key: SectionKey; label: string }[] = [
  { key: "badges", label: "Badges" },
  { key: "toc", label: "Table of contents" },
  { key: "demo", label: "Demo / links" },
  { key: "about", label: "About" },
  { key: "features", label: "Features" },
  { key: "techStack", label: "Tech stack" },
  { key: "install", label: "Installation" },
  { key: "usage", label: "Usage" },
  { key: "scripts", label: "Scripts" },
  { key: "env", label: "Environment variables" },
  { key: "structure", label: "Project structure" },
  { key: "roadmap", label: "Roadmap" },
  { key: "contributing", label: "Contributing" },
  { key: "faq", label: "FAQ" },
  { key: "license", label: "License" },
  { key: "acknowledgements", label: "Acknowledgements" },
  { key: "author", label: "Author" },
];

export const TEMPLATE_IDS = [
  "minimal",
  "standard",
  "showcase",
  "docs",
  "cli",
  "action",
  "monorepo",
  "profile",
] as const;

export type TemplateId = (typeof TEMPLATE_IDS)[number];

export const PACKAGE_MANAGERS = [
  "npm",
  "yarn",
  "pnpm",
  "bun",
  "pip",
  "cargo",
  "go",
  "other",
] as const;

export type ProjectSpec = {
  name: string;
  tagline: string;
  description: string;
  logo?: string;
  repoUrl?: string;
  demoUrl?: string;
  docsUrl?: string;
  author?: string;
  authorUrl?: string;
  license?: string;
  languages: string[];
  techStack: string[];
  features: Feature[];
  prerequisites: string[];
  install: string[];
  runCmd?: string;
  usage?: string;
  usageLang?: string;
  scripts: Script[];
  env: EnvVar[];
  structure?: string;
  roadmap: string[];
  faq: FaqItem[];
  acknowledgements: string[];
  /** Populated for the Monorepo template. */
  packages: PackageEntry[];
  /** Populated for the GitHub Action template. */
  inputs: ActionInput[];
  outputs: ActionOutput[];
  /** e.g. `owner/repo@v1`, the value people put after `uses:`. */
  actionRef?: string;
  packageManager: (typeof PACKAGE_MANAGERS)[number];
  badges: Badge[];
  sections: Record<SectionKey, boolean>;
  template: TemplateId;
};

export const DEFAULT_SECTIONS: Record<SectionKey, boolean> = {
  badges: true,
  toc: true,
  demo: true,
  about: true,
  features: true,
  techStack: true,
  install: true,
  usage: true,
  scripts: true,
  env: true,
  structure: true,
  roadmap: false,
  contributing: true,
  faq: false,
  license: true,
  acknowledgements: false,
  author: true,
};

export function emptySpec(): ProjectSpec {
  return {
    name: "",
    tagline: "",
    description: "",
    languages: [],
    techStack: [],
    features: [],
    prerequisites: [],
    install: [],
    scripts: [],
    env: [],
    roadmap: [],
    faq: [],
    acknowledgements: [],
    packages: [],
    inputs: [],
    outputs: [],
    packageManager: "npm",
    badges: [],
    sections: { ...DEFAULT_SECTIONS },
    template: "standard",
  };
}

/** Array fields of ProjectSpec. Every one of them defaults to `[]`. */
const ARRAY_KEYS = [
  "languages",
  "techStack",
  "features",
  "prerequisites",
  "install",
  "scripts",
  "env",
  "roadmap",
  "faq",
  "acknowledgements",
  "packages",
  "inputs",
  "outputs",
  "badges",
] as const;

/** Which of those hold objects. The rest hold plain strings. */
const OBJECT_ARRAY_KEYS = new Set<string>([
  "features",
  "scripts",
  "env",
  "faq",
  "packages",
  "inputs",
  "outputs",
  "badges",
]);

/** Required strings, as opposed to the optional ones that may be absent. */
const STRING_KEYS = ["name", "tagline", "description"] as const;

const OPTIONAL_STRING_KEYS = [
  "logo",
  "repoUrl",
  "demoUrl",
  "docsUrl",
  "author",
  "authorUrl",
  "license",
  "runCmd",
  "usage",
  "usageLang",
  "structure",
  "actionRef",
] as const;

/**
 * Rebuilds a ProjectSpec from untrusted JSON, which in practice means a draft
 * restored from localStorage.
 *
 * A draft saved before a field existed carries no value for it, so reading
 * `spec.packages.length` on a draft older than the Monorepo template throws
 * and takes the whole panel down with it. Rather than guarding each read at
 * every call site, every field is forced back to its declared shape here, at
 * the one boundary where foreign data enters. That covers fields added in the
 * future for free.
 */
export function normalizeSpec(raw: unknown): ProjectSpec {
  const base = emptySpec();
  if (raw === null || typeof raw !== "object") return base;

  const saved = raw as Record<string, unknown>;
  const spec = { ...base, ...saved } as unknown as Record<string, unknown>;

  for (const key of ARRAY_KEYS) {
    const value = saved[key];
    if (!Array.isArray(value)) {
      spec[key] = [];
    } else if (OBJECT_ARRAY_KEYS.has(key)) {
      spec[key] = value.filter((e) => e !== null && typeof e === "object" && !Array.isArray(e));
    } else {
      spec[key] = value.filter((e) => typeof e === "string");
    }
  }

  for (const key of STRING_KEYS) {
    if (typeof saved[key] !== "string") spec[key] = base[key];
  }

  for (const key of OPTIONAL_STRING_KEYS) {
    if (key in spec && typeof spec[key] !== "string") delete spec[key];
  }

  const sections = { ...base.sections };
  const savedSections = saved.sections;
  if (savedSections !== null && typeof savedSections === "object") {
    for (const { key } of ALL_SECTIONS) {
      const on = (savedSections as Record<string, unknown>)[key];
      if (typeof on === "boolean") sections[key] = on;
    }
  }
  spec.sections = sections;

  if (!TEMPLATE_IDS.includes(spec.template as TemplateId)) spec.template = base.template;
  if (!PACKAGE_MANAGERS.includes(spec.packageManager as ProjectSpec["packageManager"])) {
    spec.packageManager = base.packageManager;
  }

  return spec as unknown as ProjectSpec;
}
