# VEYRION OS — Architecture map and reconstruction brief

> Working architecture map based on README, audited routes, migration inventory, and inspected code (2026-11-21). Manual synthesis, not a downloaded GitDiagram/GitReverse output.

## External visual tools
- GitDiagram: https://gitdiagram.com/RLGOMES92/veyrion
- GitDiagram Markdown: https://gitdiagram.com/RLGOMES92/veyrion.md
- GitReverse prompt: https://gitreverse.com/RLGOMES92/veyrion

GitDiagram gives an interactive high-level component map. GitReverse produces a synthetic build prompt from public metadata, shallow tree and README; it is not source-code reverse engineering or a specification. These are public repo tools; generated descriptions may be cached/public. Never send secrets or customer data.

## Architecture (known boundaries)

~~~~mermaid
flowchart TD
  U[Team users: Owner / Admin / Sales / Operations / Finance / Viewer] --> UI[Next.js App Router UI]
  UI --> AUTH[Supabase Auth: email OTP]
  UI --> DB[(Supabase workspace data)]
  UI --> API[Next.js API routes]
  API --> AUTHZ[requireUser + session validation]
  AUTHZ --> DB
  DB --> RLS[Organization-scoped RLS + role/module policies]
  RLS --> DATA[Companies / Contacts / Opportunities / Tasks / Assets / Proposals / Contracts / Finance]
  API --> EXT[External services]
  EXT --> CNPJ[Company/CNPJ enrichment providers]
  EXT --> AI[OpenAI assistant analysis]
  EXT --> ZS[ZapSign sandbox/contract signing]
  EXT --> ZO[Zoho CRM integration branch]
  UI --> OPS[Dashboards and CSV/print exports]
  V[Vercel Preview and Production] --> UI
~~~~

## Main user journeys
1. Prospecting: companies, enrichment, contacts and qualification. Enrichment requires a session on the security-fix branch.
2. Sales: opportunities, activities/tasks, follow-up and pipeline.
3. Equipment rental: inventory and supplier catalog; proposal items and availability; proposal creation.
4. Contracts: accepted proposal to draft; validate client, supplier, equipment, dates and signature before activation.
5. Finance: tracking/forecast only. Payments, payouts, split and collection processing remain outside VEYRION.
6. AI assistant: read-only analysis of limited workspace data, authenticated/quota-controlled with deterministic fallback.
7. Integrations: Zoho sync in an open draft PR; ZapSign restricted to sandbox/preview; enrichment API authenticated.

## Security boundaries to validate
- RLS tenant isolation and module permissions for each table/RPC.
- API routes: session checks, authorization, validation, quotas/rate limits, safe error handling.
- External integrations: server-only secrets, webhook verification, retries/idempotency.
- Live migration state, multi-organization behavior, role matrix, Preview/Production env separation.
- Contract is a draft template; legal review and complete company identity are required before signature.

## Suggested staged refactor (not yet implemented)
- A: inventory routes, tables, policies, UI modules and tests; document critical paths.
- B: characterize behavior with tests (auth, tenant scoping, enrichment, duplicate proposal/contract prevention).
- C: split the monolithic app/page.tsx into feature components/hooks without changing behavior.
- D: role/tenant test matrix and responsive smoke checks.
- E: resolve lockfile warning and make install/build/test reproducible.
- F: verify Preview manually, then merge/publish only after evidence.

## Synthetic reconstruction prompt (GitReverse-style, hand-authored)

Build a secure, responsive B2B platform called VEYRION OS for prospecting companies and managing notebook/equipment leasing deals. Use Next.js App Router, React, TypeScript, Supabase Auth and PostgreSQL with organization-scoped Row Level Security and role/module permissions. Support companies and contacts, qualification, opportunities and pipeline, tasks, equipment inventory and supplier catalog, proposals with line items, contract drafts and operational lease lifecycle, audit history, team/invitations, dashboards and financial tracking. Include authenticated API endpoints for company enrichment, read-only AI analysis, contract workflows and optional CRM/e-signature integrations. Protect external API calls with auth, quotas, validation, idempotency and server-only secrets. Integrations must be isolated and disabled unless explicitly configured; signing should be sandbox-only in previews. The financial module must record/forecast only: actual payments, collection, split and payouts occur outside the platform. Provide CSV export and printable proposals, responsive desktop/mobile UI, accessible navigation, clear error states, deterministic fallback behavior, tests for tenant isolation and critical workflows, and staged deployment using Vercel Preview before Production. Preserve existing business data and behavior; do not perform a wholesale rewrite. Make changes incrementally, document migrations, and never commit secrets.

## Review caveats
- This map is an orientation, not an exhaustive dependency graph.
- Confirm arrows against source and runtime; generators can omit components.
- Do not merge audit/security branches until Preview and live behavior are verified.