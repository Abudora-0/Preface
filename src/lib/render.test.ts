import { describe, expect, it } from "vitest";
import { renderReadme, slug } from "./render";
import { TEMPLATES } from "./templates";
import { emptySpec, type ProjectSpec, type TemplateId } from "./types";

function spec(overrides: Partial<ProjectSpec> = {}): ProjectSpec {
  return {
    ...emptySpec(),
    name: "Orbit API",
    tagline: "Track satellite passes.",
    description: "A small REST API for tracking satellite passes.",
    repoUrl: "https://github.com/nawal/orbit-api",
    license: "MIT",
    author: "Nawal",
    techStack: ["TypeScript", "Express.js"],
    features: [
      { title: "Pass prediction", desc: "computes visible passes" },
      { title: "TLE caching", desc: "Redis backed" },
    ],
    install: ["npm install"],
    runCmd: "npm run dev",
    scripts: [
      { name: "dev", cmd: "tsx watch src/index.ts", desc: "Start the development server" },
      { name: "test", cmd: "vitest run", desc: "Run the test suite" },
    ],
    env: [{ key: "DATABASE_URL", desc: "Postgres connection string", example: "postgres://…" }],
    badges: [
      { id: "typescript", label: "TypeScript", url: "https://img.shields.io/badge/ts" },
      { id: "stars", label: "Stars", url: "https://img.shields.io/stars", href: "https://x/y" },
    ],
    ...overrides,
  };
}

const ALL_IDS = TEMPLATES.map((t) => t.id) as TemplateId[];

