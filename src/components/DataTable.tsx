import type { TabularDataset } from "@/lib/types";

export default function DataTable({ dataset }: { dataset: TabularDataset }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {dataset.columns.map((col) => (
              <th key={col} className="whitespace-nowrap px-3 py-2 font-semibold">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dataset.preview.map((row, i) => (
            <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
              {dataset.columns.map((col) => (
                <td key={col} className="whitespace-nowrap px-3 py-2 text-slate-700">
                  {row[col]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-3 py-2 text-xs text-slate-500">
        Showing {dataset.preview.length} of {dataset.rowCount} rows.
      </p>
    </div>
  );
}
