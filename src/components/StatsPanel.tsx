import type { ColumnStats } from "@/lib/types";

export default function StatsPanel({ stats }: { stats: ColumnStats[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {stats.map((s) => (
        <div
          key={s.name}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <h3 className="truncate font-semibold text-slate-800">{s.name}</h3>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                s.type === "numeric"
                  ? "bg-brand-50 text-brand-700"
                  : "bg-amber-50 text-amber-700"
              }`}
            >
              {s.type}
            </span>
          </div>

          {s.type === "numeric" ? (
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <Stat label="mean" value={s.mean} />
              <Stat label="median" value={s.median} />
              <Stat label="min" value={s.min} />
              <Stat label="max" value={s.max} />
              <Stat label="std" value={s.std} />
              <Stat label="missing" value={s.missing} />
            </dl>
          ) : (
            <div className="mt-3 text-sm">
              <div className="flex justify-between text-slate-500">
                <span>{s.unique} unique</span>
                <span>{s.missing} missing</span>
              </div>
              <ul className="mt-2 space-y-1">
                {s.top.map((t) => (
                  <li key={t.value} className="flex justify-between">
                    <span className="truncate text-slate-700">{t.value || "—"}</span>
                    <span className="text-slate-400">{t.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <>
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-800">{value}</dd>
    </>
  );
}
