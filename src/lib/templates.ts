import type { TemplateId } from "./types";

export type TemplateMeta = {
  id: TemplateId;
  name: string;
  blurb: string;
  /** One-line visual hint shown on the gallery card. */
  vibe: string;
  best: string;
};

export const TEMPLATES: TemplateMeta[] = [
  {
    id: "minimal",
    name: "Minimal",
    blurb: "Title, one-liner, install, usage, license. Nothing else.",
    vibe: "Clean, no badges, scans in ten seconds",
    best: "Libraries, CLI tools, anything small",
  },
  {
    id: "standard",
    name: "Standard OSS",
    blurb: "The conventional open-source layout with badges and a table of contents.",
    vibe: "Familiar, complete, contributor-friendly",
    best: "Most public repositories",
  },
  {
    id: "showcase",
    name: "Showcase",
    blurb: "Centered header, badge wall, collapsible sections, tables everywhere.",
    vibe: "Loud and visual, the one people screenshot",
    best: "Portfolio projects and launches",
  },
  {
    id: "docs",
    name: "Documentation",
    blurb: "Reference-first: dense tables, no decoration, deep configuration detail.",
    vibe: "Technical and terse",
    best: "SDKs, APIs, internal tooling",
  },
  {
    id: "cli",
    name: "CLI tool",
    blurb: "Install matrix, a usage block, and a table of commands.",
    vibe: "Terminal-first, command reference up top",
    best: "Command line tools and dev utilities",
  },
  {
    id: "action",
    name: "GitHub Action",
    blurb: "Inputs and outputs tables with a ready-to-paste workflow snippet.",
    vibe: "Reference-shaped, copy the YAML and go",
    best: "Anything published to the Actions marketplace",
  },
  {
    id: "monorepo",
    name: "Monorepo",
    blurb: "A package table for the workspace, plus shared setup and scripts.",
    vibe: "Directory-first, one row per package",
    best: "Workspaces with several published packages",
  },
  {
    id: "profile",
    name: "Profile README",
    blurb: "The special repo that renders on your GitHub profile page.",
    vibe: "About-me, tech icons, stats cards",
    best: "github.com/<you>/<you>",
  },
];

export function templateMeta(id: TemplateId): TemplateMeta {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[1];
}
