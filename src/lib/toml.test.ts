import { describe, expect, it } from "vitest";
import { analyzeDump } from "./analyze";

const PEP621 = `pyproject.toml
[project]
name = "tideline-py"
version = "0.3.0"
description = "Tide predictions as a Python library and CLI."
license = { text = "Apache-2.0" }
requires-python = ">=3.10"
dependencies = ["httpx>=0.27", "pydantic>=2.6", "typer>=0.12"]

[project.urls]
Homepage = "https://tideline.dev"

[project.scripts]
tideline = "tideline.cli:app"
tideline-sync = "tideline.sync:main"
`;

const POETRY = `pyproject.toml
[tool.poetry]
name = "harbourmaster"
description = "Schedules berth allocations for small ports."
license = "MIT"
authors = ["Nawal Rehman <nawal@example.com>"]
repository = "https://github.com/nawal/harbourmaster"

[tool.poetry.dependencies]
python = "^3.11"
fastapi = "^0.110.0"
sqlalchemy = "^2.0"
`;

const CARGO = `Cargo.toml
[package]
name = "tidewatch"
version = "0.9.2"
edition = "2021"
description = "A fast tide predictor for embedded targets."
license = "MIT OR Apache-2.0"
repository = "https://github.com/nawal/tidewatch.git"
homepage = "https://tidewatch.rs"
authors = ["Nawal Rehman <nawal@example.com>"]

[dependencies]
serde = { version = "1.0", features = ["derive"] }
chrono = "0.4"
clap = "4.5"
`;

describe("pyproject.toml", () => {
  it("reads PEP 621 name, description and an inline-table license", () => {
    const { spec } = analyzeDump(PEP621);
    // titleCase leaves words of two characters or fewer alone, so "py" stays
    // lowercase the same way "js" or "io" would.
    expect(spec.name).toBe("Tideline py");
    expect(spec.tagline).toBe("Tide predictions as a Python library and CLI.");
    expect(spec.description).toBe("Tide predictions as a Python library and CLI.");
    expect(spec.license).toBe("Apache-2.0");
  });

  it("turns console entry points into runnable scripts", () => {
    const { spec } = analyzeDump(PEP621);
    expect(spec.scripts.map((s) => s.name)).toEqual(["tideline", "tideline-sync"]);
  });

  it("reads the older Poetry layout too", () => {
    const { spec } = analyzeDump(POETRY);
    expect(spec.name).toBe("Harbourmaster");
    expect(spec.tagline).toBe("Schedules berth allocations for small ports.");
    expect(spec.license).toBe("MIT");
    expect(spec.author).toBe("Nawal Rehman");
    expect(spec.repoUrl).toBe("https://github.com/nawal/harbourmaster");
  });
});

describe("Cargo.toml", () => {
  it("reads name, description and a compound license", () => {
    const { spec } = analyzeDump(CARGO);
    expect(spec.name).toBe("Tidewatch");
    expect(spec.tagline).toBe("A fast tide predictor for embedded targets.");
    expect(spec.license).toBe("MIT OR Apache-2.0");
  });

  it("takes the first author and strips the email", () => {
    expect(analyzeDump(CARGO).spec.author).toBe("Nawal Rehman");
  });

  it("keeps the repository and homepage apart, dropping the .git suffix", () => {
    const { spec } = analyzeDump(CARGO);
    expect(spec.repoUrl).toBe("https://github.com/nawal/tidewatch");
    expect(spec.demoUrl).toBe("https://tidewatch.rs");
  });

  it("does not mistake a version string for a dependency name", () => {
    const { spec } = analyzeDump(CARGO);
    expect(spec.techStack.join(" ").toLowerCase()).not.toContain("derive");
  });
});

describe("precedence", () => {
  it("lets package.json win when a repo ships both", () => {
    const both = `{"name":"tideline","description":"The JS package.","license":"MIT"}\n\n${CARGO}`;
    const { spec } = analyzeDump(both);

    expect(spec.name).toBe("Tideline");
    expect(spec.tagline).toBe("The JS package.");
    expect(spec.license).toBe("MIT");
  });

  it("still falls back to the placeholder when neither manifest is present", () => {
    expect(analyzeDump("just some loose notes about a thing").spec.name).toBe("My Project");
  });

  it("ignores a TOML table that carries no identity at all", () => {
    const { spec } = analyzeDump("[dependencies]\nserde = \"1.0\"\n");
    expect(spec.name).toBe("My Project");
  });
});
