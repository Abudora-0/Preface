import { describe, expect, it } from "vitest";
import { clipDump, extractJson, mergeSpec, resolveProvider } from "./ai";
import { emptySpec, type ProjectSpec } from "./types";

describe("provider resolution", () => {
  it("defaults to ollama when nothing is configured", () => {
    expect(resolveProvider({})).toBe("ollama");
  });

  it("never routes to a paid API just because a key is in the environment", () => {
    // A key can be exported by an unrelated tool or a shared shell profile.
    // Spending money must be an explicit choice, not an ambient one.
    expect(resolveProvider({ ANTHROPIC_API_KEY: "sk-ant-xxx" })).toBe("ollama");
  });

  it("uses anthropic only when explicitly opted in", () => {
    expect(resolveProvider({ AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "sk-ant-xxx" })).toBe(
      "anthropic",
    );
  });

  it("honours a forced anthropic even with no key, so the error is explicit", () => {
    expect(resolveProvider({ AI_PROVIDER: "anthropic" })).toBe("anthropic");
  });

  it("ignores casing, whitespace and unknown values", () => {
    expect(resolveProvider({ AI_PROVIDER: "  ANTHROPIC " })).toBe("anthropic");
    expect(resolveProvider({ AI_PROVIDER: "gpt4" })).toBe("ollama");
    expect(resolveProvider({ AI_PROVIDER: "gpt4", ANTHROPIC_API_KEY: "k" })).toBe("ollama");
  });
});

describe("dump clipping", () => {
  it("clips much harder for a local model than a hosted one", () => {
    const huge = "x".repeat(200_000);
    const local = clipDump(huge, "ollama");
    const hosted = clipDump(huge, "anthropic");

    expect(local.length).toBeLessThan(hosted.length);
    expect(local.length).toBeLessThan(25_000);
    expect(local.endsWith("[truncated]")).toBe(true);
  });

  it("leaves content under the limit untouched", () => {
    const small = "a short dump";
    expect(clipDump(small, "ollama")).toBe(small);
    expect(clipDump(small, "anthropic")).toBe(small);
  });
});

describe("json extraction", () => {
  it("parses a clean object", () => {
    expect(extractJson('{"name":"x"}')).toEqual({ name: "x" });
  });

  it("unwraps a fenced block", () => {
    expect(extractJson('```json\n{"name":"x"}\n```')).toEqual({ name: "x" });
  });

  it("recovers an object wrapped in prose, which small models do", () => {
    expect(extractJson('Sure! Here is the JSON:\n{"name":"x"}\nHope that helps.')).toEqual({
      name: "x",
    });
  });

  it("throws a typed error rather than crashing on junk", () => {
    expect(() => extractJson("no json at all")).toThrowError(/usable JSON/);
  });
});

