"use client";

import { useRef, useState } from "react";
import type { Analysis } from "@/lib/types";

interface Props {
  onLoaded: (analysis: Analysis) => void;
}

const ACCEPT =
  ".csv,.pdf,.docx,text/csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export default function FileUpload({ onLoaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setFileName(file.name);
    setLoading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/analyse", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to analyse file.");
      onLoaded(data as Analysis);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
        className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white px-6 py-10 text-center transition hover:border-brand-500 hover:bg-brand-50"
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        <p className="text-sm font-medium text-slate-700">
          {loading ? "Analysing…" : "Drop a file here or click to browse"}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {fileName ?? "CSV, PDF, or Word (.docx) · up to 10 MB"}
        </p>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
