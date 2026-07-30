import mammoth from "mammoth";

/** Max characters of extracted text we keep (and send to the agent). */
export const MAX_TEXT = 20000;

/** Extract text from a PDF buffer. */
export async function extractPdf(
  buf: Buffer,
): Promise<{ text: string; pageCount: number | null }> {
  // Import the library file directly to skip pdf-parse's debug test-file read.
  const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;
  const data = await pdfParse(buf);
  return { text: normalize(data.text), pageCount: data.numpages ?? null };
}

/** Extract raw text from a .docx (Office Open XML) buffer. */
export async function extractDocx(
  buf: Buffer,
): Promise<{ text: string; pageCount: number | null }> {
  const { value } = await mammoth.extractRawText({ buffer: buf });
  // .docx has no reliable page count without rendering, so report null.
  return { text: normalize(value), pageCount: null };
}

export function textStats(text: string): { charCount: number; wordCount: number } {
  const trimmed = text.trim();
  return {
    charCount: text.length,
    wordCount: trimmed ? trimmed.split(/\s+/).length : 0,
  };
}

function normalize(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
