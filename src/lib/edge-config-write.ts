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
  const authHeaders = { Authorization: `Bearer ${token}` };

  // Does the item already exist? Decides create vs update (upsert can 404 the
  // very first time an item is written to a store).
  let exists = false;
  const check = await fetch(
    `https://api.vercel.com/v1/edge-config/${id}/item/${encodeURIComponent(EDGE_CONFIG_KEY)}${teamQuery}`,
    { headers: authHeaders },
  );
  if (check.ok) {
    exists = true;
  } else if (check.status !== 404) {
    const detail = await check.text().catch(() => "");
    throw new Error(`Edge Config check failed (${check.status}). ${detail.slice(0, 300)}`);
  }

  const res = await fetch(
    `https://api.vercel.com/v1/edge-config/${id}/items${teamQuery}`,
    {
      method: "PATCH",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [
          {
            operation: exists ? "update" : "create",
            key: EDGE_CONFIG_KEY,
            value: templates,
          },
        ],
      }),
    },
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Edge Config write failed (${res.status}). ${detail.slice(0, 300)}`);
  }
}
