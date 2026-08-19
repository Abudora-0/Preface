import { describe, expect, it } from "vitest";
import { analyzeDump } from "./analyze";

const PKG = `{
  "name": "orbit-api",
  "description": "A small REST API for tracking satellite passes.",
  "license": "MIT",
  "author": "Nawal <nawal@example.com>",
  "repository": { "url": "git+https://github.com/nawal/orbit-api.git" },
  "scripts": { "dev": "tsx watch src/index.ts", "build": "tsc -p .", "test": "vitest run" },
  "dependencies": { "express": "^4.19.0", "pg": "^8.11.0", "redis": "^4.6.0" },
  "devDependencies": { "typescript": "^5.4.0", "vitest": "^1.6.0" }
}`;

describe("package.json extraction", () => {
  it("pulls metadata out of a bare manifest", () => {
    const { spec } = analyzeDump(PKG);
    expect(spec.name).toBe("Orbit Api");
    expect(spec.tagline).toBe("A small REST API for tracking satellite passes.");
    expect(spec.license).toBe("MIT");
    expect(spec.author).toBe("Nawal");
    expect(spec.repoUrl).toBe("https://github.com/nawal/orbit-api");
  });

  it("finds the manifest even when buried in unrelated prose", () => {
    const noise = `Some notes about the project.\n\nHere is the manifest:\n\n${PKG}\n\nAnd some trailing chatter.`;
    const { spec } = analyzeDump(noise);
    expect(spec.name).toBe("Orbit Api");
    expect(spec.scripts.map((s) => s.name)).toContain("dev");
  });

  it("maps dependencies onto known technologies", () => {
    const { spec } = analyzeDump(PKG);
    expect(spec.techStack).toEqual(
      expect.arrayContaining(["Express.js", "PostgreSQL", "Redis", "TypeScript"]),
    );
  });

  it("describes well-known scripts", () => {
    const { spec } = analyzeDump(PKG);
    const dev = spec.scripts.find((s) => s.name === "dev");
    expect(dev?.desc).toBe("Start the development server");
  });

  it("prefixes install commands with a clone when a repo is known", () => {
    const { spec } = analyzeDump(PKG);
    expect(spec.install[0]).toBe("git clone https://github.com/nawal/orbit-api.git");
    expect(spec.install).toContain("npm install");
  });

  it("survives malformed JSON without throwing", () => {
    const { spec } = analyzeDump(`{ "name": "broken", "scripts": { `);
    expect(spec).toBeTruthy();
    expect(spec.name).toBeTruthy();
  });
});

describe("package manager detection", () => {
  const cases: [string, string][] = [
    ["pnpm-lock.yaml", "pnpm"],
    ["yarn.lock", "yarn"],
    ["bun.lockb", "bun"],
    ["requirements.txt\nflask==3.0.0\nrequests==2.31.0\n", "pip"],
    ["Cargo.toml", "cargo"],
    ["go.mod", "go"],
  ];
  for (const [marker, expected] of cases) {
    it(`detects ${expected} from ${marker.split("\n")[0]}`, () => {
      const { spec } = analyzeDump(`a project\n${marker}\nmore text here to pad it out`);
      expect(spec.packageManager).toBe(expected);
    });
  }
});

describe("environment variables", () => {
  it("reads assignments and keeps example values", () => {
    const { spec } = analyzeDump(
      "DATABASE_URL=postgres://localhost:5432/orbit\nREDIS_URL=redis://localhost:6379\n",
    );
    expect(spec.env.map((e) => e.key)).toEqual(["DATABASE_URL", "REDIS_URL"]);
    expect(spec.env[0].example).toBe("postgres://localhost:5432/orbit");
  });

  it("picks up usage sites across languages", () => {
    const { spec } = analyzeDump(
      `const a = process.env.STRIPE_KEY;\nkey = os.getenv("SENTRY_DSN")\nENV["RAILS_ENV"]`,
    );
    const keys = spec.env.map((e) => e.key);
    expect(keys).toEqual(expect.arrayContaining(["STRIPE_KEY", "SENTRY_DSN", "RAILS_ENV"]));
  });

  it("ignores lowercase and short identifiers", () => {
    const { spec } = analyzeDump("path=/usr/bin\nAB=2\nGOOD_KEY=1\n");
    expect(spec.env.map((e) => e.key)).toEqual(["GOOD_KEY"]);
  });
});

describe("file tree", () => {
  it("captures the tree and its unindented root line", () => {
    const tree = ["src/", "├── index.ts", "├── routes/", "│   └── users.ts", "└── lib/db.ts"].join(
      "\n",
    );
    const { spec } = analyzeDump(`notes\n\n${tree}\n\nmore notes`);
    // Regression: the root line used to be dropped, leaving a headless tree.
    expect(spec.structure?.split("\n")[0]).toBe("src/");
    expect(spec.structure).toContain("└── lib/db.ts");
  });
});