describe("markdown structure", () => {
  it.each(ALL_IDS)("%s produces well-formed markdown", (template) => {
    const md = renderReadme(spec({ template }));

    expect(md.length).toBeGreaterThan(40);
    expect(md.endsWith("\n")).toBe(true);
    // Every code fence must be closed.
    expect((md.match(/^```/gm) ?? []).length % 2).toBe(0);
    // No accidental blank-line collapsing: a heading always has air around it.
    for (const m of md.matchAll(/^(#{1,6} .+)$/gm)) {
      const before = md.slice(0, m.index).split("\n").at(-2);
      if (before !== undefined && before !== "") {
        expect(`${template}: heading "${m[1]}" preceded by "${before}"`).toBe(
          `${template}: heading "${m[1]}" preceded by ""`,
        );
      }
    }
  });

  it.each(ALL_IDS)("%s never leaves an unreplaced template hole", (template) => {
    const md = renderReadme(spec({ template }));
    expect(md).not.toContain("undefined");
    expect(md).not.toContain("[object Object]");
    expect(md).not.toMatch(/\$\{/);
  });

  it("separates blocks with blank lines", () => {
    // Regression: nonEmpty() used to filter out the "" spacers, running the
    // whole document together into one unreadable block.
    const md = renderReadme(spec({ template: "standard" }));
    expect(md).toContain("# Orbit API\n\n> Track satellite passes.");
    expect(md).toMatch(/\n\n## About\n\n/);
  });
});

describe("switching template preserves content", () => {
  it("keeps the subject of the readme in every template", () => {
    for (const template of ALL_IDS) {
      const md = renderReadme(spec({ template }));
      // The profile template is about a person, so it leads with the author
      // rather than the project name. Every other template leads with the name.
      const expected = template === "profile" ? "Nawal" : "Orbit API";
      expect(md, `template ${template}`).toContain(expected);
    }
  });

  it("keeps scripts wherever a template renders them", () => {
    for (const template of ["standard", "docs", "cli"] as TemplateId[]) {
      const md = renderReadme(spec({ template }));
      expect(md, `template ${template}`).toMatch(/dev/);
    }
  });
});

describe("badges", () => {
  it("uses markdown image syntax outside raw HTML", () => {
    const md = renderReadme(spec({ template: "standard" }));
    expect(md).toContain("![TypeScript](https://img.shields.io/badge/ts)");
  });

  it("uses real img tags inside HTML blocks, where markdown is not parsed", () => {
    // Regression: badge rows inside <p> rendered as literal "![Stars](…)" text
    // on GitHub, because markdown is not parsed inside raw HTML blocks.
    for (const template of ["showcase", "profile"] as TemplateId[]) {
      const md = renderReadme(spec({ template }));
      const paragraphs = [...md.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)].map((m) => m[1]);

      expect(paragraphs.length, `template ${template}`).toBeGreaterThan(0);
      expect(
        paragraphs.some((p) => p.includes("<img src=")),
        `template ${template} should emit at least one <img> inside a <p>`,
      ).toBe(true);
      for (const p of paragraphs) {
        expect(p, `template ${template} paragraph`).not.toContain("![");
      }
    }
  });

  it("wraps linked badges in an anchor", () => {
    const md = renderReadme(spec({ template: "standard" }));
    expect(md).toContain("[![Stars](https://img.shields.io/stars)](https://x/y)");
  });
});

describe("tables", () => {
  it("falls back to a list when most features lack a description", () => {
    const md = renderReadme(
      spec({
        template: "standard",
        features: [{ title: "One" }, { title: "Two" }, { title: "Three", desc: "has one" }],
      }),
    );
    expect(md).toContain("- One");
    expect(md).not.toMatch(/\| \*\*One\*\* \|/);
  });

  it("uses a table when descriptions are present", () => {
    const md = renderReadme(spec({ template: "standard" }));
    expect(md).toMatch(/\| Feature \| Description \|/);
  });

  it("omits the env reference table when no variable is described", () => {
    const md = renderReadme(
      spec({ template: "standard", env: [{ key: "TOKEN" }, { key: "SECRET" }] }),
    );
    expect(md).toContain("TOKEN=");
    expect(md).not.toContain("| Variable | Description |");
  });

  it("escapes pipes so they cannot break out of a cell", () => {
    const md = renderReadme(
      spec({
        template: "standard",
        features: [{ title: "Pipes", desc: "a | b | c" }, { title: "Two", desc: "x" }],
      }),
    );
    expect(md).toContain("a \\| b \\| c");
  });
});

describe("section toggles", () => {
  it("drops a section when switched off", () => {
    const on = renderReadme(spec({ template: "standard" }));
    expect(on).toContain("## Scripts");

    const base = spec({ template: "standard" });
    const off = renderReadme({ ...base, sections: { ...base.sections, scripts: false } });
    expect(off).not.toContain("## Scripts");
  });

  it("omits a section from the table of contents when it is off", () => {
    const base = spec({ template: "standard" });
    const off = renderReadme({ ...base, sections: { ...base.sections, license: false } });
    expect(off).not.toContain("- [License](#license)");
  });
});

describe("table of contents anchors", () => {
  it("links resolve to headings that exist", () => {
    const md = renderReadme(spec({ template: "standard" }));
    const headings = [...md.matchAll(/^## (.+)$/gm)].map((m) => slug(m[1]));
    const links = [...md.matchAll(/^- \[.+?\]\(#(.+?)\)$/gm)].map((m) => m[1]);
    expect(links.length).toBeGreaterThan(3);
    for (const link of links) expect(headings).toContain(link);
  });

  it("strips emoji from anchors the way GitHub does", () => {
    expect(slug("🚀 Getting Started")).toBe("getting-started");
    expect(slug("FAQ")).toBe("faq");
    expect(slug("Tech Stack")).toBe("tech-stack");
  });
});

describe("code fences", () => {
  it("widens the fence when the snippet contains one", () => {
    const md = renderReadme(
      spec({ template: "minimal", usage: "```js\nconst a = 1;\n```", usageLang: "" }),
    );
    expect(md).toContain("````");
  });
});

describe("GitHub Action template", () => {
  const action = spec({
    template: "action",
    actionRef: "nawal/greet@v1",
    inputs: [
      { name: "who-to-greet", desc: "Who to greet", required: true, default: "World" },
      { name: "token", desc: "GitHub token", required: false },
    ],
    outputs: [{ name: "time", desc: "The time we greeted you" }],
  });

  it("renders inputs and outputs tables", () => {
    const md = renderReadme(action);
    expect(md).toContain("## Inputs");
    expect(md).toContain("| `who-to-greet` | Who to greet | yes | `World` |");
    expect(md).toContain("| `token` | GitHub token | no |  |");
    expect(md).toContain("## Outputs");
    expect(md).toContain("| `time` | The time we greeted you |");
  });

  it("generates a workflow snippet that matches the declared inputs", () => {
    const md = renderReadme(action);
    expect(md).toContain("uses: nawal/greet@v1");
    // Required inputs are live, optional ones commented out.
    expect(md).toContain("      who-to-greet: World");
    expect(md).toContain("      # token:");
  });

  it("falls back to the repo slug when no explicit ref is set", () => {
    const md = renderReadme({ ...action, actionRef: undefined });
    expect(md).toContain("uses: nawal/orbit-api@v1");
  });

  it("skips the tables entirely when there is nothing to show", () => {
    const md = renderReadme({ ...action, inputs: [], outputs: [] });
    expect(md).not.toContain("## Inputs");
    expect(md).not.toContain("## Outputs");
    expect(md).toContain("## Usage");
  });
});

describe("empty and hostile input", () => {
  it("renders something usable from a nearly empty spec", () => {
    for (const template of ALL_IDS) {
      const md = renderReadme({ ...emptySpec(), name: "X", template });
      expect(md, `template ${template}`).toContain("X");
      expect((md.match(/^```/gm) ?? []).length % 2).toBe(0);
    }
  });

  it("does not crash on very long single-line values", () => {
    const md = renderReadme(spec({ template: "standard", tagline: "x".repeat(5000) }));
    expect(md.length).toBeGreaterThan(5000);
  });
});

describe("Monorepo template", () => {
  const mono = spec({
    template: "monorepo",
    packages: [
      { name: "@acme/core", path: "packages/core", desc: "Shared domain logic" },
      { name: "@acme/cli", path: "packages/cli", desc: "Command line entry point" },
    ],
  });

  it("renders a package table with linked paths", () => {
    const md = renderReadme(mono);
    expect(md).toContain("## Packages");
    expect(md).toContain("| Package | Path | Description |");
    expect(md).toContain(
      "[`packages/core`](https://github.com/nawal/orbit-api/tree/main/packages/core)",
    );
  });

  it("drops the path column when no package has one", () => {
    const md = renderReadme({
      ...mono,
      packages: [{ name: "@acme/core", desc: "Shared domain logic" }],
    });
    expect(md).toContain("| Package | Description |");
    expect(md).not.toContain("| Package | Path | Description |");
  });

  it("leaves the path unlinked when the repo is unknown", () => {
    const md = renderReadme({ ...mono, repoUrl: undefined });
    expect(md).toContain("`packages/core`");
    expect(md).not.toContain("tree/main");
  });

  it("omits the section entirely when there are no packages", () => {
    const md = renderReadme({ ...mono, packages: [] });
    expect(md).not.toContain("## Packages");
  });
});
