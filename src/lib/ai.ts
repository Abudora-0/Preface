import type { ProjectSpec } from "./types";
import { repoBadges, suggestBadges, techBadge } from "./badges";

/**
 * Provider-agnostic layer for the optional AI pass.
 *
 * The deterministic analyzer already produces a complete ProjectSpec, so a
 * model is only ever asked to improve the prose on top of it. That is what
 * makes a small local model a reasonable choice here: facts come from the
 * parser, and a weaker model degrades the writing rather than inventing
 * dependencies that do not exist.
 */

export type AiProvider = "ollama" | "anthropic";

export const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "qwen2.5:1.5b";

/**
 * Which provider to use.
 *
 * Ollama is the default, and Anthropic requires an explicit opt-in via
 * AI_PROVIDER rather than merely finding a key in the environment. A key can
 * easily be present for unrelated reasons (another tool exported it, a shared
 * shell profile), and silently routing generation to a paid API because of an
 * ambient variable is not a decision this code should make for anyone.
 */
/**
 * Whether this deployment offers the generation pass at all.
 *
 * Generation needs a model the server can actually reach. Hosted, the default
 * Ollama URL is the container's own loopback with nothing behind it, so the
 * feature can never work and a disabled button with instructions to run
 * "ollama serve" is advice the visitor cannot act on. Setting this turns the
 * feature off outright rather than showing it broken.
 *
 * Off by default, so a local checkout keeps working with no configuration.
 */
export function aiOffered(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const off = env.PREFACE_DISABLE_AI?.trim().toLowerCase();
  return !(off === "1" || off === "true");
}

export function resolveProvider(
  env: Record<string, string | undefined> = process.env,
): AiProvider {
  return env.AI_PROVIDER?.trim().toLowerCase() === "anthropic"
    ? "anthropic"
    : "ollama";
}

/** Rough parameter count from an Ollama tag such as `qwen2.5:1.5b`. */
export function modelParamsB(model: string): number | null {
  const m = /:(\d+(?:\.\d+)?)b\b/i.exec(model);
  return m ? Number(m[1]) : null;
}

/**
 * Embedding models cannot answer a chat request. Catching that by name gives
 * a clear message instead of a confusing failure at generation time.
 */
export function isEmbeddingModel(model: string): boolean {
  return /embed|minilm|bge-|gte-/i.test(model);
}

/**
 * Local models have far smaller context windows than a hosted one, and Ollama
 * silently drops anything past `num_ctx` rather than erroring. Small models
 * also lose the thread well before they run out of context, so the budget
 * scales with parameter count rather than with what the window nominally
 * allows.
 */
export function clipDump(
  dump: string,
  provider: AiProvider,
  model: string = OLLAMA_MODEL,
): string {
  let limit: number;
  if (provider === "anthropic") {
    limit = 180_000;
  } else {
    const params = modelParamsB(model);
    if (params === null) limit = 24_000;
    else if (params <= 2) limit = 8_000;
    else if (params <= 4) limit = 12_000;
    else if (params <= 9) limit = 24_000;
    else limit = 40_000;
  }
  if (dump.length <= limit) return dump;
  return dump.slice(0, limit) + "\n\n[truncated]";
}

export const SYSTEM = `You write README files for software projects.

You are given a raw dump of project material (manifests, file trees, source files, config, loose notes) plus a deterministic first-pass extraction of that material. Produce structured README content from it.

Rules:
- Ground every claim in the supplied material. Never invent features, dependencies, endpoints, or commands that are not evidenced there. Do not explain how two components relate unless the material states it.
- When the material is thin, write less rather than padding. An empty array is a valid answer.
- Write in plain declarative prose. No marketing language, no "revolutionary", no "seamlessly", no emoji in the text values.
- The tagline is one sentence a stranger can understand without context. Write it in sentence case, not Title Case, and describe what the project does rather than praising it. Good: "Predicts visible satellite passes for any location." Bad: "Predicting Satellite Passes with Precision."
- Feature titles are two to four words. Feature descriptions are one sentence.
- Install commands must match the package manager actually evidenced in the material.
- For env vars, infer the description from how the variable is used in the code.
- For packages, inputs and outputs, describe only the names already listed in the extraction. Never add a name that is not there: those tables are copied into other people's workflows and manifests, so an invented entry breaks them.
- Prefer the deterministic extraction for factual fields (script names, dependency names, env var keys). Improve on it for prose fields (tagline, description, feature wording).
- Return "" for any string you cannot ground, and [] for any list you cannot ground.
- Reply with JSON only. No prose outside the JSON object.`;

const strObj = (props: Record<string, unknown>, required: string[]) => ({
  type: "object",
  additionalProperties: false,
  properties: props,
  required,
});

