## Purpose

This file tracks Stage 3 implementation against the Stage 3 MVP plan. Keep it updated as each slice lands so the codebase does not drift from the architecture and build plan.

Related docs:

- [Stage 3 Production Architecture](./STAGE3_PRODUCTION_ARCHITECTURE.md)
- [Stage 3 MVP Build Plan](./STAGE3_MVP.md)

## Status Legend

- `Done` - implemented, tested, and build-verified.
- `Partial` - implemented enough to support the current slice, but known Stage 3 requirements remain.
- `Pending` - not implemented.
- `Blocked` - cannot proceed until an explicit decision or dependency is resolved.

## Current Validation

Last verified after the current Stage 3 slices:

- `yarn prisma generate` passed
- `yarn test` passed: 52 test files, 349 tests
- `yarn build` passed

Known non-blocking warnings:

- jsdom reports `window.scrollTo` is not implemented in several tests.
- Vitest warns about nested `vi.mock` calls in `packages/tests/unit/lib/db.test.ts`.
- Next build warns about multiple lockfiles and inferred Turbopack root.

## Stage 3.1: Tenant Foundation

Status: `Partial`

### Implemented

- Added `Firm`, `FirmMembership`, `FirmRole`, and `FirmMembershipStatus`.
- Added `Project.firmId`.
- Added migration `20260522100000_add_firm_tenancy`.
- Migration creates one default firm per existing user.
- Migration creates owner membership for each existing user.
- Migration backfills existing projects to the user's default firm.
- Added `FirmModel.ensureDefaultForUser`.
- Updated `ProjectModel` count/list/find/create/update/delete paths to scope by active `firmId`.
- Added tests for firm default creation and firm-scoped project model behavior.

### Files

- `prisma/models/firm.prisma`
- `prisma/models/project.prisma`
- `prisma/models/user.prisma`
- `prisma/migrations/20260522100000_add_firm_tenancy/migration.sql`
- `lib/models/FirmModel.ts`
- `lib/models/ProjectModel.ts`
- `packages/tests/unit/lib/models/FirmModel.test.ts`
- `packages/tests/unit/lib/models/ProjectModel.test.ts`

### Still Pending

- Apply migration to live/local database with `yarn prisma migrate dev`.
- Add `firmId` to tenant-critical child tables beyond `Project`.
- Move new blob keys to firm/project-prefixed storage.
- Add database-level RLS policies.
- Add integration tests that prove cross-firm reads are rejected below the model layer.
- Introduce active firm switching once users can belong to multiple firms.

## Stage 3.2: Roles, Permissions, And Audit

Status: `Partial`

### Implemented

- Added firm permission helper with capability-style permissions.
- Added `getActiveFirmSummary` server action.
- Extended `FirmModel` with active firm summary lookup.
- Settings page now displays active firm, role, plan, billing status, and enabled permissions.
- Added localized settings labels.
- Added tests for role permissions, firm summary action, and settings rendering.
- Added firm member listing for users with member-management permission.
- Added action to add an existing registered user to the active firm by email.
- Added action to update active firm member roles.
- Added member-management controls to Settings.
- Added tests for member listing, permission denial, adding members, and role updates.
- Added `AuditLog` and `AuditAction` schema with migration `20260522102000_add_audit_logs`.
- Added audit model helpers for recording and listing firm audit events.
- Added audit writes for member adds and role updates.
- Added owner/admin audit list in Settings.
- Added tests for audit model behavior, audit action permissions, audit writes, and settings rendering.

### Files

- `prisma/models/audit.prisma`
- `prisma/migrations/20260522102000_add_audit_logs/migration.sql`
- `lib/authz/permissions.ts`
- `lib/actions/firm.ts`
- `lib/models/AuditLogModel.ts`
- `lib/models/FirmModel.ts`
- `app/(app)/settings/page.tsx`
- `labels/en/app.ts`
- `labels/types.ts`
- `packages/tests/unit/lib/authz/permissions.test.ts`
- `packages/tests/unit/lib/actions/firm.test.ts`
- `packages/tests/unit/lib/models/AuditLogModel.test.ts`
- `packages/tests/unit/app/pages.test.tsx`

