/**
 * Minimal Google Gemini client. Called server-side only, from /api/agent, so
 * GEMINI_API_KEY never reaches the browser.
 */
const DEFAULT_MODEL = "gemini-2.5-flash";

interface GeminiPart {
  text?: string;
}

/**
 * Opens a streaming (SSE) Gemini request and returns the raw upstream Response.
 * The caller parses the `data:` events; use `geminiTextFromEvent` for that.
 */
export async function openGeminiStream(prompt: string): Promise<Response> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set.");
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

  return fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
      }),
    },
  );
}

/** Extract the incremental text from a single Gemini SSE `data:` payload. */
export function geminiTextFromEvent(jsonStr: string): string {
  try {
    const obj = JSON.parse(jsonStr);
    return (obj?.candidates?.[0]?.content?.parts ?? [])
      .map((p: GeminiPart) => p.text)
      .filter(Boolean)
      .join("");
  } catch {
    return "";
  }
}

export async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set.");

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const timeoutMs = Number(process.env.AGENT_TIMEOUT_SECONDS ?? 45) * 1000;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
        }),
        signal: controller.signal,
      },
    );

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = data?.error?.message || `Gemini returned ${res.status}.`;
      throw new Error(msg);
    }

    const candidate = data?.candidates?.[0];
    const text: string = (candidate?.content?.parts ?? [])
      .map((p: GeminiPart) => p.text)
      .filter(Boolean)
      .join("\n")
      .trim();

    if (!text) {
      const reason =
        data?.promptFeedback?.blockReason || candidate?.finishReason;
      throw new Error(
        reason ? `Gemini returned no text (reason: ${reason}).` : "Gemini returned no text.",
      );
    }

    return text;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Gemini request timed out.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
