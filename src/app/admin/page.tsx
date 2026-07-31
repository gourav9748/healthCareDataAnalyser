"use client";

import { useEffect, useState } from "react";

type Templates = Record<string, string>;

/** Whether a {{name}} placeholder (any spacing) is present in the text. */
function hasToken(text: string | undefined, name: string): boolean {
  if (!text) return false;
  return new RegExp(`\\{\\{\\s*${name}\\s*\\}\\}`, "i").test(text);
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);

  const [keys, setKeys] = useState<string[]>([]);
  const [templates, setTemplates] = useState<Templates>({});
  const [defaults, setDefaults] = useState<Templates>({});
  const [research, setResearch] = useState("");
  const [researchDefault, setResearchDefault] = useState("");
  const [writable, setWritable] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch("/api/admin/prompts");
    if (res.status === 401) {
      setAuthed(false);
      return;
    }
    const data = await res.json();
    setKeys(data.keys ?? []);
    setTemplates(data.templates ?? {});
    setDefaults(data.defaults ?? {});
    setResearch(data.research ?? "");
    setResearchDefault(data.researchDefault ?? "");
    setWritable(data.writable ?? false);
    setAuthed(true);
  }

  useEffect(() => {
    load().finally(() => setChecking(false));
  }, []);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(null);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setLoginError(d.error ?? "Login failed.");
      return;
    }
    setPassword("");
    await load();
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthed(false);
    setTemplates({});
  }

  async function save() {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch("/api/admin/prompts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templates, research }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "Save failed.");
      setStatus("Saved. Changes take effect within ~a minute (no redeploy needed).");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  if (checking) {
    return <main className="mx-auto max-w-md px-4 py-16 text-center text-slate-500">Loading…</main>;
  }

  if (!authed) {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <h1 className="text-xl font-bold text-slate-900">Admin sign in</h1>
        <p className="mt-1 text-sm text-slate-500">
          Enter the admin password to manage prompt templates.
        </p>
        <form onSubmit={login} className="mt-6 space-y-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Admin password"
            autoFocus
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
          {loginError && <p className="text-sm text-red-600">{loginError}</p>}
          <button
            type="submit"
            disabled={!password}
            className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            Sign in
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Prompt templates</h1>
        <button
          onClick={logout}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 transition hover:border-slate-400"
        >
          Sign out
        </button>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        These are the full default prompts users start from for each analysis
        type. Users can still tweak the prompt per run.
      </p>
      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        Placeholders replaced at run time:{" "}
        <code className="rounded bg-white px-1 py-0.5">{"{{data}}"}</code> — the
        dataset profile / document text;{" "}
        <code className="rounded bg-white px-1 py-0.5">{"{{question}}"}</code> —
        the user&apos;s question (custom only). If you omit{" "}
        <code className="rounded bg-white px-1 py-0.5">{"{{data}}"}</code>, the
        data is appended at the end.
      </div>

      {!writable && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Read-only: saving needs <code>EDGE_CONFIG_ID</code> and{" "}
          <code>VERCEL_API_TOKEN</code> set in the environment.
        </div>
      )}

      <div className="mt-6 space-y-6">
        {keys.map((key) => (
          <div key={key}>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-sm font-semibold text-slate-800">{key}</label>
              {defaults[key] && defaults[key] !== templates[key] && (
                <button
                  onClick={() =>
                    setTemplates((t) => ({ ...t, [key]: defaults[key] }))
                  }
                  className="text-xs text-brand-600 hover:underline"
                >
                  Reset to default
                </button>
              )}
            </div>
            <textarea
              value={templates[key] ?? ""}
              onChange={(e) =>
                setTemplates((t) => ({ ...t, [key]: e.target.value }))
              }
              rows={7}
              className="w-full rounded-lg border border-slate-300 p-3 text-sm text-slate-700 focus:border-brand-500 focus:outline-none"
            />
            {!hasToken(templates[key], "data") && (
              <p className="mt-1 text-xs text-amber-600">
                ⚠ No <code>{"{{data}}"}</code> placeholder — the data will be
                appended at the end of this prompt.
              </p>
            )}
            {key === "custom" && !hasToken(templates[key], "question") && (
              <p className="mt-1 text-xs text-amber-600">
                ⚠ No <code>{"{{question}}"}</code> placeholder — the user&apos;s
                question will be appended at the end.
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Research prompt (web search grounding) */}
      <div className="mt-8 border-t border-slate-200 pt-6">
        <div className="mb-1 flex items-center justify-between">
          <label className="text-sm font-semibold text-slate-800">
            research <span className="font-normal text-slate-400">(web research page)</span>
          </label>
          {researchDefault && researchDefault !== research && (
            <button
              onClick={() => setResearch(researchDefault)}
              className="text-xs text-brand-600 hover:underline"
            >
              Reset to default
            </button>
          )}
        </div>
        <div className="mb-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          Placeholders:{" "}
          <code className="rounded bg-white px-1 py-0.5">{"{{query}}"}</code> — the
          user&apos;s question;{" "}
          <code className="rounded bg-white px-1 py-0.5">{"{{domain_instruction}}"}</code>{" "}
          — the site-restriction sentence (auto-filled, empty if no domain given).
        </div>
        <textarea
          value={research}
          onChange={(e) => setResearch(e.target.value)}
          rows={10}
          className="w-full rounded-lg border border-slate-300 p-3 text-sm text-slate-700 focus:border-brand-500 focus:outline-none"
        />
        {!hasToken(research, "query") && (
          <p className="mt-1 text-xs text-amber-600">
            ⚠ No <code>{"{{query}}"}</code> placeholder — the question will be
            appended at the end.
          </p>
        )}
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving || !writable}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        {status && <span className="text-sm text-slate-600">{status}</span>}
      </div>
    </main>
  );
}
