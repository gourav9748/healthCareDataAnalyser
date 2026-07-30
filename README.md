# Healthcare Data Analyser

A full-stack [Next.js](https://nextjs.org) app to upload a health dataset,
compute per-column statistics on the server, and analyse the results with an
AI agent hosted on Vercel.

## Architecture

```
Browser (upload + "Run analysis" button)
   │
   ├── POST /api/analyse ──► parse CSV + compute statistics (server)
   │
   └── POST /api/agent ────► build prompt (server) ──► your Vercel agent
                             (holds AGENT_API_KEY — never sent to browser)
```

The key design rule: **the browser never talks to the agent or holds the API
key.** The button calls this app's own `/api/agent` route, which injects the
prompt and the secret and proxies to your agent. This keeps credentials and
prompt templates server-side.

## Features

- **Upload** a CSV (drag-and-drop or browse) — parsed and profiled server-side.
- **Statistics** — per column: numeric (mean/median/min/max/std/missing) or
  categorical (unique count, top values, missing).
- **AI analysis** — pick an analysis type (summarise, risk factors, anomalies,
  or a custom question) and run it through your agent.

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in your agent details
npm run dev
```

Open http://localhost:3000 and upload `sample-data/patients.csv` to try it.

> Without `AGENT_ENDPOINT` / `AGENT_API_KEY` set, the agent route still works —
> it returns the exact prompt it *would* have sent, so you can develop the UI
> before wiring up the agent.

## Environment variables

| Variable                | Purpose                                             |
| ----------------------- | --------------------------------------------------- |
| `AGENT_ENDPOINT`        | URL of your Vercel-hosted agent.                    |
| `AGENT_API_KEY`         | Secret to authenticate this server → agent.         |
| `AGENT_TIMEOUT_SECONDS` | Max wait before the agent request times out (opt).  |

Set these in Vercel's project settings for production.

## The agent contract

`/api/agent` POSTs to your `AGENT_ENDPOINT`:

```json
{ "prompt": "…full prompt built server-side…", "analysisType": "summary" }
```

with header `Authorization: Bearer <AGENT_API_KEY>`. It reads the reply from any
of `result` / `output` / `text` / `message` in the JSON response. Adjust
`src/app/api/agent/route.ts` to match your agent's actual shape.

## Deploying to Vercel

Push to GitHub and import the repo in Vercel, or:

```bash
npx vercel
```

Add the environment variables in the Vercel dashboard before deploying to
production.

## Roadmap / next steps

- Stream the agent response instead of waiting for the full reply.
- Rate-limit `/api/agent` (e.g. Upstash) — it costs money per call.
- Add auth if the deployment isn't public.
- Persist datasets (currently in-memory per request) if you need history.
- Charts/visualisations for the computed distributions.

## Handling health data responsibly

This is a scaffold. Before using real data: do not upload identifiable patient
information (PHI) to a shared or public deployment, and treat all agent output
as exploratory — **not** medical advice or diagnosis.
