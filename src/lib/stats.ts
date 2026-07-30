import type { ColumnStats, ColumnType } from "./types";

const MISSING_TOKENS = new Set(["", "na", "n/a", "null", "none", "-", "nan"]);

function isMissing(value: string): boolean {
  return MISSING_TOKENS.has(value.trim().toLowerCase());
}

function toNumber(value: string): number | null {
  const cleaned = value.replace(/,/g, "").trim();
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Infer a column's type by sampling its non-missing values. */
function inferType(values: string[]): ColumnType {
  const present = values.filter((v) => !isMissing(v));
  if (present.length === 0) return "empty";
  const numericCount = present.filter((v) => toNumber(v) !== null).length;
  return numericCount / present.length >= 0.9 ? "numeric" : "categorical";
}

export function computeColumnStats(name: string, values: string[]): ColumnStats {
  const missing = values.filter(isMissing).length;
  const present = values.filter((v) => !isMissing(v));
  const type = inferType(values);

  if (type === "numeric") {
    const nums = present
      .map(toNumber)
      .filter((n): n is number => n !== null)
      .sort((a, b) => a - b);

    const count = nums.length;
    const sum = nums.reduce((a, b) => a + b, 0);
    const mean = count ? sum / count : 0;
    const variance = count
      ? nums.reduce((a, b) => a + (b - mean) ** 2, 0) / count
      : 0;
    const median = count
      ? count % 2
        ? nums[(count - 1) / 2]
        : (nums[count / 2 - 1] + nums[count / 2]) / 2
      : 0;

    return {
      type: "numeric",
      name,
      count,
      missing,
      mean: round(mean),
      median: round(median),
      min: count ? nums[0] : 0,
      max: count ? nums[count - 1] : 0,
      std: round(Math.sqrt(variance)),
    };
  }

  // Categorical (also covers "empty" columns gracefully).
  const counts = new Map<string, number>();
  for (const v of present) {
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([value, count]) => ({ value, count }));

  return {
    type: "categorical",
    name,
    count: present.length,
    missing,
    unique: counts.size,
    top,
  };
}

export function computeStats(
  columns: string[],
  rows: Record<string, string>[],
): ColumnStats[] {
  return columns.map((col) =>
    computeColumnStats(
      col,
      rows.map((r) => r[col] ?? ""),
    ),
  );
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
