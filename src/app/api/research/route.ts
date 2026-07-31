import { NextResponse } from "next/server";
import { researchWithGrounding, type Citation } from "@/lib/gemini";
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

/**
 * Best-effort source hostname for a citation. Grounding sets `title` to the
 * source's site (e.g. "has-sante.fr") while `uri` is a Google redirect, so we
 * prefer the title when it looks like a domain.
 */
function sourceDomain(c: Citation): string {
  const title = (c.title || "").trim().toLowerCase();
  if (/^[a-z0-9.-]+\.[a-z]{2,}$/.test(title)) return title.replace(/^www\./, "");
  try {
    const host = new URL(c.uri).hostname.toLowerCase().replace(/^www\./, "");
    // Ignore Google's grounding redirect host — it's not the real source.
    if (host.endsWith("google.com")) return "";
    return host;
  } catch {
    return "";
  }
}

function isOnDomain(src: string, domain: string): boolean {
  const d = domain.toLowerCase().replace(/^www\./, "");
  return src === d || src.endsWith("." + d);
}

export async function POST(request: Request) {
  let body: {
    query?: unknown;
    domain?: unknown;
    prompt?: unknown;
    strict?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const domain = typeof body.domain === "string" ? cleanDomain(body.domain) : "";
  const strict = body.strict === true;

  // Use the final (possibly edited) prompt if provided; otherwise build one.
  let prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) {
    const query = typeof body.query === "string" ? body.query.trim() : "";
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

    // Which cited sources fall outside the requested domain?
    const offDomain: string[] = [];
    if (domain) {
      const seen = new Set<string>();
      for (const c of result.citations) {
        const src = sourceDomain(c);
        if (src && !isOnDomain(src, domain) && !seen.has(src)) {
          seen.add(src);
          offDomain.push(src);
        }
      }
    }
    const blocked = strict && !!domain && offDomain.length > 0;

    return NextResponse.json({ ...result, domain, offDomain, blocked });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Research failed." },
      { status: 502 },
    );
  }
}
