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

export type TemplateId =
  | "minimal"
  | "standard"
  | "showcase"
  | "docs"
  | "cli"
  | "action"
  | "monorepo"
  | "profile";

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
  packageManager: "npm" | "yarn" | "pnpm" | "bun" | "pip" | "cargo" | "go" | "other";
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
