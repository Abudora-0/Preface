import { analyzeDump } from "@/lib/analyze";
import {
  AiError,
  aiOffered,
  OLLAMA_MODEL,
  progressFromPartial,
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

/*
 * Read by the deployment platform, ignored when self-hosted with `next start`.
 * Hosted deployments set PREFACE_DISABLE_AI, so this route answers 404 without
 * doing any work and never approaches the limit. Kept at the common platform
 * ceiling rather than higher, since declaring more than a plan allows is
 * rejected at deploy time. A generation against a reachable model takes 70 to
 * 110 seconds, so anyone hosting this with generation switched on needs to
 * raise it to match their plan.
 */
export const maxDuration = 60;

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
      throw new AiError(
        "Rate limited by the Claude API. Wait a moment and retry.",
        429,
      );
    }
    if (err instanceof Anthropic.APIError) {
      throw new AiError(
        `Claude API error (${err.status ?? "unknown"}): ${err.message}`,
        502,
      );
    }
    throw new AiError("Generation failed unexpectedly.", 500);
  }
}

type Event =
  | { type: "phase"; label: string }
  | {
      type: "progress";
      done: number;
      total: number;
      field: string;
      chars: number;
    }
  | { type: "done"; spec: unknown; notes: string[]; provider: string }
  | { type: "error"; error: string };

export async function POST(req: Request) {
  let body: { dump?: string; hint?: string };
  try {
    body = await req.json();
  } catch {
    return bad("Request body must be JSON.");
  }

  // The UI hides generation on such a deployment, so this is defence in depth.
  if (!aiOffered()) {
    return bad("Generation is not available on this deployment.", 404);
  }

  const dump = (body.dump ?? "").trim();
  if (dump.length < 20) {
    return bad("Paste more project content, at least a few lines.");
  }

  const provider = resolveProvider();

  // Deterministic pass first: it grounds the model and survives an AI failure.
  const { spec: base, notes } = analyzeDump(dump);
  const user = buildUserMessage(base, clipDump(dump, provider), body.hint);

  /*
   * A small local model takes over a minute, so the response is streamed as
   * NDJSON progress events rather than one silent wait. The status line is
   * committed the moment streaming starts, so a failure after that point has
   * to be reported in band as an error event rather than an HTTP status.
   */
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Event) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      try {
        /*
         * Nothing streams until the model is loaded and the prompt evaluated,
         * which was measured at around 30 seconds for a 1.5B model on a cold
         * start. Naming that wait beats a bar sitting at zero unexplained.
         */
        send({
          type: "phase",
          label:
            provider === "ollama"
              ? `Loading ${OLLAMA_MODEL} and reading the dump`
              : "Sending the dump to Claude",
        });

        let raw: string;
        if (provider === "ollama") {
          let lastDone = -1;
          let lastSent = 0;

          raw = await callOllama(SYSTEM, user, (partial) => {
            const now = Date.now();
            const p = progressFromPartial(partial);
            // Emit on real movement, or occasionally so a long field still ticks.
            if (p.done !== lastDone || now - lastSent > 500) {
              lastDone = p.done;
              lastSent = now;
              send({ type: "progress", ...p, chars: partial.length });
            }
          });
        } else {
          raw = await callAnthropic(SYSTEM, user);
        }

        send({ type: "phase", label: "Merging with the parsed facts" });

        const merged = mergeSpec(base, extractJson(raw));
        send({
          type: "done",
          spec: merged,
          provider,
          notes: [
            ...notes,
            provider === "ollama"
              ? `Enhanced with ${OLLAMA_MODEL}`
              : "Enhanced with Claude",
          ],
        });
      } catch (err) {
        if (err instanceof AiError) {
          send({ type: "error", error: err.message });
        } else {
          console.error("generate route failed", err);
          send({ type: "error", error: "Generation failed unexpectedly." });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      // Streaming is pointless if a proxy buffers the whole body first.
      "X-Accel-Buffering": "no",
    },
  });
}
