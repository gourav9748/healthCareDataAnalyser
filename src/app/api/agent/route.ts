import { NextResponse } from "next/server";
import { buildPrompt } from "@/lib/prompts";
import { openGeminiStream, geminiTextFromEvent } from "@/lib/gemini";
import type { AgentRequest } from "@/lib/types";

export const runtime = "nodejs";
// Allow long, streamed analyses up to 60s (the Vercel Hobby-plan maximum)
// before the function is terminated. Raise on Pro/Enterprise if needed.
export const maxDuration = 60;

const MAX_PROMPT = 100_000;

interface AgentBody {
  prompt?: unknown;
  source?: AgentRequest["source"];
  analysisType?: AgentRequest["analysisType"];
  question?: string;
}

function textStreamHeaders() {
  return {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    "X-Accel-Buffering": "no",
  };
}

/**
 * The agent endpoint — streams the analysis back to the browser as it is
 * generated. Accepts a final `prompt` (possibly edited by the user); if none is
 * given it builds one from the structured request. Keys stay server-side.
 *
 * Resolution order: external agent proxy → Gemini (streamed) → fallback.
 */
export async function POST(request: Request) {
  let body: AgentBody;
  try {
    body = (await request.json()) as AgentBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  let prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt && body.source) {
    prompt = buildPrompt(body as AgentRequest);
  }
  if (!prompt) {
    return NextResponse.json({ error: "No prompt provided." }, { status: 400 });
  }
  if (prompt.length > MAX_PROMPT) {
    return NextResponse.json(
      { error: `Prompt too long (max ${MAX_PROMPT} characters).` },
      { status: 413 },
    );
  }

  // 1. External agent proxy (optional override) — delivered as one chunk.
  const endpoint = process.env.AGENT_ENDPOINT;
  const externalKey = process.env.AGENT_API_KEY;
  if (endpoint && externalKey && externalKey !== "replace-me") {
    try {
      const r = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${externalKey}`,
        },
        body: JSON.stringify({ prompt }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        return NextResponse.json(
          { error: `Agent returned ${r.status}.` },
          { status: 502 },
        );
      }
      const text =
        data.result ?? data.output ?? data.text ?? data.message ?? JSON.stringify(data);
      return new Response(String(text), { headers: textStreamHeaders() });
    } catch {
      return NextResponse.json({ error: "Failed to reach the agent." }, { status: 502 });
    }
  }

  // 2. Gemini (streamed) ----------------------------------------------------
  if (process.env.GEMINI_API_KEY) {
    let upstream: Response;
    try {
      upstream = await openGeminiStream(prompt);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Gemini request failed." },
        { status: 502 },
      );
    }

    if (!upstream.ok || !upstream.body) {
      const data = await upstream.json().catch(() => ({}));
      return NextResponse.json(
        { error: data?.error?.message ?? `Gemini returned ${upstream.status}.` },
        { status: 502 },
      );
    }

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const reader = upstream.body!.getReader();
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        let buffer = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            let nl: number;
            while ((nl = buffer.indexOf("\n")) >= 0) {
              const line = buffer.slice(0, nl).trim();
              buffer = buffer.slice(nl + 1);
              if (line.startsWith("data:")) {
                const jsonStr = line.slice(5).trim();
                if (jsonStr && jsonStr !== "[DONE]") {
                  const text = geminiTextFromEvent(jsonStr);
                  if (text) controller.enqueue(encoder.encode(text));
                }
              }
            }
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(stream, { headers: textStreamHeaders() });
  }

  // 3. Fallback: not configured --------------------------------------------
  return new Response(
    "⚠️ Agent not configured. Set GEMINI_API_KEY in your environment to get real analysis. Below is the prompt this server would send:\n\n" +
      prompt,
    { headers: textStreamHeaders() },
  );
}
