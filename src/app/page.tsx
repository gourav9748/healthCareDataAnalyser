"use client";

import { useState } from "react";
import FileUpload from "@/components/FileUpload";
import DataTable from "@/components/DataTable";
import StatsPanel from "@/components/StatsPanel";
import AgentPanel from "@/components/AgentPanel";
import type { Dataset } from "@/lib/types";

export default function Home() {
  const [dataset, setDataset] = useState<Dataset | null>(null);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">
          Healthcare Data Analyser
        </h1>
        <p className="mt-1 text-slate-600">
          Upload a health dataset, review automated statistics, and analyse it with
          an AI agent.
        </p>
      </header>

      <section className="mb-8">
        <FileUpload onLoaded={setDataset} />
        <p className="mt-2 text-xs text-slate-400">
          Data is processed in-memory for this request only and is not persisted.
          Avoid uploading identifiable patient data (PHI) to a shared deployment.
        </p>
      </section>

      {dataset && (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 text-lg font-semibold text-slate-800">
              Column statistics
            </h2>
            <StatsPanel stats={dataset.stats} />
          </section>

          <section>
            <AgentPanel dataset={dataset} />
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-slate-800">
              Data preview
            </h2>
            <DataTable dataset={dataset} />
          </section>
        </div>
      )}
    </main>
  );
}
