# Freakout.lol

**Freakout.lol** is an open-source platform for Knowledge-graph interrogations & investigation. You define an ontology — nodes, edges, evidence requirements, and output templates — and the platform annotates uploaded documents against it, surfaces gaps, and generates structured outputs with full provenance for human review.

The built-in **Commercial Due Diligence** workflow is the reference implementation: it applies an 8-question knowledge graph to deal documents, extracts claims, entities, and risks, and produces structured reports and analyst enquiries. But the platform is workflow-agnostic — you can build graphs for any evidence-gathering or investigation process.

## Core Concepts

- **Knowledge Graph** — an ontology of nodes (questions, controls, evidence types, risk categories) and edges (requires, satisfies, contradicts) that defines what a workflow needs to know.
- **Assistance Goal** — a project is bound to one graph. The graph drives what evidence is required, what gaps exist, and what the output draft should contain.
- **Evidence Mapping** — after the analysis pipeline runs, findings, claims, and question answers are automatically mapped to graph requirements. Analysts can mark requirements satisfied, partial, or waived.
- **Output Draft** — a section-by-section draft generated from the graph's output template, populated with evidence from the completed pipeline run.

## Tech Stack

- Framework: Next.js 16 (App Router)
- UI: HeroUI + Tailwind CSS v4
- Database: Postgres (Neon-compatible) with Row-Level Security
- ORM: Prisma 7 (`prisma-client` generator, multi-file schema)
- Auth: Auth.js v5 (credentials + LinkedIn OAuth, JWT)
- Workflow Orchestration: `workflow` / `@workflow/next`
- Storage: Vercel Blob
- Graph Canvas: React Flow + Dagre (Graph Studio)
- Error Monitoring: Sentry v10
- Email: Resend
- Billing: Stripe
- Testing: Vitest + React Testing Library

## Product Flow

1. **Platform admin** creates a knowledge graph in Graph Studio (`/admin/graphs`) — defines nodes, edges, evidence requirements, and an output template.
2. **Firm admin** enables the graph for their firm in Settings.
3. **Analyst** creates a project, selects the graph as the assistance goal, and uploads source documents.
4. **Pipeline** runs staged extraction, classification, indexing, corroboration, Q1–Q8 analyses, open questions, summary, and final report.
5. **Evidence mapper** automatically maps pipeline outputs to graph requirements.
6. **Analyst** reviews the evidence gap panel, marks requirements satisfied/waived, and reads the output draft.
7. **Enquiries** let the analyst ask follow-up questions grounded in the completed report and source evidence.

## Graph Studio

Platform admins can create and edit knowledge graphs at `/admin/graphs`. Each graph has:

- **Nodes** — typed ontology concepts (Question, Control, Evidence Type, Risk Category, Output Section, Entity)
- **Edges** — typed relationships between nodes (Requires, Satisfies, Contradicts, Maps To, Escalates To, Part Of)
- **Evidence Requirements** — what each node needs to be satisfied, with priority (high / medium / low)
- **Output Templates** — section schemas that drive the output draft renderer

The canvas uses React Flow with Dagre auto-layout. Nodes are draggable; edges can be drawn by connecting handles or added via the toolbar.

## Documentation Index

- Architecture: [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)
- Database Structure: [`docs/DATABASE.md`](./docs/DATABASE.md)

## Getting Started

```bash
yarn install
yarn prisma generate
yarn dev
```

On a fresh database, start the app with `yarn dev`, open the local URL, and
register the first account. The first registered user is automatically promoted
to platform admin. If `RESEND_API_KEY` is unset or still a `replace-with-*`
placeholder, the account is verified immediately so first setup is not blocked
by email delivery.

`yarn dev` runs local HTTPS using the `mkcert` certificates in `certificates/`.
Next config sets `WORKFLOW_LOCAL_BASE_URL` for local development based on the
dev script protocol, so Workflow callbacks match the running server. If the
certificate root is not installed in your OS trust store, run `mkcert -install`
or use the HTTP command below.

Install the local certificate root:

```bash
mkcert -install
```

The local Workflow readiness checks read the mkcert root directly, so the dev
scripts do not need to set `NODE_EXTRA_CA_CERTS`.

For local HTTP:

```bash
yarn dev:http
```

For local HTTPS explicitly:

```bash
yarn dev:https
```

## Environment Variables

Configure these in `.env` / `.env.local`:

For first local setup, Stripe and Resend can stay unset or as `replace-with-*`
placeholders. Billing/paywall UI is hidden until Stripe is configured, and
transactional email is only required once you want real verification, password
reset, and invite emails.

| Variable                            | Purpose                                                     |
| ----------------------------------- | ----------------------------------------------------------- |
| `DATABASE_URL`                      | Pooled Postgres connection string                           |
| `DIRECT_URL`                        | Direct Postgres connection string (migrations)              |
| `AUTH_SECRET`                       | Auth.js secret                                              |
| `AUTH_URL`                          | App URL (e.g. `https://localhost:3000`)                     |
| `NEXT_PUBLIC_APP_URL`               | Public app origin used by local callbacks                   |
| `WORKFLOW_LOCAL_BASE_URL`           | Optional local Workflow callback origin override            |
| `AUTH_LINKEDIN_ID`                  | LinkedIn OAuth app client ID                                |
| `AUTH_LINKEDIN_SECRET`              | LinkedIn OAuth app client secret                            |
| `NEXT_PUBLIC_SENTRY_DSN`            | Sentry DSN for error monitoring                             |
| `SENTRY_AUTH_TOKEN`                 | Sentry auth token for source map uploads (CI only)          |
| `RESEND_API_KEY`                    | Optional Resend API key for transactional email             |
| `STRIPE_SECRET_KEY`                 | Optional Stripe secret key; enables billing with a seat ID  |
| `STRIPE_WEBHOOK_SECRET`             | Optional Stripe webhook signing secret                      |
| `STRIPE_SEAT_PRICE_ID`              | Optional per-seat Stripe checkout price ID                  |
| `NEXT_PUBLIC_STRIPE_SEAT_PRICE_ID`  | Optional public fallback for the per-seat price ID          |
| `STRIPE_PRO_PRICE_ID`               | Optional Stripe price ID mapped to the pro plan             |
| `STRIPE_GROWTH_PRICE_ID`            | Optional Stripe price ID mapped to the growth plan          |
| `NEXT_PUBLIC_STRIPE_PRICE_ID`       | Legacy/default Stripe growth price fallback                 |
| `BLOB_READ_WRITE_TOKEN`             | Vercel Blob read/write token                                |

## Prisma Workflow

After changing anything in `prisma/models/*.prisma`:

```bash
yarn prisma generate
# Apply migration manually via Node pg client (see existing migration scripts)
```

> **Note:** `prisma migrate dev` uses advisory locks that conflict with Neon's pooled connection. Apply migrations directly via the Node pg client using `DIRECT_URL`.

## Test Commands

```bash
yarn test                 # Unit tests
yarn test:integration     # Integration tests (requires DATABASE_URL)
yarn test:coverage        # Unit tests with coverage report
```

## Demo Files

The `DEMO/` directory contains sample NovaBridge Technologies documents for testing the Commercial Due Diligence workflow.

## Git Hooks

Install local repo hooks once:

```bash
yarn setup:hooks
```

This configures `.githooks/pre-merge-commit` and `.githooks/pre-commit`, which run `yarn build` and `yarn test` when merging into `main` and when committing directly on `main`.
