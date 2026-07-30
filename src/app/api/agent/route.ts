import { NextResponse } from "next/server";
import { buildPrompt } from "@/lib/prompts";
import type { AgentRequest } from "@/lib/types";

export const runtime = "nodejs";

/**
 * The agent proxy — this is the "button" endpoint.
 *
 * The browser POSTs an analysis TYPE and the dataset profile here. This route
 * (server-side) builds the real prompt and calls the agent hosted on Vercel,
 * attaching the secret key. The key and prompt never reach the browser.
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
  const apiKey = process.env.AGENT_API_KEY;

  // Not configured yet: return the built prompt so the UI still works in dev.
  if (!endpoint || !apiKey || apiKey === "replace-me") {
    return NextResponse.json({
      configured: false,
      prompt,
      result:
        "⚠️ Agent not configured. Set AGENT_ENDPOINT and AGENT_API_KEY in your environment to call your Vercel agent. Below is the exact prompt this server would send:\n\n" +
        prompt,
    });
  }

  const timeoutMs = Number(process.env.AGENT_TIMEOUT_SECONDS ?? 45) * 1000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const agentRes = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
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

    return NextResponse.json({ configured: true, result });
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
