import { NextResponse } from "next/server";
import { researchWithGrounding } from "@/lib/gemini";
import { buildResearchPrompt } from "@/lib/research-prompt";
import { getResearchPrompt } from "@/lib/prompt-templates";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_QUERY = 8000;

/** Normalise a user-supplied domain to a bare hostname (e.g. "nice.org.uk"). */
function cleanDomain(input: string): string {
  return input
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .replace(/[^A-Za-z0-9.-]/g, "")
    .slice(0, 120);
}

export async function POST(request: Request) {
  let body: { query?: unknown; domain?: unknown; prompt?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // Use the final (possibly edited) prompt if provided; otherwise build one.
  let prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) {
    const query = typeof body.query === "string" ? body.query.trim() : "";
    const domain = typeof body.domain === "string" ? cleanDomain(body.domain) : "";
    if (!query) {
      return NextResponse.json({ error: "Enter a question to research." }, { status: 400 });
    }
    const template = await getResearchPrompt();
    prompt = buildResearchPrompt(query, domain || undefined, template);
  }

  if (prompt.length > MAX_QUERY) {
    return NextResponse.json(
      { error: `Prompt too long (max ${MAX_QUERY} characters).` },
      { status: 413 },
    );
  }
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "Search is not configured. Set GEMINI_API_KEY." },
      { status: 503 },
    );
  }

  try {
    const result = await researchWithGrounding(prompt);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Research failed." },
      { status: 502 },
    );
  }
}
