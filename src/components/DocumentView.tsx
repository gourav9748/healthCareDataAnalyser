import type { DocumentDataset } from "@/lib/types";

export default function DocumentView({ doc }: { doc: DocumentDataset }) {
  const stats: { label: string; value: string }[] = [
    { label: "Type", value: doc.fileType.toUpperCase() },
    { label: "Words", value: doc.wordCount.toLocaleString() },
    { label: "Characters", value: doc.charCount.toLocaleString() },
  ];
  if (doc.pageCount) {
    stats.push({ label: "Pages", value: String(doc.pageCount) });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm"
          >
            <div className="text-xs uppercase tracking-wide text-slate-500">
              {s.label}
            </div>
            <div className="mt-1 text-lg font-semibold text-slate-800">
              {s.value}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
          <h3 className="text-sm font-semibold text-slate-700">Extracted text</h3>
          {doc.truncated && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
              truncated preview
            </span>
          )}
        </div>
        <pre className="max-h-96 overflow-auto whitespace-pre-wrap px-4 py-3 text-sm text-slate-700">
          {doc.text}
        </pre>
      </div>
    </div>
  );
}
