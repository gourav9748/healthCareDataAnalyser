"use client";

import { useState } from "react";
import FileUpload from "@/components/FileUpload";
import DataTable from "@/components/DataTable";
import StatsPanel from "@/components/StatsPanel";
import DocumentView from "@/components/DocumentView";
import AgentPanel from "@/components/AgentPanel";
import type { Analysis } from "@/lib/types";

export default function Home() {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">
          Healthcare Data Analyser
        </h1>
        <p className="mt-1 text-slate-600">
          Upload a health dataset or document, review the automated profile, and
          analyse it with an AI agent.
        </p>
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
                <AgentPanel analysis={analysis} />
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
                <AgentPanel analysis={analysis} />
              </section>
            </>
          )}
        </div>
      )}
    </main>
  );
}
