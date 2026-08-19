import { describe, expect, it } from "vitest";
import { renderReadme } from "./render";
import { emptySpec, type ProjectSpec } from "./types";

/**
 * A repository imported by URL supplies its own description and homepage, and
 * those belong to whoever owns it. These pin the templates that build real
 * HTML against that content escaping its context.
 */
function imported(overrides: Partial<ProjectSpec> = {}): ProjectSpec {
  return {
    ...emptySpec(),
    name: "orbit-api",
    tagline: "Satellite passes",
    description: "A small API.",
    repoUrl: "https://github.com/someone/orbit-api",
    ...overrides,
  };
}

const HOSTILE = '</i></p><div style="position:fixed;inset:0">gotcha</div><p><i>';

describe("raw HTML templates escape untrusted values", () => {
  it("does not let a repo description close the tag it sits in", () => {
    const md = renderReadme(imported({ tagline: HOSTILE, template: "showcase" }));

    expect(md).not.toContain("<div style=");
    expect(md).not.toContain("</i></p><div");
    expect(md).toContain("&lt;/i&gt;&lt;/p&gt;");
  });

  it("escapes the tagline in the profile header too", () => {
    const md = renderReadme(
      imported({ tagline: HOSTILE, author: "someone", template: "profile" }),
    );

    expect(md).not.toContain("<div style=");
    expect(md).toContain("&lt;div");
  });

  it("escapes an author name written into a heading", () => {
    const md = renderReadme(
      imported({ author: '<img src=x onerror="alert(1)">', template: "profile" }),
    );

    expect(md).not.toContain("<img src=x");
    expect(md).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  it("escapes a project name written into a heading", () => {
    const md = renderReadme(imported({ name: "<script>alert(1)</script>", template: "showcase" }));

    expect(md).not.toContain("<script>");
    expect(md).toContain("&lt;script&gt;");
  });

  it("escapes an FAQ question inside its summary tag", () => {
    const md = renderReadme(
      imported({
        template: "showcase",
        faq: [{ q: "</summary><div>escaped?</div><summary>", a: "An answer." }],
        sections: { ...emptySpec().sections, faq: true },
      }),
    );

    expect(md).not.toContain("</summary><div>");
    expect(md).toContain("&lt;/summary&gt;");
  });
});

describe("raw HTML templates reject unusable URLs", () => {
  it("drops a demo link that is not http or https", () => {
    const md = renderReadme(
      imported({ demoUrl: "javascript:alert(1)", template: "showcase" }),
    );

    expect(md).not.toContain("javascript:");
    expect(md).not.toContain("Live Demo");
  });

  it("drops a logo that is not a real URL", () => {
    const md = renderReadme(
      imported({ logo: 'x" onerror="alert(1)', template: "showcase" }),
    );

    expect(md).not.toContain("onerror");
  });

  it("keeps a legitimate http(s) link", () => {
    const md = renderReadme(
      imported({
        demoUrl: "https://orbit.example.com/demo",
        docsUrl: "https://docs.example.com",
        template: "showcase",
      }),
    );

    expect(md).toContain("https://orbit.example.com/demo");
    expect(md).toContain("Live Demo");
    expect(md).toContain("Docs");
  });

  it("still renders a normal showcase header unchanged", () => {
    const md = renderReadme(imported({ template: "showcase" }));

    expect(md).toContain("<h1>orbit-api</h1>");
    expect(md).toContain("<p><i>Satellite passes</i></p>");
  });
});
