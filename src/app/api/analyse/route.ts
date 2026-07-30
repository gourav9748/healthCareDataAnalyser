import { NextResponse } from "next/server";
import { parseCsv } from "@/lib/csv";
import { computeStats } from "@/lib/stats";
import { extractDocx, extractPdf, textStats, MAX_TEXT } from "@/lib/extract";
import type { DocumentDataset, DocumentFileType, TabularDataset } from "@/lib/types";

export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const PREVIEW_ROWS = 50;

/**
 * Backend processing. Accepts a multipart upload and, based on the file type,
 * either parses it as tabular data (CSV) or extracts text from it (PDF / .docx).
 * Returns a preview + computed profile to the client.
 */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected a multipart file upload." },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "That file is empty." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large. Limit is ${MAX_BYTES / (1024 * 1024)} MB.` },
      { status: 413 },
    );
  }

  const filename = file.name.slice(0, 200);
  const lower = filename.toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());

  // --- CSV / tabular -------------------------------------------------------
  if (lower.endsWith(".csv") || file.type === "text/csv") {
    const { columns, rows } = parseCsv(buf.toString("utf-8"));
    if (columns.length === 0 || rows.length === 0) {
      return NextResponse.json(
        { error: "Could not parse any rows. Is this a valid CSV with a header row?" },
        { status: 422 },
      );
    }
    const dataset: TabularDataset = {
      kind: "tabular",
      filename,
      columns,
      rowCount: rows.length,
      preview: rows.slice(0, PREVIEW_ROWS),
      stats: computeStats(columns, rows),
    };
    return NextResponse.json(dataset);
  }

  // --- PDF / Word document -------------------------------------------------
  const isPdf = lower.endsWith(".pdf") || file.type === "application/pdf";
  const isDocx =
    lower.endsWith(".docx") ||
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  if (isPdf || isDocx) {
    const fileType: DocumentFileType = isPdf ? "pdf" : "docx";
    let extracted: { text: string; pageCount: number | null };
    try {
      extracted = isPdf ? await extractPdf(buf) : await extractDocx(buf);
    } catch {
      return NextResponse.json(
        {
          error:
            "Could not read that file. It may be corrupt, empty, or password-protected.",
        },
        { status: 422 },
      );
    }

    const { charCount, wordCount } = textStats(extracted.text);
    if (charCount === 0) {
      return NextResponse.json(
        {
          error:
            fileType === "pdf"
              ? "No selectable text found. This looks like a scanned/image-only PDF — it would need OCR, which isn't supported yet."
              : "No text could be extracted from that document.",
        },
        { status: 422 },
      );
    }

    const truncated = extracted.text.length > MAX_TEXT;
    const dataset: DocumentDataset = {
      kind: "document",
      filename,
      fileType,
      charCount,
      wordCount,
      pageCount: extracted.pageCount,
      truncated,
      text: truncated ? extracted.text.slice(0, MAX_TEXT) : extracted.text,
    };
    return NextResponse.json(dataset);
  }

  // --- Unsupported ---------------------------------------------------------
  if (lower.endsWith(".doc")) {
    return NextResponse.json(
      { error: "Legacy .doc files aren't supported. Please save as .docx or PDF." },
      { status: 415 },
    );
  }
  return NextResponse.json(
    { error: "Unsupported file type. Upload a CSV, PDF, or Word (.docx) file." },
    { status: 415 },
  );
}
