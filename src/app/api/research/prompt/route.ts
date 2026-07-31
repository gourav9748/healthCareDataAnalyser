import { NextResponse } from "next/server";
import { buildResearchPrompt } from "@/lib/research-prompt";
import { getResearchPrompt } from "@/lib/prompt-templates";

export const runtime = "nodejs";

/** Domain normaliser (kept in sync with the research route). */
function cleanDomain(input: string): string {
  return input
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .replace(/[^A-Za-z0-9.-]/g, "")
    .slice(0, 120);
}

/** Returns the prompt the server would build, so the client can preview/edit it. */
export async function POST(request: Request) {
  let body: { query?: unknown; domain?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const query = typeof body.query === "string" ? body.query.trim() : "";
  const domain = typeof body.domain === "string" ? cleanDomain(body.domain) : "";
  if (!query) {
    return NextResponse.json({ error: "Enter a question first." }, { status: 400 });
  }

  const template = await getResearchPrompt();
  return NextResponse.json({
    prompt: buildResearchPrompt(query, domain || undefined, template),
  });
}
