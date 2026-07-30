"use client";

import Markdown from "@/components/Markdown";

interface Props {
  result: string;
  streaming: boolean;
  error: string | null;
  onBack: () => void;
}

export default function ResultView({ result, streaming, error, onBack }: Props) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-brand-500 hover:text-brand-700"
      >
        <span aria-hidden>←</span> Back
      </button>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : result === "" && streaming ? (
          <p className="text-sm text-slate-400">Generating…</p>
        ) : (
          <Markdown>{result}</Markdown>
        )}
      </div>

      {streaming && !error && (
        <p className="mt-3 text-center text-xs text-slate-400">Analysing…</p>
      )}
    </main>
  );
}
