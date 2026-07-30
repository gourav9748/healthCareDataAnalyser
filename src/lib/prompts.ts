import { MAX_TEXT } from "./extract";
import { DEFAULT_TEMPLATES, type Templates } from "./prompt-templates";
import type { AgentRequest, ColumnStats } from "./types";

/**
 * Prompt templates are supplied by the caller (from the admin-controlled store,
 * see prompt-templates.ts). The browser sends an analysis *type* (an
 * identifier), never the prompt text itself.
 */
function renderStats(stats: ColumnStats[]): string {
  return stats
    .map((s) => {
      if (s.type === "numeric") {
        return `- ${s.name} (numeric): n=${s.count}, missing=${s.missing}, mean=${s.mean}, median=${s.median}, min=${s.min}, max=${s.max}, std=${s.std}`;
      }
      const top = s.top.map((t) => `${t.value} (${t.count})`).join(", ");
      return `- ${s.name} (categorical): n=${s.count}, missing=${s.missing}, unique=${s.unique}, top: ${top}`;
    })
    .join("\n");
}

export function buildPrompt(
  req: AgentRequest,
  templates: Templates = DEFAULT_TEMPLATES,
): string {
  const instruction =
    templates[req.analysisType] ?? templates.summary ?? DEFAULT_TEMPLATES.summary;
  const src = req.source;
  const parts = [instruction, ""];

  if (src.kind === "tabular") {
    parts.push(
      `Dataset: ${src.filename}`,
      `Rows: ${src.rowCount}`,
      `Columns (${src.columns.length}): ${src.columns.join(", ")}`,
      "",
      "Column profile:",
      renderStats(src.stats),
    );
  } else {
    const meta = [
      `Words: ${src.wordCount}`,
      `Characters: ${src.charCount}`,
      src.pageCount ? `Pages: ${src.pageCount}` : null,
      src.truncated ? `(text truncated to first ${MAX_TEXT} characters)` : null,
    ]
      .filter(Boolean)
      .join(", ");

    parts.push(
      `Document: ${src.filename} (${src.fileType.toUpperCase()})`,
      meta,
      "",
      "Document text:",
      src.text,
    );
  }

  if (req.analysisType === "custom" && req.question) {
    parts.push("", `User question: ${req.question}`);
  }

  parts.push(
    "",
    "Important: this data may relate to real patients. Do not fabricate values. Any conclusions are exploratory and not medical advice.",
  );

  return parts.join("\n");
}
