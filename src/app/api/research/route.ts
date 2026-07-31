import { NextResponse } from "next/server";
import {
  geminiGroundingFromEvent,
  geminiTextFromEvent,
  openGeminiStream,
  type Citation,
} from "@/lib/gemini";
import { buildResearchPrompt, buildStrictPrompt } from "@/lib/research-prompt";
import { getResearchPrompt } from "@/lib/prompt-templates";
import { searchConfigured, siteSearch } from "@/lib/google-search";
import { fetchOnDomain } from "@/lib/fetch-page";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_QUERY = 8000;
const PER_PAGE_CHARS = 8000;
const MAX_PAGES = 3;

/**
 * The answer text streams first; then a metadata frame follows, separated by
 * this control char (never appears in normal text). The client splits on it.
 */
const META_SEP = "\x1f";

function cleanDomain(input: string): string {
  return input
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .replace(/[^A-Za-z0-9.-]/g, "")
    .slice(0, 120);
}

function sourceDomain(c: Citation): string {
  const title = (c.title || "").trim().toLowerCase();
  if (/^[a-z0-9.-]+\.[a-z]{2,}$/.test(title)) return title.replace(/^www\./, "");
  try {
    const host = new URL(c.uri).hostname.toLowerCase().replace(/^www\./, "");
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

function textStreamHeaders() {
  return {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    "X-Accel-Buffering": "no",
  };
}

interface StreamOpts {
  domain: string;
  mode: "standard" | "strict";
  /** Provided in strict mode (known before generation); grounding fills it otherwise. */
  fixedCitations?: Citation[];
  fixedQueries?: string[];
}

/** Wrap a Gemini SSE response into a text stream + trailing metadata frame. */
function streamAnswer(upstream: Response, opts: StreamOpts): Response {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.body!.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      let buffer = "";
      const acc: { grounding: { citations: Citation[]; queries: string[] } | null } = {
        grounding: null,
      };

      const emit = (line: string) => {
        const t = line.trim();
        if (!t.startsWith("data:")) return;
        const json = t.slice(5).trim();
        if (!json || json === "[DONE]") return;
        const text = geminiTextFromEvent(json);
        if (text) controller.enqueue(encoder.encode(text));
        const g = geminiGroundingFromEvent(json);
        if (g && (g.citations.length || g.queries.length)) acc.grounding = g;
      };

      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buffer.indexOf("\n")) >= 0) {
            emit(buffer.slice(0, nl));
            buffer = buffer.slice(nl + 1);
          }
        }
        buffer += decoder.decode();
        for (const line of buffer.split("\n")) emit(line);

        const citations = opts.fixedCitations ?? acc.grounding?.citations ?? [];
        const queries = opts.fixedQueries ?? acc.grounding?.queries ?? [];
        const offDomain: string[] = [];
        if (opts.domain && !opts.fixedCitations) {
          const seen = new Set<string>();
          for (const c of citations) {
            const src = sourceDomain(c);
            if (src && !isOnDomain(src, opts.domain) && !seen.has(src)) {
              seen.add(src);
              offDomain.push(src);
            }
          }
        }

        const meta = { citations, queries, offDomain, mode: opts.mode };
        controller.enqueue(encoder.encode(META_SEP + JSON.stringify(meta)));
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(stream, { headers: textStreamHeaders() });
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

    let pages: { url: string; text: string }[] = [];
    try {
      const hits = await siteSearch(query, domain, 6);
      pages = [];
      for (const hit of hits) {
        if (pages.length >= MAX_PAGES) break;
        const page = await fetchOnDomain(hit.link, domain);
        if (page && page.text) pages.push(page);
      }
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Strict search failed." },
        { status: 502 },
      );
    }

    if (pages.length === 0) {
      const msg = `No readable content could be retrieved from ${domain} for this question. The pages may block automated access or contain no extractable text.`;
      const meta = { citations: [], queries: [query], offDomain: [], mode: "strict" };
      return new Response(msg + META_SEP + JSON.stringify(meta), {
        headers: textStreamHeaders(),
      });
    }

    const sources = pages
      .map((p, i) => `[${i + 1}] ${p.url}\n${p.text.slice(0, PER_PAGE_CHARS)}`)
      .join("\n\n---\n\n");
    const citations: Citation[] = pages.map((p) => ({ title: p.url, uri: p.url }));

    let upstream: Response;
    try {
      upstream = await openGeminiStream(buildStrictPrompt(query, domain, sources), {
        temperature: 0.2,
      });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Gemini request failed." },
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

    return streamAnswer(upstream, {
      domain,
      mode: "strict",
      fixedCitations: citations,
      fixedQueries: [query],
    });
  }

  // ----- STANDARD MODE: Gemini grounding (streamed) ------------------------
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

  let upstream: Response;
  try {
    upstream = await openGeminiStream(prompt, {
      tools: [{ google_search: {} }],
      temperature: 0.2,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Gemini request failed." },
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

  return streamAnswer(upstream, { domain, mode: "standard" });
}
