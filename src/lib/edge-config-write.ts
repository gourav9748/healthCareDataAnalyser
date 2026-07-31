import { EDGE_CONFIG_KEY, edgeConnectionString, type Templates } from "./prompt-templates";

/**
 * The Edge/Global Config store id (ecfg_...). Uses EDGE_CONFIG_ID if set,
 * otherwise derives it from the connection string Vercel injected.
 */
export function edgeConfigId(): string | undefined {
  if (process.env.EDGE_CONFIG_ID) return process.env.EDGE_CONFIG_ID;
  const connection = edgeConnectionString();
  return connection?.match(/ecfg_[A-Za-z0-9]+/)?.[0];
}

/** Whether the write path (admin save) is configured. */
export function canWriteEdgeConfig(): boolean {
  return !!edgeConfigId() && !!process.env.VERCEL_API_TOKEN;
}

/**
 * Persist templates to Edge Config via the Vercel API. Edge Config is
 * read-optimised, so writes go through api.vercel.com (needs a Vercel API
 * token) rather than the read SDK. Changes propagate without a redeploy.
 */
export async function writeTemplates(templates: Templates): Promise<void> {
  const id = edgeConfigId();
  const token = process.env.VERCEL_API_TOKEN;
  if (!id || !token) {
    throw new Error(
      "Config write is not set up. Connect a Global/Edge Config store and set VERCEL_API_TOKEN.",
    );
  }

  const teamQuery = process.env.VERCEL_TEAM_ID
    ? `?teamId=${encodeURIComponent(process.env.VERCEL_TEAM_ID)}`
    : "";

  const patch = (operation: "update" | "create") =>
    fetch(`https://api.vercel.com/v1/edge-config/${id}/items${teamQuery}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [{ operation, key: EDGE_CONFIG_KEY, value: templates }],
      }),
    });

  // Try update first; if the item doesn't exist yet, create it. This avoids
  // relying on a separate existence check (which reports inconsistently).
  let res = await patch("update");
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    if (res.status === 400 && /non-?existing/i.test(detail)) {
      res = await patch("create");
      if (!res.ok) {
        const createDetail = await res.text().catch(() => "");
        throw new Error(
          `Edge Config create failed (${res.status}). ${createDetail.slice(0, 300)}`,
        );
      }
    } else {
      throw new Error(`Edge Config write failed (${res.status}). ${detail.slice(0, 300)}`);
    }
  }
}