### Still Pending

- Full email invitation flow for users who have not registered yet.
- Project-level membership restrictions.
- Audit writes for billing, graph enablement, document, processing, approval, and export actions.
- Dedicated audit filters/search/export once audit volume grows.

## Stage 3.3: Billing Skeleton

Status: `Partial`

### Implemented

- Added `prisma/models/billing.prisma` with `BillingCustomer`, `Subscription`, `PlanEntitlement`, `UsageMeter`, `InvoiceEvent` models.
- Added `SubscriptionStatus` and `BillingInterval` enums.
- Added migration `20260522110000_add_billing` (applied directly via Node due to Neon advisory lock issue with pooled URL).
- Extended `AuditAction` enum with 13 new values: `BILLING_SUBSCRIPTION_CREATED`, `BILLING_SUBSCRIPTION_UPDATED`, `BILLING_SUBSCRIPTION_CANCELED`, `BILLING_PAYMENT_SUCCEEDED`, `BILLING_PAYMENT_FAILED`, `PROJECT_CREATED`, `PROJECT_DELETED`, `DOCUMENT_UPLOADED`, `DOCUMENT_DELETED`, `WORKFLOW_STARTED`, `WORKFLOW_CANCELED`, `EXPORT_CREATED`, `OUTPUT_APPROVED`.
- Added `lib/models/BillingModel.ts` with plan limits, entitlement checks (`checkProjectCreation`, `checkUpload`, `checkWorkflowRun`, `checkExport`, `checkSeatAvailability`), usage meter helpers, and idempotent `recordInvoiceEvent`.
- Added `lib/stripe.ts` singleton (Stripe SDK v17, API version `2025-02-24.acacia`).
- Added `lib/actions/billing.ts` with `createCheckoutSession`, `createPortalSession`, `getBillingSummary`, `recordBillingAuditEvent`.
- Added `app/api/billing/webhook/route.ts` — idempotent Stripe webhook handler for `customer.subscription.created/updated/deleted`, `invoice.payment_succeeded/failed`. Writes `InvoiceEvent` for deduplication, updates `Subscription`, syncs `Firm.plan`/`billingStatus`, upserts `PlanEntitlement`, writes audit logs.
- Wired entitlement checks into `createProject` (project count limit) and `startProjectDueDiligence` (monthly run limit).
- Added audit writes for `PROJECT_CREATED`, `PROJECT_DELETED`, `WORKFLOW_STARTED`, `WORKFLOW_CANCELED`.
- Wired seat check into `addFirmMemberByEmail`.
- Added billing section to Settings page with plan, status, usage meters (with progress bars), and upgrade/manage CTAs.
- Added billing labels to `labels/en/app.ts` and `labels/types.ts`.
- Added `STRIPE_WEBHOOK_SECRET` and `NEXT_PUBLIC_STRIPE_PRICE_ID` to `.env`.
- Installed `stripe@^17.7.0`.
- Updated all affected tests; all 349 tests pass.

### Files

- `prisma/models/billing.prisma`
- `prisma/models/audit.prisma` (extended AuditAction)
- `prisma/models/firm.prisma` (added billing relations)
- `prisma/migrations/20260522110000_add_billing/migration.sql`
- `lib/stripe.ts`
- `lib/models/BillingModel.ts`
- `lib/actions/billing.ts`
- `lib/actions/project.ts` (entitlement gates + audit writes)
- `lib/actions/firm.ts` (seat check)
- `app/api/billing/webhook/route.ts`
- `app/(app)/settings/page.tsx` (billing section)
- `labels/en/app.ts`
- `labels/types.ts`
- `packages/tests/unit/actions/auth.test.ts`
- `packages/tests/unit/actions/project.test.ts`
- `packages/tests/unit/lib/actions/project.test.ts`
- `packages/tests/unit/lib/actions/firm.test.ts`
- `packages/tests/unit/app/pages.test.tsx`
- `packages/tests/mocks/db.ts`

