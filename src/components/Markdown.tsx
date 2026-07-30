"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders Markdown (as produced by the agent) into styled, readable HTML.
 * react-markdown does not render raw HTML by default, so untrusted model
 * output can't inject markup.
 */
export default function Markdown({ children }: { children: string }) {
  return (
    <div className="prose prose-sm prose-slate max-w-none prose-headings:font-semibold prose-headings:text-slate-800 prose-a:text-brand-600 prose-strong:text-slate-800">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
