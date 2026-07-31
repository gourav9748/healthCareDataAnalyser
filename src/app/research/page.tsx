"use client";

import Link from "next/link";
import { useState } from "react";
import Markdown from "@/components/Markdown";

interface Citation {
  title: string;
  uri: string;
}

/** Separates the streamed answer text from the trailing metadata frame. */
const META_SEP = "\x1f";

export default function ResearchPage() {
  const [query, setQuery] = useState("");
  const [domain, setDomain] = useState("");
  const [strict, setStrict] = useState(false);
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [queries, setQueries] = useState<string[]>([]);
  const [offDomain, setOffDomain] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!query.trim()) return;
    if (strict && !domain.trim()) return;

    setLoading(true);
    setError(null);
    setAnswer(null);
    setCitations([]);
    setQueries([]);
    setOffDomain([]);
    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, domain, strict }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Research failed.");
      }
      if (!res.body) {
        applyRaw(await res.text());
        return;
      }
      // Stream the answer text; the trailing frame (after META_SEP) holds metadata.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let raw = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        raw += decoder.decode(value, { stream: true });
        const idx = raw.indexOf(META_SEP);
        setAnswer(idx >= 0 ? raw.slice(0, idx) : raw);
      }
      raw += decoder.decode();
      applyRaw(raw);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function applyRaw(raw: string) {
    const idx = raw.indexOf(META_SEP);
    if (idx < 0) {
      setAnswer(raw);
      return;
    }
    setAnswer(raw.slice(0, idx));
    try {
      const meta = JSON.parse(raw.slice(idx + 1));
      setCitations(meta.citations ?? []);
      setQueries(meta.queries ?? []);
      setOffDomain(meta.offDomain ?? []);
    } catch {
      // Leave citations empty if the metadata frame is malformed.
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Web research</h1>
        <Link
          href="/"
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 transition hover:border-slate-400"
        >
          ← Analyser
        </Link>
      </div>
      <p className="mb-6 text-slate-600">
        Ask a question and get an answer grounded in live web results, with
        verbatim quotes and source citations. Optionally restrict to a single
        trusted website.
      </p>

      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Question
          </label>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            rows={3}
            placeholder="e.g. What is the reimbursement restriction of Ebglyss (lebrikizumab) for atopic dermatitis?"
            className="w-full rounded-lg border border-slate-300 p-3 text-sm text-slate-700 focus:border-brand-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Restrict to website <span className="text-slate-400">(optional)</span>
          </label>
          <input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="e.g. nice.org.uk"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-brand-500 focus:outline-none"
          />
          {domain.trim() && (
            <label className="mt-2 flex items-start gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={strict}
                onChange={(e) => setStrict(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300"
              />
              <span>
                Strict mode — search only this site, read its pages, and answer{" "}
                <em>only</em> from them. Guarantees on-domain sources (works only
                if the site allows fetching).
              </span>
            </label>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={run}
            disabled={loading || !query.trim() || (strict && !domain.trim())}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "Searching…"
              : strict
                ? `Search strictly on ${domain || "domain"}`
                : "Search"}
          </button>
          {loading && (
            <span className="text-xs text-slate-400">
              {strict
                ? "Searching the site and reading pages…"
                : "Searching the web and reading sources…"}
            </span>
          )}
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {answer !== null && (
        <div className="mt-6 space-y-6">
          {offDomain.length > 0 && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
              <p className="font-semibold">Sources outside {domain} were used</p>
              <p className="mt-1">
                Standard search cannot strictly limit to one site. These sources
                fall outside <code>{domain}</code>:{" "}
                {offDomain.map((d) => (
                  <code key={d} className="mr-1 rounded bg-white/60 px-1">
                    {d}
                  </code>
                ))}
              </p>
              <p className="mt-1">
                The answer may draw on these; verify against the official source,
                or use Strict mode for guaranteed on-domain answers.
              </p>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            {answer === "" && loading ? (
              <p className="text-sm text-slate-400">Generating…</p>
            ) : (
              <Markdown>{answer}</Markdown>
            )}
          </div>

          {citations.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-2 text-sm font-semibold text-slate-800">Sources</h2>
              <ol className="list-decimal space-y-1 pl-5 text-sm">
                {citations.map((c, i) => (
                  <li key={i}>
                    <a
                      href={c.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-600 hover:underline"
                    >
                      {c.title}
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {queries.length > 0 && (
            <p className="text-xs text-slate-400">
              Searches run: {queries.map((q) => `“${q}”`).join(", ")}
            </p>
          )}

          <p className="text-xs text-slate-400">
            ⚠ Retrieved with AI + web search. Verify critical details against the
            official source before relying on them.
          </p>
        </div>
      )}
    </main>
  );
}