### Still Pending

- `DOCUMENT_UPLOADED` and `DOCUMENT_DELETED` audit writes (need to wire into document upload/delete API routes).
- `EXPORT_CREATED` and `OUTPUT_APPROVED` audit writes (need to wire when export/approval flows exist).
- Stripe Customer Portal configuration in the Stripe Dashboard (required before `createPortalSession` works in production).
- Price ID mapping: `NEXT_PUBLIC_STRIPE_PRICE_ID` is a single env var; a proper plan selection UI with multiple price IDs is pending.
- Entitlement check for document uploads (`checkUpload` + `incrementUploads`) needs wiring into the document upload API route.
- Entitlement check for exports (`checkExport` + `incrementExports`) needs wiring when export flow exists.
- Usage meter reset is calendar-month based; a Stripe billing-period-aligned reset would be more accurate.
- No billing page separate from Settings — billing is a section within Settings for now.

## Stage 3.4: Graph Workflow MVP

Status: `Partial`

### Implemented

- Added `prisma/models/graph.prisma` with `KnowledgeGraphDefinition`, `OntologyNode`, `OntologyEdge`, `FirmGraphEnablement`, `AssistanceGoal`, `EvidenceRequirement`, `EvidenceMapping`, `OutputTemplate` models and all associated enums.
- Added migration `20260522120000_add_graph_workflow` (applied directly via Node).
- Added `lib/models/GraphModel.ts` — full CRUD for graph definitions, firm enablement, assistance goals, evidence mappings, gap computation, and output templates.
- Added `lib/graph/seeds/commercial-due-diligence.ts` — seeds the first published graph: "Commercial Due Diligence" with 8 nodes (Q1–Q8), 37 evidence requirements, and a CDD report output template.
- Added `lib/graph/seeds/seed.ts` — seed runner (`yarn tsx lib/graph/seeds/seed.ts`). Seed has been run; graph is live in the database.
- Added `lib/actions/graph.ts` — server actions: `listAvailableGraphs`, `listEnabledGraphs`, `enableGraph`, `disableGraph`, `setProjectAssistanceGoal`, `getProjectGoalWithRequirements`, `getProjectGaps`, `getProjectMappings`, `updateEvidenceMapping`, `listAllGraphs`, `publishGraph`, `deprecateGraph`.
- Updated `lib/actions/project.ts` — `createProject` now reads `graphId` from form data and sets the assistance goal if the graph is enabled for the firm.
- Added `app/(app)/project/[id]/GraphPanel.tsx` — client component showing the evidence gap list with priority badges, progress bar, expand-to-mark-satisfied/waived interaction.
- Updated `app/(app)/project/[id]/page.tsx` — fetches graph goal, gaps, and mappings; renders `GraphPanel` when a goal is set.
- Updated `app/(app)/projects/new/page.tsx` — shows assistance goal radio selection (enabled graphs for the firm) during project creation. Shows entitlement error from query param.
- Updated `app/(app)/settings/page.tsx` — added graph enablement section (list published graphs, enable/disable per firm, requires `graphs.enable` permission).
- Added `app/(app)/admin/graphs/page.tsx` — Graph Studio admin page at `/admin/graphs` for publishing and deprecating graph definitions.
- Added `graphWorkflow` labels to `labels/en/app.ts` and `labels/types.ts`.
- Added `projectCreation.assistanceGoalLabel/Hint/noGoalLabel/noGoalHint` labels.
- Updated all affected tests; all 349 tests pass.

### Files

- `prisma/models/graph.prisma`
- `prisma/models/firm.prisma` (added graph relations)
- `prisma/models/project.prisma` (added assistanceGoal + evidenceMappings)
- `prisma/models/user.prisma` (added evidenceMappings)
- `prisma/migrations/20260522120000_add_graph_workflow/migration.sql`
- `lib/models/GraphModel.ts`
- `lib/graph/seeds/commercial-due-diligence.ts`
- `lib/graph/seeds/seed.ts`
- `lib/actions/graph.ts`
- `lib/actions/project.ts` (assistance goal wiring)
- `app/(app)/project/[id]/GraphPanel.tsx`
- `app/(app)/project/[id]/page.tsx`
- `app/(app)/projects/new/page.tsx`
- `app/(app)/settings/page.tsx`
- `app/(app)/admin/graphs/page.tsx`
- `labels/en/app.ts`
- `labels/types.ts`
- `packages/tests/unit/app/pages.test.tsx`

