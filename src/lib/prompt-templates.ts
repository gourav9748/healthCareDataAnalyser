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

/** The Edge Config key under which the admin-controlled templates are stored. */
export const EDGE_CONFIG_KEY = "promptTemplates";

const CACHE_MS = 30_000;
let cache: { at: number; value: Templates } | null = null;

/**
 * Returns the effective templates: admin overrides from Edge Config merged over
 * the built-in defaults. Cached briefly to avoid a lookup on every request, and
 * resilient — any failure falls back to defaults.
 */
export async function getTemplates(): Promise<Templates> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;

  const merged: Templates = { ...DEFAULT_TEMPLATES };
  try {
    const connection = edgeConnectionString();
    if (connection) {
      const client = createClient(connection);
      const stored = (await client.get(EDGE_CONFIG_KEY)) as Templates | undefined;
      if (stored && typeof stored === "object") {
        for (const key of PROMPT_KEYS) {
          const value = stored[key];
          if (typeof value === "string" && value.trim()) merged[key] = value;
        }
      }
    }
  } catch {
    // Ignore and use defaults.
  }

  cache = { at: Date.now(), value: merged };
  return merged;
}

/** Drops the in-memory cache so the next read reflects a just-saved change. */
export function clearTemplateCache(): void {
  cache = null;
}
