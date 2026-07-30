import { EDGE_CONFIG_KEY, type Templates } from "./prompt-templates";

/** Whether the write path (admin save) is configured. */
export function canWriteEdgeConfig(): boolean {
  return !!process.env.EDGE_CONFIG_ID && !!process.env.VERCEL_API_TOKEN;
}

/**
 * Persist templates to Edge Config via the Vercel API. Edge Config is
 * read-optimised, so writes go through api.vercel.com (needs a Vercel API
 * token) rather than the read SDK. Changes propagate without a redeploy.
 */
export async function writeTemplates(templates: Templates): Promise<void> {
  const id = process.env.EDGE_CONFIG_ID;
  const token = process.env.VERCEL_API_TOKEN;
  if (!id || !token) {
    throw new Error(
      "Edge Config write is not configured. Set EDGE_CONFIG_ID and VERCEL_API_TOKEN.",
    );
  }

  const url = new URL(`https://api.vercel.com/v1/edge-config/${id}/items`);
  if (process.env.VERCEL_TEAM_ID) {
    url.searchParams.set("teamId", process.env.VERCEL_TEAM_ID);
  }

  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      items: [{ operation: "upsert", key: EDGE_CONFIG_KEY, value: templates }],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Edge Config write failed (${res.status}). ${detail.slice(0, 300)}`);
  }
}
