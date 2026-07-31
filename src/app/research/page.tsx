"use client";

import Link from "next/link";
import { useState } from "react";
import Markdown from "@/components/Markdown";

interface Citation {
  title: string;
  uri: string;
}

export default function ResearchPage() {
  const [query, setQuery] = useState("");
  const [domain, setDomain] = useState("");
  const [prompt, setPrompt] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [strict, setStrict] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [queries, setQueries] = useState<string[]>([]);
  const [offDomain, setOffDomain] = useState<string[]>([]);
  const [blocked, setBlocked] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editing the question/domain invalidates a previously built prompt.
  function invalidate() {
    setPrompt(null);
    setError(null);
  }

  async function buildPrompt() {
    if (!query.trim()) return;
    setBuilding(true);
    setError(null);
    setAnswer(null);
    try {
      const res = await fetch("/api/research/prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, domain }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to build prompt.");
      setPrompt(data.prompt);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBuilding(false);
    }
  }

  async function run() {
    if (!prompt?.trim()) return;
    setLoading(true);
    setError(null);
    setAnswer(null);
    setCitations([]);
    setQueries([]);
    setOffDomain([]);
    setBlocked(false);
    setReveal(false);
    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, domain, strict }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Research failed.");
      setAnswer(data.text ?? "");
      setCitations(data.citations ?? []);
      setQueries(data.queries ?? []);
      setOffDomain(data.offDomain ?? []);
      setBlocked(data.blocked ?? false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
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
        Ask a question and get an answer grounded in live Google Search results,
        with verbatim quotes and source citations. Optionally restrict to a
        single trusted website.
      </p>

      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Question
          </label>
          <textarea
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              invalidate();
            }}
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
            onChange={(e) => {
              setDomain(e.target.value);
              invalidate();
            }}
            placeholder="e.g. nice.org.uk"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-brand-500 focus:outline-none"
          />
          {domain.trim() && (
            <label className="mt-2 flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={strict}
                onChange={(e) => setStrict(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Strict: hold the answer if any source falls outside this domain
            </label>
          )}
        </div>
        <div>
          <button
            onClick={buildPrompt}
            disabled={building || loading || !query.trim()}
            className="rounded-lg border border-brand-600 px-4 py-2 text-sm font-semibold text-brand-700 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {building ? "Building…" : prompt === null ? "Build prompt" : "Rebuild prompt"}
          </button>
        </div>

        {prompt !== null && (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Prompt <span className="text-slate-400">(review / edit before searching)</span>
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={10}
              spellCheck={false}
              className="w-full rounded-lg border border-slate-300 p-3 font-mono text-xs leading-relaxed text-slate-700 focus:border-brand-500 focus:outline-none"
            />
            <div className="mt-2 flex items-center gap-3">
              <button
                onClick={run}
                disabled={loading || !prompt.trim()}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Researching…" : "Search"}
              </button>
              {loading && (
                <span className="text-xs text-slate-400">
                  Searching the web and reading sources…
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {answer !== null && (
        <div className="mt-6 space-y-6">
          {offDomain.length > 0 && (
            <div
              className={`rounded-xl border p-4 text-sm ${
                blocked
                  ? "border-red-300 bg-red-50 text-red-800"
                  : "border-amber-300 bg-amber-50 text-amber-800"
              }`}
            >
              <p className="font-semibold">
                {blocked
                  ? `Answer held — sources outside ${domain} were used`
                  : `Sources outside ${domain} were used`}
              </p>
              <p className="mt-1">
                Google Search grounding cannot strictly limit to one site. These
                sources fall outside <code>{domain}</code>:{" "}
                {offDomain.map((d) => (
                  <code key={d} className="mr-1 rounded bg-white/60 px-1">
                    {d}
                  </code>
                ))}
              </p>
              <p className="mt-1">
                {blocked
                  ? "Treat with caution: turn off strict mode to view it, broaden the domain, or rephrase."
                  : "The answer below may draw on these; verify against the official source."}
              </p>
            </div>
          )}

          {(!blocked || reveal) && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <Markdown>{answer}</Markdown>
            </div>
          )}

          {blocked && !reveal && (
            <button
              onClick={() => setReveal(true)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-400"
            >
              Show answer anyway
            </button>
          )}

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
