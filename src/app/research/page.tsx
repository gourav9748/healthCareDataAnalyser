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
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [queries, setQueries] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setAnswer(null);
    setCitations([]);
    setQueries([]);
    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, domain }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Research failed.");
      setAnswer(data.text ?? "");
      setCitations(data.citations ?? []);
      setQueries(data.queries ?? []);
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
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={run}
            disabled={loading || !query.trim()}
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

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {answer !== null && (
        <div className="mt-6 space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <Markdown>{answer}</Markdown>
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
