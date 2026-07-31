import { NextResponse } from "next/server";
import { callGemini, researchWithGrounding, type Citation } from "@/lib/gemini";
import { buildResearchPrompt, buildStrictPrompt } from "@/lib/research-prompt";
import { getResearchPrompt } from "@/lib/prompt-templates";
import { searchConfigured, siteSearch } from "@/lib/google-search";
import { fetchOnDomain } from "@/lib/fetch-page";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_QUERY = 8000;
const PER_PAGE_CHARS = 8000;
const MAX_PAGES = 3;

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
  const query = typeof body.query === "string" ? body.query.trim() : "";

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "Search is not configured. Set GEMINI_API_KEY." },
      { status: 503 },
    );
  }

  // ----- STRICT MODE: search the site, fetch pages, answer closed-book -----
  if (strict) {
    if (!domain) {
      return NextResponse.json(
        { error: "Strict mode needs a domain to restrict to." },
        { status: 400 },
      );
    }
    if (!query) {
      return NextResponse.json({ error: "Enter a question." }, { status: 400 });
    }
    if (!searchConfigured()) {
      return NextResponse.json(
        {
          error:
            "Strict search is not configured. Set GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_CX.",
        },
        { status: 503 },
      );
    }

    try {
      const hits = await siteSearch(query, domain, 6);
      const pages: { url: string; text: string }[] = [];
      for (const hit of hits) {
        if (pages.length >= MAX_PAGES) break;
        const page = await fetchOnDomain(hit.link, domain);
        if (page && page.text) pages.push(page);
      }

      if (pages.length === 0) {
        return NextResponse.json({
          text: `No readable content could be retrieved from ${domain} for this question. The pages may block automated access or contain no extractable text.`,
          citations: [],
          queries: [query],
          domain,
          offDomain: [],
          blocked: false,
          mode: "strict",
        });
      }

      const sources = pages
        .map((p, i) => `[${i + 1}] ${p.url}\n${p.text.slice(0, PER_PAGE_CHARS)}`)
        .join("\n\n---\n\n");
      const text = await callGemini(buildStrictPrompt(query, domain, sources));
      const citations: Citation[] = pages.map((p) => ({ title: p.url, uri: p.url }));

      return NextResponse.json({
        text,
        citations,
        queries: [query],
        domain,
        offDomain: [],
        blocked: false,
        mode: "strict",
      });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Strict search failed." },
        { status: 502 },
      );
    }
  }

  // ----- STANDARD MODE: Gemini grounding -----------------------------------
  // Use the final (possibly edited) prompt if provided; otherwise build one.
  let prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) {
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
