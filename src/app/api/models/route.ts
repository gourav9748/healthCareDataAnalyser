import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Diagnostic endpoint: lists the Gemini models your GEMINI_API_KEY can use
 * with generateContent. Handy when Google retires a model — open /api/models
 * on your deployment and set GEMINI_MODEL to one of the names it returns.
 */
export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not set." },
      { status: 400 },
    );
  }

  let res: Response;
  try {
    res = await fetch("https://generativelanguage.googleapis.com/v1beta/models", {
      headers: { "x-goog-api-key": apiKey },
    });
  } catch {
    return NextResponse.json(
      { error: "Could not reach the Gemini API." },
      { status: 502 },
    );
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json(
      { error: data?.error?.message ?? `Listing models failed (${res.status}).` },
      { status: 502 },
    );
  }

  interface RawModel {
    name?: string;
    displayName?: string;
    supportedGenerationMethods?: string[];
  }

  const models = (data.models ?? [])
    .filter((m: RawModel) =>
      (m.supportedGenerationMethods ?? []).includes("generateContent"),
    )
    .map((m: RawModel) => ({
      id: m.name?.replace(/^models\//, ""),
      displayName: m.displayName,
    }));

  return NextResponse.json({ current: process.env.GEMINI_MODEL ?? "gemini-2.5-flash", models });
}
