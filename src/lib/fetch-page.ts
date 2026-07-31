import { convert } from "html-to-text";
import { extractPdf } from "./extract";

const FETCH_TIMEOUT_MS = 15000;
const MAX_BYTES = 3 * 1024 * 1024; // 3 MB per page

/** True if `host` is the domain or a subdomain of it. */
export function isOnDomain(host: string, domain: string): boolean {
  const h = host.toLowerCase().replace(/^www\./, "");
  const d = domain.toLowerCase().replace(/^www\./, "");
  return h === d || h.endsWith("." + d);
}

/**
 * Fetch a single page, but ONLY if its hostname is on the allowed domain
 * (enforced here — this is the guarantee that strict mode stays on-site, and
 * also the SSRF guard). Returns extracted text, or null if it can't be used.
 */
export async function fetchOnDomain(
  rawUrl: string,
  domain: string,
): Promise<{ url: string; text: string } | null> {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (!isOnDomain(u.hostname, domain)) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(u, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; HealthcareDataAnalyser/1.0; +research)",
        Accept: "text/html,application/xhtml+xml,application/pdf,*/*",
      },
    });
    if (!res.ok) return null;

    // Guard against a redirect that left the allowed domain.
    if (!isOnDomain(new URL(res.url).hostname, domain)) return null;

    const contentType = (res.headers.get("content-type") || "").toLowerCase();
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_BYTES) return null;

    let text = "";
    if (contentType.includes("pdf") || u.pathname.toLowerCase().endsWith(".pdf")) {
      const extracted = await extractPdf(buf);
      text = extracted.text;
    } else if (contentType.includes("html") || contentType.includes("text")) {
      text = convert(buf.toString("utf-8"), {
        wordwrap: false,
        selectors: [
          { selector: "a", options: { ignoreHref: true } },
          { selector: "img", format: "skip" },
          { selector: "nav", format: "skip" },
          { selector: "footer", format: "skip" },
          { selector: "script", format: "skip" },
          { selector: "style", format: "skip" },
        ],
      });
    } else {
      return null;
    }

    text = text.replace(/\n{3,}/g, "\n\n").trim();
    return text ? { url: res.url, text } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
