"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import FileUpload from "@/components/FileUpload";
import DataTable from "@/components/DataTable";
import StatsPanel from "@/components/StatsPanel";
import DocumentView from "@/components/DocumentView";
import AgentPanel from "@/components/AgentPanel";
import ResultView from "@/components/ResultView";
import type { Analysis } from "@/lib/types";

export default function Home() {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [mode, setMode] = useState<"input" | "result">("input");
  const [result, setResult] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function runPrompt(prompt: string) {
    setMode("result");
    setStreaming(true);
    setError(null);
    setResult("");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Analysis failed.");
      }
      if (!res.body) {
        setResult(await res.text());
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setResult(acc);
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return; // user went back
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  // Back to the initial page — reset everything so the user can start again.
  function reset() {
    abortRef.current?.abort();
    setAnalysis(null);
    setMode("input");
    setResult("");
    setError(null);
    setStreaming(false);
  }

  if (mode === "result") {
    return (
      <ResultView
        result={result}
        streaming={streaming}
        error={error}
        onBack={reset}
      />
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Healthcare Data Analyser
          </h1>
          <p className="mt-1 text-slate-600">
            Upload a health dataset or document, review the automated profile, and
            analyse it with an AI agent.
          </p>
        </div>
        <Link
          href="/research"
          className="shrink-0 rounded-lg border border-brand-600 px-3 py-1.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-50"
        >
          Web research →
        </Link>
      </header>

      <section className="mb-8">
        <FileUpload onLoaded={setAnalysis} />
        <p className="mt-2 text-xs text-slate-400">
          Files are processed in-memory for this request only and are not persisted.
          Avoid uploading identifiable patient data (PHI) to a shared deployment.
        </p>
      </section>

      {analysis && (
        <div className="space-y-8">
          {analysis.kind === "tabular" ? (
            <>
              <section>
                <h2 className="mb-3 text-lg font-semibold text-slate-800">
                  Column statistics
                </h2>
                <StatsPanel stats={analysis.stats} />
              </section>

              <section>
                <AgentPanel analysis={analysis} onRun={runPrompt} />
              </section>

              <section>
                <h2 className="mb-3 text-lg font-semibold text-slate-800">
                  Data preview
                </h2>
                <DataTable dataset={analysis} />
              </section>
            </>
          ) : (
            <>
              <section>
                <h2 className="mb-3 text-lg font-semibold text-slate-800">
                  Document profile
                </h2>
                <DocumentView doc={analysis} />
              </section>

              <section>
                <AgentPanel analysis={analysis} onRun={runPrompt} />
              </section>
            </>
          )}
        </div>
      )}
    </main>
  );
}