/** JSON schema shared by both providers. */
export const SPEC_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string" },
    tagline: { type: "string" },
    description: { type: "string" },
    features: {
      type: "array",
      items: strObj({ title: { type: "string" }, desc: { type: "string" } }, [
        "title",
        "desc",
      ]),
    },
    techStack: { type: "array", items: { type: "string" } },
    prerequisites: { type: "array", items: { type: "string" } },
    install: { type: "array", items: { type: "string" } },
    runCmd: { type: "string" },
    usage: { type: "string" },
    usageLang: { type: "string" },
    scripts: {
      type: "array",
      items: strObj(
        {
          name: { type: "string" },
          cmd: { type: "string" },
          desc: { type: "string" },
        },
        ["name", "cmd", "desc"],
      ),
    },
    env: {
      type: "array",
      items: strObj(
        {
          key: { type: "string" },
          desc: { type: "string" },
          example: { type: "string" },
        },
        ["key", "desc", "example"],
      ),
    },
    /*
     * Only the name and a description are asked for. Paths, defaults and the
     * required flag are read out of the manifests, and a model restating them
     * could only get them wrong.
     */
    packages: {
      type: "array",
      items: strObj({ name: { type: "string" }, desc: { type: "string" } }, [
        "name",
        "desc",
      ]),
    },
    inputs: {
      type: "array",
      items: strObj({ name: { type: "string" }, desc: { type: "string" } }, [
        "name",
        "desc",
      ]),
    },
    outputs: {
      type: "array",
      items: strObj({ name: { type: "string" }, desc: { type: "string" } }, [
        "name",
        "desc",
      ]),
    },
    roadmap: { type: "array", items: { type: "string" } },
    faq: {
      type: "array",
      items: strObj({ q: { type: "string" }, a: { type: "string" } }, [
        "q",
        "a",
      ]),
    },
    license: { type: "string" },
  },
  required: [
    "name",
    "tagline",
    "description",
    "features",
    "techStack",
    "prerequisites",
    "install",
    "runCmd",
    "usage",
    "usageLang",
    "scripts",
    "env",
    "packages",
    "inputs",
    "outputs",
    "roadmap",
    "faq",
    "license",
  ],
} as const;

export function buildUserMessage(
  base: ProjectSpec,
  dump: string,
  hint?: string,
): string {
  const extraction: Record<string, unknown> = {
    name: base.name,
    license: base.license,
    packageManager: base.packageManager,
    languages: base.languages,
    techStack: base.techStack,
    scripts: base.scripts,
    envKeys: base.env.map((e) => e.key),
    install: base.install,
  };

  /*
   * These are the names the model is allowed to describe and no more, so it
   * has to be shown them. They are omitted entirely when empty: most projects
   * are neither a workspace nor an Action, and an empty key is context spent
   * for nothing on a model with 16k to work in.
   */
  if (base.packages.length)
    extraction.packages = base.packages.map((p) => p.name);
  if (base.inputs.length) extraction.inputs = base.inputs.map((i) => i.name);
  if (base.outputs.length) extraction.outputs = base.outputs.map((o) => o.name);

  return [
    "## Deterministic extraction (already parsed from the material)",
    "```json",
    JSON.stringify(extraction, null, 2),
    "```",
    "",
    hint ? `## Author's note\n${hint}\n` : "",
    "## Raw project material",
    dump,
  ].join("\n");
}

export class AiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Is the local Ollama server up, and which models does it have? */
export async function ollamaStatus(): Promise<{
  up: boolean;
  models: string[];
}> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, {
      signal: AbortSignal.timeout(1500),
      cache: "no-store",
    });
    if (!res.ok) return { up: false, models: [] };
    const data = (await res.json()) as { models?: { name: string }[] };
    return { up: true, models: (data.models ?? []).map((m) => m.name) };
  } catch {
    return { up: false, models: [] };
  }
}

/**
 * Ollama constrains decoding to the supplied JSON schema, so the response is
 * valid JSON by construction. `num_ctx` has to be set explicitly: the default
 * is small enough that a real project dump would be silently truncated.
 */
/**
 * The order schema-constrained decoding emits top level keys in, which is the
 * order they are declared in SPEC_SCHEMA. Progress is read off this rather
 * than off a timer, so the bar only moves when the model has actually
 * finished a field.
 */