### Still Pending

- Graph Studio UI for creating new graph definitions and adding nodes/requirements (currently only publish/deprecate is exposed; creation is done via seed scripts).
- Automatic evidence mapping from diligence outputs — when a diligence job completes, auto-populate `EvidenceMapping` records from matching findings/claims/chunks.
- Output template draft generation — render a source-backed report draft from the `OutputTemplate` schema and mapped evidence.
- `OntologyEdge` creation UI (edges are defined in schema but no seed or UI creates them yet).
- Per-project assistance goal change after creation (currently set at creation time only).
- `graphs.configure_firm` permission usage (currently only `graphs.enable` is checked).

## Stage 3.5: Hardening

Status: `Pending`

Planned from `STAGE3_MVP.md`:

- RLS policies
- private tenant-scoped blob access checks
- Sentry and structured logs
- dead-letter/retry visibility for processing jobs
- coverage tests for permissions, entitlements, and graph mapping

## MVP Acceptance Criteria Tracking

| Acceptance criterion                                                                                           | Status    | Notes                                                                                                                                                   |
| -------------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A firm owner can create a firm, invite members, and assign roles                                               | `Partial` | Default firm and owner membership exist. Existing registered users can be added and roles can be updated. Email invitations for non-users are pending.  |
| Users only see firm projects they are allowed to access                                                        | `Partial` | `ProjectModel` scopes by active firm. Project-level membership and database RLS are pending.                                                            |
| Cross-firm reads are rejected by service tests and database policy tests                                       | `Partial` | Unit tests cover firm-scoped model queries. Integration/RLS tests are pending.                                                                          |
| Billing status and plan entitlements exist per firm                                                            | `Partial` | `Firm` has `billingStatus` and `plan`. Dedicated billing and entitlement models are pending.                                                            |
| Expensive actions are blocked when entitlements are exceeded                                                   | `Pending` | Requires Stage 3.3 entitlement checks.                                                                                                                  |
| A platform admin can create, edit, version, and publish the first graph ontology                               | `Pending` | Requires Stage 3.4 Graph Studio.                                                                                                                        |
| A firm admin can enable the first knowledge graph workflow for their firm                                      | `Pending` | Requires Stage 3.4 firm graph enablement.                                                                                                               |
| A user can choose an assistance goal, upload documents, and run processing                                     | `Pending` | Project creation exists. Assistance goal selection is pending.                                                                                          |
| The app maps evidence to requirements and surfaces gaps                                                        | `Pending` | Requires Stage 3.4 evidence requirement/mapping models.                                                                                                 |
| The app drafts at least one source-backed output                                                               | `Pending` | Requires Stage 3.4 output template flow.                                                                                                                |
| Audit logs exist for membership, billing, graph enablement, document, processing, approval, and export actions | `Partial` | Membership audit logs exist for member adds and role updates. Billing, graph enablement, document, processing, approval, and export writes are pending. |

## Next Implementation Slice

Recommended next slice: Stage 3.4 — Graph Workflow MVP.

Scope:

- `KnowledgeGraphDefinition`, `OntologyNode`, `OntologyEdge`, `AssistanceGoal`, `EvidenceRequirement`, `EvidenceMapping`, `OutputTemplate` models
- Graph Studio admin area (platform admin creates/versions/publishes graph definitions)
- Firm graph enablement screen (firm admin enables approved graphs)
- Assistance goal selection during project creation
- Evidence requirement and mapping models and UI
- Gap list view
- Source-backed output draft generation

Validation target:

- focused unit tests for graph model helpers and evidence mapping
- full `yarn test`
- `yarn build`
