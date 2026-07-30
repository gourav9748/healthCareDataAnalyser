import { NextResponse } from "next/server";
import { buildPrompt } from "@/lib/prompts";
import type { AgentRequest } from "@/lib/types";

export const runtime = "nodejs";

/**
 * Returns the prompt the server would build for a given analysis type + data
 * source, so the client can show it for review/editing before running it.
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

  return NextResponse.json({ prompt: buildPrompt(req) });
}