export const SPEC_FIELDS: { key: string; label: string }[] = [
  { key: "name", label: "the name" },
  { key: "tagline", label: "the tagline" },
  { key: "description", label: "the description" },
  { key: "features", label: "features" },
  { key: "techStack", label: "the tech stack" },
  { key: "prerequisites", label: "prerequisites" },
  { key: "install", label: "install steps" },
  { key: "runCmd", label: "the run command" },
  { key: "usage", label: "the usage example" },
  { key: "usageLang", label: "the usage language" },
  { key: "scripts", label: "scripts" },
  { key: "env", label: "environment variables" },
  { key: "packages", label: "workspace packages" },
  { key: "inputs", label: "action inputs" },
  { key: "outputs", label: "action outputs" },
  { key: "roadmap", label: "the roadmap" },
  { key: "faq", label: "the FAQ" },
  { key: "license", label: "the license" },
];

export type GenProgress = { done: number; total: number; field: string };

/**
 * Reads how far the model has got from the JSON it has emitted so far.
 *
 * A key is only counted once it has been written with its colon, so a value
 * that happens to contain the word (`"npm install"`) cannot advance the bar.
 */
export function progressFromPartial(partial: string): GenProgress {
  let done = 0;
  let field = SPEC_FIELDS[0].label;

  for (const f of SPEC_FIELDS) {
    if (new RegExp(`"${f.key}"\\s*:`).test(partial)) {
      done += 1;
      field = f.label;
    }
  }

  return { done, total: SPEC_FIELDS.length, field };
}

export async function callOllama(
  system: string,
  user: string,
  /** Called with everything received so far, whenever more arrives. */
  onPartial?: (partial: string) => void,
): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(180_000),
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: Boolean(onPartial),
        format: SPEC_SCHEMA,
        options: { num_ctx: 16_384, temperature: 0.2 },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new AiError(
        `${OLLAMA_MODEL} did not finish in time. Try a smaller model or a shorter dump.`,
        504,
      );
    }
    throw new AiError(
      `Could not reach Ollama at ${OLLAMA_URL}. Is it running? Start it with "ollama serve".`,
      503,
    );
  }

  if (res.status === 404) {
    throw new AiError(
      `Ollama has no model named "${OLLAMA_MODEL}". Pull it with "ollama pull ${OLLAMA_MODEL}", or set OLLAMA_MODEL to one you have.`,
      404,
    );
  }
  if (!res.ok) {
    throw new AiError(
      `Ollama returned ${res.status}: ${(await res.text()).slice(0, 200)}`,
      502,
    );
  }

  const content = onPartial
    ? await readStream(res, onPartial)
    : await readWhole(res);
  if (!content) throw new AiError("Ollama returned an empty response.", 502);
  return content;
}

async function readWhole(res: Response): Promise<string> {
  const data = (await res.json()) as { message?: { content?: string } };
  return data.message?.content?.trim() ?? "";
}

/**
 * Ollama streams NDJSON, one object per line, each carrying the next slice of
 * content. A slice can be split across reads, so the tail of a chunk is held
 * back until its newline arrives.
 */
async function readStream(
  res: Response,
  onPartial: (partial: string) => void,
): Promise<string> {
  if (!res.body) throw new AiError("Ollama returned no response body.", 502);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffered = "";
  let content = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffered += decoder.decode(value, { stream: true });
      const lines = buffered.split("\n");
      buffered = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const chunk = JSON.parse(trimmed) as {
            message?: { content?: string };
            error?: string;
          };
          if (chunk.error) throw new AiError(`Ollama: ${chunk.error}`, 502);
          if (chunk.message?.content) {
            content += chunk.message.content;
            onPartial(content);
          }
        } catch (err) {
          if (err instanceof AiError) throw err;
          // a malformed line is not worth abandoning a finished generation for
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return content.trim();
}

/**
 * Models sometimes wrap JSON in prose or a fence despite instructions. Pull the
 * outermost object out rather than failing the whole generation over it.
 */
export function extractJson(text: string): Record<string, unknown> {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "");
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1)) as Record<
        string,
        unknown
      >;
    }
    throw new AiError("The model did not return usable JSON.", 502);
  }
}

// ---------------------------------------------------------------------------
// Merging
// ---------------------------------------------------------------------------

type AiSpec = Record<string, unknown>;

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}
function strList(v: unknown): string[] {
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string" && !!x.trim())
    : [];
}

/** AI output wins on prose; deterministic output wins on anything it found. */
/**
 * Applies model written descriptions to entries the parser found, matched on
 * name. Entries the model made up are dropped, and an entry the model did not
 * mention keeps whatever description it already had.
 */
function describeByName<T extends { name: string; desc?: string }>(
  found: T[],
  fromAi: unknown,
): T[] {
  if (!found.length) return found;

  const descByName = new Map<string, string>();
  if (Array.isArray(fromAi)) {
    for (const entry of fromAi as AiSpec[]) {
      const name = str(entry.name);
      const desc = str(entry.desc);
      if (name && desc) descByName.set(name, desc);
    }
  }

  return found.map((entry) => ({
    ...entry,
    desc: descByName.get(entry.name) ?? entry.desc,
  }));
}

