import { analyzeDump } from "@/lib/analyze";
import { repoBadges, suggestBadges, techBadge } from "@/lib/badges";
import type { ProjectSpec } from "@/lib/types";

export const runtime = "nodejs";

type GhRepo = {
  name: string;
  full_name: string;
  description: string | null;
  homepage: string | null;
  html_url: string;
  topics?: string[];
  language: string | null;
  license: { spdx_id?: string; name?: string } | null;
  owner: { login: string; html_url: string };
  default_branch: string;
};

function bad(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function parseRepoInput(input: string): string | null {
  const trimmed = input.trim().replace(/\.git$/, "").replace(/\/+$/, "");
  const url = trimmed.match(/github\.com[/:]([\w.-]+)\/([\w.-]+)/i);
  if (url) return `${url[1]}/${url[2]}`;
  const short = trimmed.match(/^([\w.-]+)\/([\w.-]+)$/);
  if (short) return `${short[1]}/${short[2]}`;
  return null;
}

function ghHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "preface",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

function clip(text: string): string {
  return text.length > 100_000 ? text.slice(0, 100_000) : text;
}

/**
 * Reads a file from the repo root. Tries raw.githubusercontent.com first
 * because it does not consume API quota, then falls back to the Contents API
 * (some networks block or throttle the raw host).
 */
async function fetchTextFile(repo: string, branch: string, path: string): Promise<string | null> {
  try {
    const res = await fetch(`https://raw.githubusercontent.com/${repo}/${branch}/${path}`, {
      headers: { "User-Agent": "preface" },
      cache: "no-store",
    });
    if (res.ok) return clip(await res.text());
  } catch {
    // fall through to the API
  }

  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/contents/${path}?ref=${branch}`, {
      headers: ghHeaders(),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { content?: string; encoding?: string };
    if (data.encoding !== "base64" || !data.content) return null;
    return clip(Buffer.from(data.content, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  let body: { repo?: string };
  try {
    body = await req.json();
  } catch {
    return bad("Request body must be JSON.");
  }

  const slug = parseRepoInput(body.repo ?? "");
  if (!slug) {
    return bad("Enter a GitHub URL or an owner/repo pair.");
  }

  let repo: GhRepo;
  try {
    const res = await fetch(`https://api.github.com/repos/${slug}`, {
      headers: ghHeaders(),
      cache: "no-store",
    });
    if (res.status === 404) return bad(`Repository ${slug} not found, or it is private.`, 404);
    if (res.status === 403) {
      return bad(
        "GitHub rate limit reached. Set GITHUB_TOKEN in .env.local to raise the limit.",
        429,
      );
    }
    if (!res.ok) return bad(`GitHub returned ${res.status}.`, 502);
    repo = (await res.json()) as GhRepo;
  } catch {
    return bad("Could not reach the GitHub API.", 502);
  }

  const branch = repo.default_branch || "main";

  // Pull manifests in parallel; all are optional.
  const [
    languagesRes,
    pkg,
    requirements,
    pyproject,
    cargo,
    gomod,
    envExample,
    actionYml,
    actionYaml,
  ] = await Promise.all([
    fetch(`https://api.github.com/repos/${slug}/languages`, {
      headers: ghHeaders(),
      cache: "no-store",
    })
      .then((r) => (r.ok ? (r.json() as Promise<Record<string, number>>) : {}))
      .catch(() => ({}) as Record<string, number>),
    fetchTextFile(slug, branch, "package.json"),
    fetchTextFile(slug, branch, "requirements.txt"),
    fetchTextFile(slug, branch, "pyproject.toml"),
    fetchTextFile(slug, branch, "Cargo.toml"),
    fetchTextFile(slug, branch, "go.mod"),
    fetchTextFile(slug, branch, ".env.example"),
    fetchTextFile(slug, branch, "action.yml"),
    fetchTextFile(slug, branch, "action.yaml"),
  ]);
  const action = actionYml ?? actionYaml;

  const dump = [
    pkg && `--- package.json ---\n${pkg}`,
    requirements && `--- requirements.txt ---\n${requirements}`,
    pyproject && `--- pyproject.toml ---\n${pyproject}`,
    cargo && `--- Cargo.toml ---\n${cargo}`,
    gomod && `--- go.mod ---\n${gomod}`,
    envExample && `--- .env.example ---\n${envExample}`,
    action && `--- action.yml ---\n${action}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const { spec: analyzed, notes } = analyzeDump(dump || repo.description || repo.name);

  const languages = Object.keys(languagesRes).slice(0, 6);
  const spec: ProjectSpec = {
    ...analyzed,
    name: analyzed.name && analyzed.name !== "My Project" ? analyzed.name : repo.name,
    tagline: repo.description || analyzed.tagline,
    description: repo.description || analyzed.description,
    repoUrl: repo.html_url,
    demoUrl: repo.homepage || analyzed.demoUrl,
    author: repo.owner.login,
    authorUrl: repo.owner.html_url,
    license: repo.license?.spdx_id && repo.license.spdx_id !== "NOASSERTION"
      ? repo.license.spdx_id
      : analyzed.license,
    languages: languages.length ? languages : analyzed.languages,
  };

  // Recompute badges now that we know the real repo slug and language mix.
  const keywords = [
    ...spec.techStack,
    ...languages,
    ...(repo.topics ?? []),
    repo.language ?? "",
  ];
  const matched = suggestBadges(keywords);
  spec.techStack = Array.from(new Set([...spec.techStack, ...matched.map((m) => m.label)]));
  spec.badges = [
    ...repoBadges(slug, spec.license),
    ...matched.slice(0, 12).map((d) => techBadge(d)),
  ];

  spec.sections = {
    ...spec.sections,
    demo: Boolean(spec.demoUrl),
    techStack: spec.techStack.length > 0,
    author: true,
  };

  const gathered = [
    pkg && "package.json",
    requirements && "requirements.txt",
    pyproject && "pyproject.toml",
    cargo && "Cargo.toml",
    gomod && "go.mod",
    envExample && ".env.example",
    action && (actionYml ? "action.yml" : "action.yaml"),
  ].filter(Boolean) as string[];

  return Response.json({
    spec,
    dump,
    notes: [
      `Imported ${repo.full_name}`,
      gathered.length ? `Read ${gathered.join(", ")}` : "No manifests found in the repo root",
      ...notes,
    ],
  });
}