describe("merge", () => {
  function base(overrides: Partial<ProjectSpec> = {}): ProjectSpec {
    return {
      ...emptySpec(),
      name: "orbit-api",
      tagline: "parsed tagline",
      description: "parsed description",
      scripts: [{ name: "dev", cmd: "tsx watch src/index.ts", desc: "Start the dev server" }],
      env: [{ key: "DATABASE_URL", example: "postgres://x" }],
      techStack: ["TypeScript"],
      ...overrides,
    };
  }

  it("takes prose from the model", () => {
    const merged = mergeSpec(base(), { tagline: "a better tagline" });
    expect(merged.tagline).toBe("a better tagline");
  });

  it("keeps the parsed value when the model returns an empty string", () => {
    const merged = mergeSpec(base(), { tagline: "", description: "   " });
    expect(merged.tagline).toBe("parsed tagline");
    expect(merged.description).toBe("parsed description");
  });

  it("never lets the model rewrite a real script command", () => {
    const merged = mergeSpec(base(), {
      scripts: [{ name: "dev", cmd: "rm -rf /", desc: "Run the dev server" }],
    });
    expect(merged.scripts[0].cmd).toBe("tsx watch src/index.ts");
    expect(merged.scripts[0].desc).toBe("Run the dev server");
  });

  it("keeps detected env keys and adopts model descriptions", () => {
    const merged = mergeSpec(base(), {
      env: [{ key: "DATABASE_URL", desc: "Postgres connection string", example: "" }],
    });
    expect(merged.env[0]).toMatchObject({
      key: "DATABASE_URL",
      desc: "Postgres connection string",
      example: "postgres://x",
    });
  });

  it("adds env keys the model found that the parser missed", () => {
    const merged = mergeSpec(base(), {
      env: [{ key: "REDIS_URL", desc: "Cache connection", example: "" }],
    });
    expect(merged.env.map((e) => e.key)).toEqual(["DATABASE_URL", "REDIS_URL"]);
  });

  it("discards malformed entries instead of rendering blanks", () => {
    const merged = mergeSpec(base(), {
      features: [{ title: "", desc: "no title" }, { title: "Real", desc: "kept" }],
      faq: [{ q: "only a question" }, { q: "Q", a: "A" }],
    });
    expect(merged.features).toEqual([{ title: "Real", desc: "kept" }]);
    expect(merged.faq).toEqual([{ q: "Q", a: "A" }]);
  });

  it("survives a response with nothing usable in it", () => {
    const merged = mergeSpec(base(), {});
    expect(merged.name).toBe("orbit-api");
    expect(merged.scripts).toHaveLength(1);
  });

  it("survives wrong types without throwing", () => {
    const merged = mergeSpec(base(), {
      features: "not an array",
      install: [123, null, "npm install"],
      techStack: { nope: true },
    });
    expect(merged.install).toEqual(["npm install"]);
    expect(merged.techStack).toEqual(["TypeScript"]);
  });

  it("takes model descriptions for workspace packages the parser found", () => {
    const merged = mergeSpec(
      base({ packages: [{ name: "@orbit/core", path: "packages/core" }] }),
      { packages: [{ name: "@orbit/core", desc: "Orbital mechanics solver" }] },
    );

    expect(merged.packages).toEqual([
      { name: "@orbit/core", path: "packages/core", desc: "Orbital mechanics solver" },
    ]);
  });

  it("never lets the model invent a workspace package", () => {
    // A fabricated package name becomes a broken install command in the table.
    const merged = mergeSpec(base({ packages: [{ name: "@orbit/core" }] }), {
      packages: [
        { name: "@orbit/core", desc: "Real" },
        { name: "@orbit/ghost", desc: "Never existed" },
      ],
    });

    expect(merged.packages.map((p) => p.name)).toEqual(["@orbit/core"]);
  });

  it("adds no packages at all when the parser found none", () => {
    const merged = mergeSpec(base(), {
      packages: [{ name: "@orbit/invented", desc: "Not in any manifest" }],
    });

    expect(merged.packages).toEqual([]);
  });

  it("describes action inputs and outputs without changing which exist", () => {
    const merged = mergeSpec(
      base({
        inputs: [
          { name: "token", required: true },
          { name: "path", default: "." },
        ],
        outputs: [{ name: "result" }],
      }),
      {
        inputs: [
          { name: "token", desc: "GitHub token" },
          { name: "ghost", desc: "Not declared in action.yml" },
        ],
        outputs: [{ name: "result", desc: "The computed value" }],
      },
    );

    expect(merged.inputs).toEqual([
      { name: "token", required: true, desc: "GitHub token" },
      { name: "path", default: "." },
    ]);
    expect(merged.outputs).toEqual([{ name: "result", desc: "The computed value" }]);
  });

  it("keeps the parsed description when the model skips an entry", () => {
    const merged = mergeSpec(
      base({ packages: [{ name: "@orbit/core", desc: "From the manifest" }] }),
      { packages: [] },
    );

    expect(merged.packages[0].desc).toBe("From the manifest");
  });

  it("survives wrong types in packages, inputs and outputs", () => {
    const merged = mergeSpec(base({ packages: [{ name: "@orbit/core" }] }), {
      packages: "not an array",
      inputs: [null, 42],
      outputs: { nope: true },
    });

    expect(merged.packages).toEqual([{ name: "@orbit/core" }]);
    expect(merged.inputs).toEqual([]);
    expect(merged.outputs).toEqual([]);
  });

  it("switches sections on and off to match what survived the merge", () => {
    const merged = mergeSpec(base(), { faq: [{ q: "Q", a: "A" }] });
    expect(merged.sections.faq).toBe(true);
    expect(merged.sections.roadmap).toBe(false);
  });
});
