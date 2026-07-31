export interface SearchHit {
  title: string;
  link: string;
  snippet: string;
}

export function searchConfigured(): boolean {
  return !!process.env.GOOGLE_SEARCH_API_KEY && !!process.env.GOOGLE_SEARCH_CX;
}

/**
 * Site-scoped search via Google Programmable Search (Custom Search JSON API).
 * `siteSearch` + `siteSearchFilter=i` restricts results to the given domain, so
 * one general search engine (cx) can be scoped per request.
 */
export async function siteSearch(
  query: string,
  domain: string,
  num = 5,
): Promise<SearchHit[]> {
  const key = process.env.GOOGLE_SEARCH_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_CX;
  if (!key || !cx) {
    throw new Error(
      "Programmable Search is not configured (GOOGLE_SEARCH_API_KEY / GOOGLE_SEARCH_CX).",
    );
  }

  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", key);
  url.searchParams.set("cx", cx);
  url.searchParams.set("q", query);
  url.searchParams.set("siteSearch", domain);
  url.searchParams.set("siteSearchFilter", "i"); // include ONLY this site
  url.searchParams.set("num", String(Math.min(Math.max(num, 1), 10)));

  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || `Search failed (${res.status}).`);
  }

  interface RawItem {
    title?: string;
    link?: string;
    snippet?: string;
  }
  return (data.items ?? [])
    .map((it: RawItem) => ({
      title: it.title ?? it.link ?? "",
      link: it.link ?? "",
      snippet: it.snippet ?? "",
    }))
    .filter((h: SearchHit) => h.link);
}
