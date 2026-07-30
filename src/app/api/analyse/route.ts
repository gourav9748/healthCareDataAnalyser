import { NextResponse } from "next/server";
import { parseCsv } from "@/lib/csv";
import { computeStats } from "@/lib/stats";
import type { Dataset } from "@/lib/types";

export const runtime = "nodejs";

const MAX_CSV_BYTES = 5 * 1024 * 1024; // 5 MB
const PREVIEW_ROWS = 50;

/**
 * Backend processing: accepts raw CSV text, parses it, and computes
 * per-column summary statistics. Returns a preview + stats to the client.
 */
export async function POST(request: Request) {
  let body: { csv?: string; filename?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const csv = body.csv ?? "";
  const filename = (body.filename ?? "dataset.csv").slice(0, 200);

  if (!csv.trim()) {
    return NextResponse.json({ error: "No CSV content provided." }, { status: 400 });
  }
  if (csv.length > MAX_CSV_BYTES) {
    return NextResponse.json(
      { error: `File too large. Limit is ${MAX_CSV_BYTES / (1024 * 1024)} MB.` },
      { status: 413 },
    );
  }

  const { columns, rows } = parseCsv(csv);
  if (columns.length === 0 || rows.length === 0) {
    return NextResponse.json(
      { error: "Could not parse any rows. Is this a valid CSV with a header row?" },
      { status: 422 },
    );
  }

  const stats = computeStats(columns, rows);

  const dataset: Dataset = {
    filename,
    columns,
    rowCount: rows.length,
    preview: rows.slice(0, PREVIEW_ROWS),
    stats,
  };

  return NextResponse.json(dataset);
}
