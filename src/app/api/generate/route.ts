import { analyzeDump } from "@/lib/analyze";
import {
  AiError,
  OLLAMA_MODEL,
  SPEC_SCHEMA,
  SYSTEM,
  buildUserMessage,
  callOllama,
  clipDump,
  extractJson,
  mergeSpec,
  resolveProvider,
} from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 300;

const ANTHROPIC_MODEL = "claude-opus-5";

function bad(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

/** Anthropic is loaded lazily so the SDK is never touched on the Ollama path. */
async function callAnthropic(system: string, user: string): Promise<string> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();

  try {
    const response = await client.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 16000,
      system,
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema: SPEC_SCHEMA },
      },
      messages: [{ role: "user", content: user }],
    });

    if (response.stop_reason === "refusal") {
      throw new AiError("The model declined to process this content.", 422);
    }
    const block = response.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") {
      throw new AiError("The model returned no usable content.", 502);
    }
    return block.text;
  } catch (err) {
    if (err instanceof AiError) throw err;
    if (err instanceof Anthropic.AuthenticationError) {
      throw new AiError("ANTHROPIC_API_KEY was rejected.", 401);
    }
    if (err instanceof Anthropic.RateLimitError) {
      throw new AiError("Rate limited by the Claude API. Wait a moment and retry.", 429);
    }
    if (err instanceof Anthropic.APIError) {
      throw new AiError(`Claude API error (${err.status ?? "unknown"}): ${err.message}`, 502);
    }
    throw new AiError("Generation failed unexpectedly.", 500);
  }
}

export async function POST(req: Request) {
  let body: { dump?: string; hint?: string };
  try {
    body = await req.json();
  } catch {
    return bad("Request body must be JSON.");
  }

  const dump = (body.dump ?? "").trim();
  if (dump.length < 20) {
    return bad("Paste more project content, at least a few lines.");
  }

  const provider = resolveProvider();

  // Deterministic pass first: it grounds the model and survives an AI failure.
  const { spec: base, notes } = analyzeDump(dump);
  const user = buildUserMessage(base, clipDump(dump, provider), body.hint);

  try {
    const raw =
      provider === "ollama" ? await callOllama(SYSTEM, user) : await callAnthropic(SYSTEM, user);

    const merged = mergeSpec(base, extractJson(raw));
    return Response.json({
      spec: merged,
      provider,
      notes: [
        ...notes,
        provider === "ollama" ? `Enhanced with ${OLLAMA_MODEL}` : "Enhanced with Claude",
      ],
    });
  } catch (err) {
    if (err instanceof AiError) return bad(err.message, err.status);
    console.error("generate route failed", err);
    return bad("Generation failed unexpectedly.", 500);
  }
}
