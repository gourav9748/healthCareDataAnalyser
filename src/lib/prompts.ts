import { MAX_TEXT } from "./extract";
import type { AgentRequest, ColumnStats } from "./types";

/**
 * Prompt templates live on the SERVER only. The browser sends an analysis
 * *type* (an identifier), never the prompt text itself — so the prompt can't
 * be read or tampered with from the client.
 */
const TEMPLATES: Record<string, string> = {
  summary:
    "You are a clinical data analyst. Using only the information below, write a concise plain-language summary of what this data contains, note its quality (missing values, gaps, outliers), and give 3-5 observations a clinician or analyst should note.",
  "risk-factors":
    "You are a clinical data analyst. Based on the information below, identify which variables or themes are most likely to be relevant risk factors or predictors, explain your reasoning, and suggest what further analysis would confirm them. Be explicit that this is exploratory and not a diagnosis.",
  anomalies:
    "You are a data quality specialist. Inspect the information below and flag anomalies: implausible values, suspicious distributions, high missingness, inconsistent categories, or contradictory statements. For each, state where it occurs, the concern, and a recommended remediation.",
  custom:
    "You are a clinical data analyst. Answer the user's question using only the information below. If it is insufficient to answer, say so and state what additional data you would need.",
};

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

export function buildPrompt(req: AgentRequest): string {
  const instruction = TEMPLATES[req.analysisType] ?? TEMPLATES.summary;
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
