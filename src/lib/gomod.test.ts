import { describe, expect, it } from "vitest";
import { analyzeDump } from "./analyze";

const GOMOD = `go.mod
module github.com/nawal/tidewatch

go 1.22

require (
	github.com/gin-gonic/gin v1.9.1
	github.com/lib/pq v1.10.9
	github.com/go-chi/chi/v5 v5.0.12
)

require (
	github.com/bytedance/sonic v1.9.1 // indirect
	golang.org/x/sys v0.15.0 // indirect
)
`;

describe("go.mod", () => {
  it("takes the project name from the module path", () => {
    expect(analyzeDump(GOMOD).spec.name).toBe("Tidewatch");
  });

  it("maps a forge module path onto its repository URL", () => {
    expect(analyzeDump(GOMOD).spec.repoUrl).toBe("https://github.com/nawal/tidewatch");
  });

  it("turns the declared go directive into a prerequisite", () => {
    expect(analyzeDump(GOMOD).spec.prerequisites).toEqual(["Go 1.22 or newer"]);
  });

  it("reads direct dependencies into the stack", () => {
    const stack = analyzeDump(GOMOD).spec.techStack.join(" ").toLowerCase();
    expect(stack).toContain("go");
  });

  it("skips indirect requirements, which the project never chose", () => {
    const { spec } = analyzeDump(GOMOD);
    const all = JSON.stringify(spec).toLowerCase();
    expect(all).not.toContain("sonic");
  });

  it("ignores the major-version segment when naming a module", () => {
    const { spec } = analyzeDump("go.mod\nmodule github.com/nawal/tidewatch/v3\n\ngo 1.21\n");
    expect(spec.name).toBe("Tidewatch");
    expect(spec.repoUrl).toBe("https://github.com/nawal/tidewatch");
  });

  it("does not invent a URL for a vanity module path", () => {
    // go.uber.org/zap is a real module but not a browsable repo at that address.
    const { spec } = analyzeDump("go.mod\nmodule go.uber.org/zap\n\ngo 1.21\n");
    expect(spec.name).toBe("Zap");
    expect(spec.repoUrl).toBeUndefined();
  });

  it("survives a go.mod with nothing but a module line", () => {
    const { spec } = analyzeDump("module example.com/thing\n");
    expect(spec.name).toBe("Thing");
    expect(spec.prerequisites).toEqual([]);
  });
});

describe("manifest precedence", () => {
  it("lets package.json win over go.mod", () => {
    const both = `{"name":"tidewatch-js","description":"The JS client.","license":"MIT"}\n\n${GOMOD}`;
    const { spec } = analyzeDump(both);

    expect(spec.name).toBe("Tidewatch js");
    expect(spec.tagline).toBe("The JS client.");
  });

  it("lets Cargo.toml win over go.mod for the name", () => {
    const both = `[package]\nname = "tidewatch-rs"\ndescription = "The Rust core."\n\n${GOMOD}`;
    const { spec } = analyzeDump(both);

    expect(spec.name).toBe("Tidewatch rs");
    expect(spec.tagline).toBe("The Rust core.");
  });

  it("still takes the repo URL from go.mod when no other manifest has one", () => {
    const both = `[package]\nname = "tidewatch-rs"\ndescription = "The Rust core."\n\n${GOMOD}`;
    expect(analyzeDump(both).spec.repoUrl).toBe("https://github.com/nawal/tidewatch");
  });
});

describe("a manifest proves its own language", () => {
  it("detects Go from a bare go.mod with no source files", () => {
    const { spec } = analyzeDump("module github.com/nawal/tidewatch\n\ngo 1.22\n");
    expect(spec.techStack).toContain("Go");
  });

  it("detects Rust from a bare Cargo.toml", () => {
    const { spec } = analyzeDump('[package]\nname = "tidewatch"\ndescription = "A crate."\n');
    expect(spec.techStack).toContain("Rust");
  });

  it("detects Python from a bare pyproject.toml", () => {
    const { spec } = analyzeDump('[project]\nname = "tideline"\ndescription = "A package."\n');
    expect(spec.techStack).toContain("Python");
  });
});
