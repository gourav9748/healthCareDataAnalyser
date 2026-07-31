import { createClient } from "@vercel/edge-config";

/**
 * The read connection string. Vercel injects this when you connect a store;
 * it is named GLOBAL_CONFIG in the current UI (formerly EDGE_CONFIG).
 */
export function edgeConnectionString(): string | undefined {
  return process.env.GLOBAL_CONFIG || process.env.EDGE_CONFIG;
}

export const PROMPT_KEYS = [
  "summary",
  "risk-factors",
  "anomalies",
  "custom",
] as const;
export type PromptKey = (typeof PROMPT_KEYS)[number];

export type Templates = Record<string, string>;

/**
 * Built-in defaults. These are the seed values and the fallback used whenever
 * Edge Config is not configured, empty, or unreachable — so the app always
 * works even before an admin customises anything.
 */
const FOOTER =
  "Important: this data may relate to real patients. Do not fabricate values. Any conclusions are exploratory and not medical advice.";

export const DEFAULT_TEMPLATES: Templates = {
  summary: `You are a clinical data analyst. Using only the information below, write a concise plain-language summary of what this data contains, note its quality (missing values, gaps, outliers), and give 3-5 observations a clinician or analyst should note.

{{data}}

${FOOTER}`,
  "risk-factors": `You are a clinical data analyst. Based on the information below, identify which variables or themes are most likely to be relevant risk factors or predictors, explain your reasoning, and suggest what further analysis would confirm them. Be explicit that this is exploratory and not a diagnosis.

{{data}}

${FOOTER}`,
  anomalies: `You are a data quality specialist. Inspect the information below and flag anomalies: implausible values, suspicious distributions, high missingness, inconsistent categories, or contradictory statements. For each, state where it occurs, the concern, and a recommended remediation.

{{data}}

${FOOTER}`,
  custom: `You are a clinical data analyst. Answer the user's question using only the information below. If it is insufficient to answer, say so and state what additional data you would need.

{{data}}

User question: {{question}}

${FOOTER}`,
};

/** Key under which the research prompt is stored (inside the same object). */
export const RESEARCH_KEY = "research";

/**
 * Default research prompt (web search grounding). Placeholders filled at build
 * time: {{domain_instruction}} (the domain restriction, empty if none) and
 * {{query}} (the user's question).
 */
export const DEFAULT_RESEARCH_PROMPT = `You are a meticulous healthcare information researcher. Use Google Search to find authoritative, current information to answer the question below.

{{domain_instruction}}

Rules:
- Quote the key facts VERBATIM from the source in quotation marks — especially regulated details like reimbursement restrictions, eligibility criteria, stopping rules, dosing, and prices. Do not paraphrase these.
- Do not infer, assume, or fill in gaps. Use only what the sources actually state.
- If the specific information cannot be found in the sources, say clearly that it was not found.
- Where a document has an identifier (e.g. a NICE technology appraisal number like TA986), state it.
- End with a one-line reminder that this is retrieved information and should be verified against the official source.

Question: {{query}}`;

/** The Edge Config key under which the admin-controlled prompts are stored. */
export const EDGE_CONFIG_KEY = "promptTemplates";

const CACHE_MS = 30_000;
let cache: { at: number; value: Templates } | null = null;

/** Reads the raw stored object (all prompt keys) from Edge Config, cached. */
async function getStored(): Promise<Templates> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;

  let stored: Templates = {};
  try {
    const connection = edgeConnectionString();
    if (connection) {
      const client = createClient(connection);
      const value = (await client.get(EDGE_CONFIG_KEY)) as Templates | undefined;
      if (value && typeof value === "object") stored = value;
    }
  } catch {
    // Ignore and use defaults.
  }

  cache = { at: Date.now(), value: stored };
  return stored;
}

/**
 * The effective analysis templates: admin overrides merged over the built-in
 * defaults. Resilient — any failure falls back to defaults.
 */
export async function getTemplates(): Promise<Templates> {
  const stored = await getStored();
  const merged: Templates = { ...DEFAULT_TEMPLATES };
  for (const key of PROMPT_KEYS) {
    const value = stored[key];
    if (typeof value === "string" && value.trim()) merged[key] = value;
  }
  return merged;
}

/** The effective research prompt: admin override or the built-in default. */
export async function getResearchPrompt(): Promise<string> {
  const stored = await getStored();
  const value = stored[RESEARCH_KEY];
  return typeof value === "string" && value.trim() ? value : DEFAULT_RESEARCH_PROMPT;
}

/** Drops the in-memory cache so the next read reflects a just-saved change. */
export function clearTemplateCache(): void {
  cache = null;
}
