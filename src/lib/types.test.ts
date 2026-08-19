import { describe, expect, it } from "vitest";
import { DEFAULT_SECTIONS, emptySpec, normalizeSpec } from "./types";

describe("normalizeSpec", () => {
  it("fills in a field the saved draft predates", () => {
    // The exact shape that crashed the Details panel: a draft written before
    // the Monorepo template existed, so it carries no `packages` at all.
    const legacy = { ...emptySpec(), name: "orbit-api" } as Record<string, unknown>;
    delete legacy.packages;
    delete legacy.inputs;
    delete legacy.outputs;

    const spec = normalizeSpec(legacy);

    expect(spec.packages).toEqual([]);
    expect(spec.inputs).toEqual([]);
    expect(spec.outputs).toEqual([]);
    expect(spec.name).toBe("orbit-api");
  });

  it("leaves every array readable, whatever the draft held", () => {
    const spec = normalizeSpec({ features: null, scripts: "nope", badges: 7, install: {} });

    for (const value of [spec.features, spec.scripts, spec.badges, spec.install]) {
      expect(Array.isArray(value)).toBe(true);
      expect(value).toHaveLength(0);
    }
  });

  it("keeps real content instead of discarding the draft", () => {
    const spec = normalizeSpec({
      name: "orbit-api",
      tagline: "Satellite passes",
      packages: [{ name: "@orbit/core", path: "packages/core" }],
      install: ["npm install"],
      template: "monorepo",
    });

    expect(spec.name).toBe("orbit-api");
    expect(spec.packages).toEqual([{ name: "@orbit/core", path: "packages/core" }]);
    expect(spec.install).toEqual(["npm install"]);
    expect(spec.template).toBe("monorepo");
  });

  it("drops junk entries that would crash a row renderer", () => {
    const spec = normalizeSpec({
      packages: [{ name: "@orbit/core" }, "not an object", null, 42, ["nested"]],
      techStack: ["TypeScript", 5, null],
    });

    expect(spec.packages).toEqual([{ name: "@orbit/core" }]);
    expect(spec.techStack).toEqual(["TypeScript"]);
  });

  it("falls back on an unknown template rather than rendering nothing", () => {
    expect(normalizeSpec({ template: "kubernetes" }).template).toBe("standard");
    expect(normalizeSpec({ packageManager: "brew" }).packageManager).toBe("npm");
    expect(normalizeSpec({ template: "cli" }).template).toBe("cli");
  });

  it("merges section toggles over the defaults", () => {
    const spec = normalizeSpec({ sections: { faq: true, license: false, bogus: true } });

    expect(spec.sections.faq).toBe(true);
    expect(spec.sections.license).toBe(false);
    // Untouched keys keep their default rather than becoming undefined.
    expect(spec.sections.about).toBe(DEFAULT_SECTIONS.about);
    expect(Object.keys(spec.sections)).not.toContain("bogus");
  });

  it("ignores a non-boolean toggle instead of rendering a section on a string", () => {
    const spec = normalizeSpec({ sections: { faq: "yes", roadmap: 1 } });

    expect(spec.sections.faq).toBe(DEFAULT_SECTIONS.faq);
    expect(spec.sections.roadmap).toBe(DEFAULT_SECTIONS.roadmap);
  });

  it("strips an optional string that is not a string", () => {
    const spec = normalizeSpec({ repoUrl: 42, author: { name: "x" }, license: "MIT" });

    expect(spec.repoUrl).toBeUndefined();
    expect(spec.author).toBeUndefined();
    expect(spec.license).toBe("MIT");
  });

  it("is idempotent, so applying it on an already-good spec changes nothing", () => {
    // It runs on the analyzer and API results too, which are already complete.
    const good = {
      ...emptySpec(),
      name: "orbit-api",
      template: "monorepo" as const,
      packages: [{ name: "@orbit/core", path: "packages/core" }],
      repoUrl: "https://github.com/x/y",
      sections: { ...DEFAULT_SECTIONS, faq: true },
    };

    expect(normalizeSpec(good)).toEqual(good);
    expect(normalizeSpec(normalizeSpec(good))).toEqual(good);
  });

  it("survives corrupt storage entirely", () => {
    for (const junk of [null, undefined, "a string", 42, []]) {
      expect(() => normalizeSpec(junk)).not.toThrow();
    }
    expect(normalizeSpec(null)).toEqual(emptySpec());
    expect(normalizeSpec("garbage")).toEqual(emptySpec());
  });
});
