import type { AgentRequest, ColumnStats } from "./types";

/**
 * Prompt templates live on the SERVER only. The browser sends an analysis
 * *type* (an identifier), never the prompt text itself — so the prompt can't
 * be read or tampered with from the client.
 */
const TEMPLATES: Record<string, string> = {
  summary:
    "You are a clinical data analyst. Given the dataset profile below, write a concise plain-language summary of what this dataset contains, its data quality (missing values, outliers), and 3-5 observations a clinician or analyst should note.",
  "risk-factors":
    "You are a clinical data analyst. Based on the dataset profile below, identify which variables are most likely to be relevant risk factors or predictors, explain your reasoning from the distributions, and suggest what further analysis would confirm them. Be explicit that this is exploratory and not a diagnosis.",
  anomalies:
    "You are a data quality specialist. Inspect the dataset profile below and flag anomalies: implausible values, suspicious distributions, high missingness, or inconsistent categories. For each, state the column, the concern, and a recommended remediation.",
  custom:
    "You are a clinical data analyst. Answer the user's question using only the dataset profile below. If the profile is insufficient to answer, say so and state what additional data you would need.",
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
  const { dataset } = req;

  const parts = [
    instruction,
    "",
    `Dataset: ${dataset.filename}`,
    `Rows: ${dataset.rowCount}`,
    `Columns (${dataset.columns.length}): ${dataset.columns.join(", ")}`,
    "",
    "Column profile:",
    renderStats(dataset.stats),
  ];

  if (req.analysisType === "custom" && req.question) {
    parts.push("", `User question: ${req.question}`);
  }

  parts.push(
    "",
    "Important: this data may relate to real patients. Do not fabricate values. Note that any conclusions are exploratory and not medical advice.",
  );

  return parts.join("\n");
}