export function mergeSpec(base: ProjectSpec, ai: AiSpec): ProjectSpec {
  const spec: ProjectSpec = { ...base };

  spec.name = str(ai.name, base.name);
  spec.tagline = str(ai.tagline, base.tagline);
  spec.description = str(ai.description, base.description);
  spec.license = str(ai.license, base.license ?? "");

  const aiFeatures = Array.isArray(ai.features)
    ? (ai.features as AiSpec[])
        .map((f) => ({ title: str(f.title), desc: str(f.desc) || undefined }))
        .filter((f) => f.title)
    : [];
  if (aiFeatures.length) spec.features = aiFeatures;

  const aiPrereq = strList(ai.prerequisites);
  if (aiPrereq.length) spec.prerequisites = aiPrereq;

  const aiInstall = strList(ai.install);
  if (aiInstall.length) spec.install = aiInstall;

  spec.runCmd = str(ai.runCmd, base.runCmd ?? "") || undefined;

  const aiUsage = str(ai.usage);
  if (aiUsage) {
    spec.usage = aiUsage;
    spec.usageLang = str(ai.usageLang, base.usageLang ?? "");
  }

  // Scripts: keep the real commands from package.json, take AI descriptions.
  if (base.scripts.length) {
    const descByName = new Map<string, string>();
    if (Array.isArray(ai.scripts)) {
      for (const s of ai.scripts as AiSpec[]) {
        const n = str(s.name);
        const d = str(s.desc);
        if (n && d) descByName.set(n, d);
      }
    }
    spec.scripts = base.scripts.map((s) => ({
      ...s,
      desc: descByName.get(s.name) ?? s.desc,
    }));
  } else if (Array.isArray(ai.scripts)) {
    spec.scripts = (ai.scripts as AiSpec[])
      .map((s) => ({
        name: str(s.name),
        cmd: str(s.cmd),
        desc: str(s.desc) || undefined,
      }))
      .filter((s) => s.name);
  }

  // Env: keep detected keys, take AI descriptions; add any AI-only keys.
  const envDesc = new Map<string, { desc?: string; example?: string }>();
  if (Array.isArray(ai.env)) {
    for (const e of ai.env as AiSpec[]) {
      const k = str(e.key);
      if (k) {
        envDesc.set(k, {
          desc: str(e.desc) || undefined,
          example: str(e.example) || undefined,
        });
      }
    }
  }
  const seen = new Set(base.env.map((e) => e.key));
  spec.env = [
    ...base.env.map((e) => ({
      ...e,
      ...(envDesc.get(e.key) ?? {}),
      example: e.example ?? envDesc.get(e.key)?.example,
    })),
    ...[...envDesc.entries()]
      .filter(([k]) => !seen.has(k))
      .map(([key, v]) => ({ key, ...v })),
  ];

  /*
   * Workspace packages and Action inputs and outputs are structural facts,
   * read out of member manifests and action.yml. People copy those tables
   * straight into a workflow file or an install command, so an entry the
   * model invented would not be flat prose, it would be a broken instruction.
   * The parser therefore owns which entries exist and the model may only
   * describe the ones already there.
   */
  spec.packages = describeByName(base.packages, ai.packages);
  spec.inputs = describeByName(base.inputs, ai.inputs);
  spec.outputs = describeByName(base.outputs, ai.outputs);

  spec.roadmap = strList(ai.roadmap);

  spec.faq = Array.isArray(ai.faq)
    ? (ai.faq as AiSpec[])
        .map((f) => ({ q: str(f.q), a: str(f.a) }))
        .filter((f) => f.q && f.a)
    : [];

  const aiTech = strList(ai.techStack);
  if (aiTech.length) {
    spec.techStack = Array.from(new Set([...base.techStack, ...aiTech]));
    const matched = suggestBadges(spec.techStack);
    const repo = spec.repoUrl?.match(/github\.com\/([\w.-]+\/[\w.-]+)/i)?.[1];
    spec.badges = [
      ...repoBadges(repo, spec.license),
      ...matched.slice(0, 12).map((d) => techBadge(d)),
    ];
  }

  spec.sections = {
    ...spec.sections,
    features: spec.features.length > 0,
    techStack: spec.techStack.length > 0,
    scripts: spec.scripts.length > 0,
    env: spec.env.length > 0,
    usage: Boolean(spec.usage),
    roadmap: spec.roadmap.length > 0,
    faq: spec.faq.length > 0,
    structure: Boolean(spec.structure),
  };

  return spec;
}
