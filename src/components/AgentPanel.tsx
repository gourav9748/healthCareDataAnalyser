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

interface Props {
  analysis: Analysis;
  onRun: (prompt: string) => void;
}

export default function AgentPanel({ analysis, onRun }: Props) {
  const [analysisType, setAnalysisType] = useState<AnalysisType>("summary");
  const [question, setQuestion] = useState("");
  const [prompt, setPrompt] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Changing the type/question invalidates a previously built prompt.
  function invalidate() {
    setPrompt(null);
    setError(null);
  }

  async function buildPromptText() {
    setBuilding(true);
    setError(null);
    try {
      const res = await fetch("/api/agent/prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysisType,
          question: analysisType === "custom" ? question : undefined,
          source: toSource(analysis),
        }),
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

  const needsQuestion = analysisType === "custom" && !question.trim();

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-800">Analyse with AI agent</h2>
      <p className="mt-1 text-sm text-slate-500">
        Build the prompt, tweak it if you like, then run it.
      </p>

      {/* Step 1: choose analysis type + build the prompt */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <select
          value={analysisType}
          onChange={(e) => {
            setAnalysisType(e.target.value as AnalysisType);
            invalidate();
          }}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        >
          {OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <button
          onClick={buildPromptText}
          disabled={building || needsQuestion}
          className="rounded-lg border border-brand-600 px-4 py-2 text-sm font-semibold text-brand-700 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {building ? "Building…" : prompt === null ? "Build prompt" : "Rebuild prompt"}
        </button>
      </div>

      {analysisType === "custom" && (
        <input
          value={question}
          onChange={(e) => {
            setQuestion(e.target.value);
            invalidate();
          }}
          placeholder="e.g. What are the key findings in this document?"
          className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        />
      )}

      {/* Step 2: review / edit the prompt, then run */}
      {prompt !== null && (
        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Prompt <span className="text-slate-400">(editable — tweak before running)</span>
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
              onClick={() => prompt.trim() && onRun(prompt)}
              disabled={!prompt.trim()}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Run analysis
            </button>
            <span className="text-xs text-slate-400">
              {prompt.length.toLocaleString()} characters
            </span>
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
