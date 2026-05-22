# KG Qualify

`KG Qualify` is a document-driven due-diligence prototype for private equity workflows.
It ingests deal documents, runs a staged analysis pipeline, highlights risks/claims/contradictions, generates structured reports, and supports analyst enquiries against generated evidence.

## Assessment Fit

This project addresses the Stage 2 brief by providing:

- Document ingestion for diligence materials.
- Cross-document analysis and corroboration.
- Contradiction and risk surfacing.
- Structured outputs (insights, report artifacts, enquiries).

The sample NovaBridge files are included in [`DEMO/`](./DEMO).

## Tech Stack

- Framework: Next.js 16 (App Router)
- UI: HeroUI + Tailwind CSS v4
- Database: Postgres (Neon-compatible)
- ORM: Prisma 7 (`prisma-client` generator, multi-file schema)
- Auth: Auth.js v5 (credentials-based)
- Workflow Orchestration: `workflow` / `@workflow/next`
- Storage: Vercel Blob
- Testing: Vitest + React Testing Library

## Core Product Flow

1. User creates a project.
2. User uploads source files.
3. User runs due diligence (`Be Diligent`).
4. Workflow executes staged extraction, classification, indexing, corroboration, Q1-Q8 analyses, open questions, summary, final report.
5. Analyst reviews:
   - project-level insights
   - generated report artifacts
   - enquiries chat grounded in report + evidence chunks

## Documentation Index

- Architecture: [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)
- Stage 3 Production Design: [`docs/STAGE3_PRODUCTION_ARCHITECTURE.md`](./docs/STAGE3_PRODUCTION_ARCHITECTURE.md)
- Database Structure: [`docs/DATABASE.md`](./docs/DATABASE.md)
- Next Steps: [`docs/NEXTSTEPS.md`](./docs/NEXTSTEPS.md)

## Getting Started

```bash
yarn install
yarn prisma generate
yarn dev
```

For local HTTPS (using certs in `certificates/`):

```bash
yarn dev:https
```

## Environment Variables

Configure these in `.env` / `.env.local`:

- `DATABASE_URL` - pooled Postgres connection string
- `DIRECT_URL` - direct Postgres connection string (migrations)
- `AUTH_SECRET` - Auth.js secret
- `AUTH_URL` - app URL (for example `http://localhost:3000` or `https://localhost:3000`)

## Prisma Workflow

After changing anything in `prisma/models/*.prisma`:

```bash
yarn prisma generate
yarn prisma migrate dev
```

## Test Commands

```bash
yarn test
yarn test:watch
yarn test:coverage
```

## Git Hooks

Install local repo hooks once:

```bash
yarn setup:hooks
```

This configures `.githooks/pre-merge-commit` and `.githooks/pre-commit`, which run `yarn build` and `yarn test` when merging into `main` and when committing directly on `main`.
