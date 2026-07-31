/**
 * Builds the prompt for grounded research. Designed for accuracy in regulated
 * healthcare contexts: it asks the model to quote verbatim, cite sources, and
 * say plainly when something isn't found — rather than paraphrase or infer.
 */
export function buildResearchPrompt(query: string, domain?: string): string {
  const parts: string[] = [
    "You are a meticulous healthcare information researcher. Use Google Search to find authoritative, current information to answer the question below.",
  ];

  if (domain) {
    parts.push(
      `Restrict your sources to the website ${domain} only (use site:${domain} in your searches). Prefer official pages on that domain. If the answer is not available on ${domain}, say so explicitly rather than using other sites.`,
    );
  }

  parts.push(
    "Rules:",
    "- Quote the key facts VERBATIM from the source in quotation marks — especially regulated details like reimbursement restrictions, eligibility criteria, stopping rules, dosing, and prices. Do not paraphrase these.",
    "- Do not infer, assume, or fill in gaps. Use only what the sources actually state.",
    "- If the specific information cannot be found in the sources, say clearly that it was not found.",
    "- Where a document has an identifier (e.g. a NICE technology appraisal number like TA986), state it.",
    "- End with a one-line reminder that this is retrieved information and should be verified against the official source.",
    "",
    `Question: ${query}`,
  );

  return parts.join("\n");
}
