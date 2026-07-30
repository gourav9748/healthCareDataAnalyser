import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/admin-auth";
import {
  DEFAULT_TEMPLATES,
  PROMPT_KEYS,
  clearTemplateCache,
  getTemplates,
} from "@/lib/prompt-templates";
import { canWriteEdgeConfig, writeTemplates } from "@/lib/edge-config-write";

export const runtime = "nodejs";

const MAX_TEMPLATE_CHARS = 4000;

/** Load the current (effective) templates for the admin editor. */
export async function GET() {
  if (!isAuthed()) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const templates = await getTemplates();
  return NextResponse.json({
    templates,
    keys: PROMPT_KEYS,
    defaults: DEFAULT_TEMPLATES,
    writable: canWriteEdgeConfig(),
  });
}

/** Save edited templates to Edge Config. */
export async function PUT(request: Request) {
  if (!isAuthed()) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!canWriteEdgeConfig()) {
    return NextResponse.json(
      {
        error:
          "Saving is not configured. Set EDGE_CONFIG_ID and VERCEL_API_TOKEN to enable writes.",
      },
      { status: 503 },
    );
  }

  let body: { templates?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const incoming = body.templates ?? {};
  const clean: Record<string, string> = {};
  for (const key of PROMPT_KEYS) {
    const value = incoming[key];
    if (typeof value !== "string" || !value.trim()) {
      return NextResponse.json(
        { error: `Template "${key}" must be a non-empty string.` },
        { status: 422 },
      );
    }
    if (value.length > MAX_TEMPLATE_CHARS) {
      return NextResponse.json(
        { error: `Template "${key}" exceeds ${MAX_TEMPLATE_CHARS} characters.` },
        { status: 422 },
      );
    }
    clean[key] = value;
  }

  try {
    await writeTemplates(clean);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to save." },
      { status: 502 },
    );
  }

  clearTemplateCache();
  return NextResponse.json({ ok: true });
}
