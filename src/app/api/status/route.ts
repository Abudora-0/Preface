import {
  OLLAMA_MODEL,
  OLLAMA_URL,
  isEmbeddingModel,
  ollamaStatus,
  resolveProvider,
} from "@/lib/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Tells the client which optional integrations are usable right now.
 *
 * For Ollama that means actually asking the daemon rather than reading an env
 * var: a configured-but-not-running server should present as unavailable so
 * the UI can say so up front instead of failing at generation time.
 */
export async function GET() {
  const provider = resolveProvider();

  if (provider === "ollama") {
    const { up, models } = await ollamaStatus();
    const hasModel = models.some((m) => m === OLLAMA_MODEL || m.startsWith(`${OLLAMA_MODEL}:`));
    const embedding = isEmbeddingModel(OLLAMA_MODEL);
    return Response.json({
      provider,
      ai: up && hasModel && !embedding,
      ollama: {
        up,
        url: OLLAMA_URL,
        model: OLLAMA_MODEL,
        hasModel,
        embedding,
        models: models.slice(0, 20),
      },
      githubToken: Boolean(process.env.GITHUB_TOKEN),
    });
  }

  return Response.json({
    provider,
    ai: Boolean(process.env.ANTHROPIC_API_KEY),
    githubToken: Boolean(process.env.GITHUB_TOKEN),
  });
}