describe("feature bullets", () => {
  it("splits bold titles from their descriptions", () => {
    const { spec } = analyzeDump(
      "- **Pass prediction** - computes visible passes\n- Plain bullet with no bold part\n",
    );
    expect(spec.features[0]).toEqual({
      title: "Pass prediction",
      desc: "computes visible passes",
    });
    expect(spec.features[1].title).toBe("Plain bullet with no bold part");
  });

  it("still splits on an em dash, which other people's READMEs use", () => {
    const { spec } = analyzeDump("- **Caching** — Redis backed, six hour TTL\n");
    expect(spec.features[0].title).toBe("Caching");
    expect(spec.features[0].desc).toBe("Redis backed, six hour TTL");
  });

  it("skips dependency lines and bare URLs", () => {
    const { spec } = analyzeDump("- https://example.com\n- express: ^4.19.0\n- A real feature\n");
    expect(spec.features.map((f) => f.title)).toEqual(["A real feature"]);
  });
});

describe("GitHub Action detection", () => {
  const ACTION = [
    "name: 'Greet Someone'",
    "description: 'Prints a friendly greeting'",
    "inputs:",
    "  who-to-greet:",
    "    description: 'Who to greet'",
    "    required: true",
    "    default: 'World'",
    "  token:",
    "    description: 'GitHub token'",
    "    required: false",
    "outputs:",
    "  time:",
    "    description: 'The time we greeted you'",
    "runs:",
    "  using: 'node20'",
    "  main: 'dist/index.js'",
  ].join("\n");

  it("reads inputs with their flags and defaults", () => {
    const { spec } = analyzeDump(ACTION);
    expect(spec.inputs).toEqual([
      { name: "who-to-greet", desc: "Who to greet", required: true, default: "World" },
      { name: "token", desc: "GitHub token", required: false },
    ]);
  });

  it("reads outputs and takes the name and description from the file", () => {
    const { spec } = analyzeDump(ACTION);
    expect(spec.outputs).toEqual([{ name: "time", desc: "The time we greeted you" }]);
    expect(spec.name).toBe("Greet Someone");
    expect(spec.tagline).toBe("Prints a friendly greeting");
  });

  it("reports what it found", () => {
    const { notes } = analyzeDump(ACTION);
    expect(notes.join(" ")).toContain("2 inputs");
  });

  it("does not treat unrelated YAML as an action", () => {
    const compose = "services:\n  web:\n    image: nginx\n    ports:\n      - '80:80'\n";
    const { spec } = analyzeDump(compose);
    expect(spec.inputs).toEqual([]);
    expect(spec.outputs).toEqual([]);
  });
});

describe("section toggles", () => {
  it("turns off sections with nothing to show", () => {
    const { spec } = analyzeDump("just a sentence of prose, nothing structured at all here");
    expect(spec.sections.env).toBe(false);
    expect(spec.sections.structure).toBe(false);
    expect(spec.sections.scripts).toBe(false);
  });

  it("turns on the sections it found data for", () => {
    const { spec } = analyzeDump(PKG);
    expect(spec.sections.scripts).toBe(true);
    expect(spec.sections.techStack).toBe(true);
  });
});

describe("monorepo detection", () => {
  const MONO = [
    "--- package.json ---",
    '{ "name": "acme", "private": true, "workspaces": ["packages/*"],',
    '  "scripts": { "build": "turbo run build" } }',
    "",
    "--- packages/core/package.json ---",
    '{ "name": "@acme/core", "version": "1.2.0", "description": "Shared domain logic" }',
    "",
    "--- packages/cli/package.json ---",
    '{ "name": "@acme/cli", "version": "0.4.0", "description": "Command line entry point" }',
  ].join("\n");

  it("lists workspace members with their paths and descriptions", () => {
    const { spec } = analyzeDump(MONO);
    expect(spec.packages).toEqual([
      { name: "@acme/core", path: "packages/core", desc: "Shared domain logic" },
      { name: "@acme/cli", path: "packages/cli", desc: "Command line entry point" },
    ]);
  });

  it("excludes the root manifest from the package table", () => {
    const { spec } = analyzeDump(MONO);
    expect(spec.packages.map((p) => p.name)).not.toContain("acme");
  });

  it("reports the count", () => {
    const { notes } = analyzeDump(MONO);
    expect(notes.join(" ")).toContain("2 workspace packages");
  });

  it("leaves packages empty for an ordinary single-package repo", () => {
    const { spec } = analyzeDump(PKG);
    expect(spec.packages).toEqual([]);
  });
});
