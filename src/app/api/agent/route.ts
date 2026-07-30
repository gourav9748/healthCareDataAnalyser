import { NextResponse } from "next/server";
import { buildPrompt } from "@/lib/prompts";
import { callGemini } from "@/lib/gemini";
import type { AgentRequest } from "@/lib/types";

export const runtime = "nodejs";

/**
 * The agent endpoint — this is what the "Run analysis" button calls.
 *
 * The browser POSTs an analysis TYPE and the data profile here. This route
 * (server-side) builds the real prompt and runs it through an agent. Keys and
 * prompt templates stay on the server and never reach the browser.
 *
 * Resolution order:
 *   1. External agent proxy, if AGENT_ENDPOINT + AGENT_API_KEY are set.
 *   2. Built-in Gemini agent, if GEMINI_API_KEY is set.
 *   3. Fallback: return the prompt the server would have sent (dev mode).
 */
export async function POST(request: Request) {
  let req: AgentRequest;
  try {
    req = (await request.json()) as AgentRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const src = req?.source;
  const hasContent =
    src &&
    ((src.kind === "tabular" && src.stats?.length) ||
      (src.kind === "document" && src.text?.trim()));
  if (!hasContent) {
    return NextResponse.json(
      { error: "No content provided. Upload and analyse a file first." },
      { status: 400 },
    );
  }

  const prompt = buildPrompt(req);

  const endpoint = process.env.AGENT_ENDPOINT;
  const externalKey = process.env.AGENT_API_KEY;
  const hasExternalAgent = endpoint && externalKey && externalKey !== "replace-me";

  // 1. External agent proxy (optional override) ----------------------------
  if (hasExternalAgent) {
    const timeoutMs = Number(process.env.AGENT_TIMEOUT_SECONDS ?? 45) * 1000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const agentRes = await fetch(endpoint!, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${externalKey}`,
        },
        body: JSON.stringify({ prompt, analysisType: req.analysisType }),
        signal: controller.signal,
      });

      if (!agentRes.ok) {
        const detail = await agentRes.text().catch(() => "");
        return NextResponse.json(
          { error: `Agent returned ${agentRes.status}.`, detail: detail.slice(0, 500) },
          { status: 502 },
        );
      }

      const data = await agentRes.json().catch(() => ({}));
      const result =
        data.result ?? data.output ?? data.text ?? data.message ?? JSON.stringify(data);
      return NextResponse.json({ configured: true, provider: "external", result });
    } catch (err) {
      const aborted = err instanceof Error && err.name === "AbortError";
      return NextResponse.json(
        { error: aborted ? "Agent request timed out." : "Failed to reach the agent." },
        { status: aborted ? 504 : 502 },
      );
    } finally {
      clearTimeout(timer);
    }
  }

  // 2. Built-in Gemini agent -----------------------------------------------
  if (process.env.GEMINI_API_KEY) {
    try {
      const result = await callGemini(prompt);
      return NextResponse.json({ configured: true, provider: "gemini", result });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Gemini request failed." },
        { status: 502 },
      );
    }
  }

  // 3. Fallback: not configured --------------------------------------------
  return NextResponse.json({
    configured: false,
    prompt,
    result:
      "⚠️ Agent not configured. Set GEMINI_API_KEY (or an AGENT_ENDPOINT + AGENT_API_KEY) in your environment to get real analysis. Below is the exact prompt this server would send:\n\n" +
      prompt,
  });
}
