"use client";

import { useState } from "react";
import type { Analysis, AgentSource, AnalysisType } from "@/lib/types";

const OPTIONS: { value: AnalysisType; label: string }[] = [
  { value: "summary", label: "Summarise" },
  { value: "risk-factors", label: "Identify risk factors" },
  { value: "anomalies", label: "Flag anomalies" },
  { value: "custom", label: "Ask a question…" },
];

function toSource(analysis: Analysis): AgentSource {
  if (analysis.kind === "tabular") {
    return {
      kind: "tabular",
      filename: analysis.filename,
      columns: analysis.columns,
      rowCount: analysis.rowCount,
      stats: analysis.stats,
    };
  }
  return {
    kind: "document",
    filename: analysis.filename,
    fileType: analysis.fileType,
    wordCount: analysis.wordCount,
    charCount: analysis.charCount,
    pageCount: analysis.pageCount,
    truncated: analysis.truncated,
    text: analysis.text,
  };
}

export default function AgentPanel({ analysis }: { analysis: Analysis }) {
  const [analysisType, setAnalysisType] = useState<AnalysisType>("summary");
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runAgent() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysisType,
          question: analysisType === "custom" ? question : undefined,
          source: toSource(analysis),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Agent request failed.");
      setResult(data.result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const subject = analysis.kind === "tabular" ? "dataset profile" : "document text";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-800">Analyse with AI agent</h2>
      <p className="mt-1 text-sm text-slate-500">
        Sends the {subject} to your agent for interpretation.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <select
          value={analysisType}
          onChange={(e) => setAnalysisType(e.target.value as AnalysisType)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        >
          {OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <button
          onClick={runAgent}
          disabled={loading || (analysisType === "custom" && !question.trim())}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Analysing…" : "Run analysis"}
        </button>
      </div>

      {analysisType === "custom" && (
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. What are the key findings in this document?"
          className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        />
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {result && (
        <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
          {result}
        </pre>
      )}
    </div>
  );
}
