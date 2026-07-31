import { DEFAULT_RESEARCH_PROMPT } from "./prompt-templates";

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
