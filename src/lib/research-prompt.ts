import { DEFAULT_RESEARCH_PROMPT } from "./prompt-templates";

/**
 * Closed-book prompt for strict mode: the model must answer ONLY from the
 * sources we retrieved from the domain, with no web access.
 */
export function buildStrictPrompt(
  query: string,
  domain: string,
  sources: string,
): string {
  return `You are a meticulous healthcare information researcher. Answer the question using ONLY the sources below, which were retrieved from ${domain}. Do not use any outside knowledge, and do not use any other website.

Rules:
- Quote key facts VERBATIM in the source's original language, in quotation marks, and immediately follow each quote with an English translation in [square brackets]. Write your own explanation in English.
- Use only what the sources actually state. Do not infer, assume, or fill gaps.
- If the answer is not contained in these sources, say clearly that it was not found on ${domain}.
- Cite the source URL(s) you used from the list below.
- End with a one-line reminder that this is retrieved information and should be verified against the official source.

Question: ${query}

Sources from ${domain}:
${sources}`;
}

/**
 * Builds the grounded-research prompt from a template (admin-editable) by
 * substituting placeholders:
 *   {{domain_instruction}} -> the domain restriction (empty if no domain)
 *   {{query}}              -> the user's question
 *
 * Missing placeholders are appended as a fallback, so an edited template can't
 * accidentally drop the question or a domain restriction.
 */
export function buildResearchPrompt(
  query: string,
  domain: string | undefined,
  template: string = DEFAULT_RESEARCH_PROMPT,
): string {
  const domainInstruction = domain
    ? `Restrict your sources to the website ${domain} only (use site:${domain} in your searches). Prefer official pages on that domain. If the answer is not available on ${domain}, say so explicitly rather than using other sites.`
    : "";

  const token = (name: string) => new RegExp(`\\{\\{\\s*${name}\\s*\\}\\}`, "gi");
  const has = (name: string) => new RegExp(`\\{\\{\\s*${name}\\s*\\}\\}`, "i").test(template);

  let out = template;

  const hadDomain = has("domain_instruction");
  out = out.replace(token("domain_instruction"), () => domainInstruction);
  if (!hadDomain && domainInstruction) out = `${domainInstruction}\n\n${out}`;

  const hadQuery = has("query");
  out = out.replace(token("query"), () => query);
  if (!hadQuery) out = `${out}\n\nQuestion: ${query}`;

  return out.trim();
}
