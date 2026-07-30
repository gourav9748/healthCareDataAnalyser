import { MAX_TEXT } from "./extract";
import { DEFAULT_TEMPLATES, type Templates } from "./prompt-templates";
import type { AgentRequest, AgentSource, ColumnStats } from "./types";

/**
 * Prompt templates are full prompts supplied by the caller (from the
 * admin-controlled store, see prompt-templates.ts). They may contain
 * placeholders that this module substitutes at build time:
 *
 *   {{data}}      -> the dataset profile / extracted document text
 *   {{question}}  -> the user's question (custom analysis only)
 *
 * The browser sends an analysis *type* (an identifier), never the prompt text.
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

/** The data block that replaces {{data}} in a template. */
function renderData(src: AgentSource): string {
  if (src.kind === "tabular") {
    return [
      `Dataset: ${src.filename}`,
      `Rows: ${src.rowCount}`,
      `Columns (${src.columns.length}): ${src.columns.join(", ")}`,
      "",
      "Column profile:",
      renderStats(src.stats),
    ].join("\n");
  }

  const meta = [
    `Words: ${src.wordCount}`,
    `Characters: ${src.charCount}`,
    src.pageCount ? `Pages: ${src.pageCount}` : null,
    src.truncated ? `(text truncated to first ${MAX_TEXT} characters)` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return [
    `Document: ${src.filename} (${src.fileType.toUpperCase()})`,
    meta,
    "",
    "Document text:",
    src.text,
  ].join("\n");
}

function tokenRegex(name: string, flags: string): RegExp {
  return new RegExp(`\\{\\{\\s*${name}\\s*\\}\\}`, flags);
}

/** Replace {{name}} with value (function replacer avoids `$` special handling). */
function fillToken(text: string, name: string, value: string): string {
  return text.replace(tokenRegex(name, "gi"), () => value);
}

export function buildPrompt(
  req: AgentRequest,
  templates: Templates = DEFAULT_TEMPLATES,
): string {
  const template =
    templates[req.analysisType] ?? templates.summary ?? DEFAULT_TEMPLATES.summary;

  const dataBlock = renderData(req.source);
  const questionText =
    req.analysisType === "custom" && req.question ? req.question : "";

  let out = template;

  // {{data}} — substitute, or append at the end if the template omits it.
  if (tokenRegex("data", "i").test(out)) {
    out = fillToken(out, "data", dataBlock);
  } else {
    out = `${out}\n\n${dataBlock}`;
  }

  // {{question}} — substitute, or append if custom with a question but no token.
  const hasQuestionToken = tokenRegex("question", "i").test(out);
  out = fillToken(out, "question", questionText);
  if (!hasQuestionToken && questionText) {
    out = `${out}\n\nUser question: ${questionText}`;
  }

  return out.trim();
}
