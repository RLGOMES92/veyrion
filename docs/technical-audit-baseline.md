# VEYRION OS — Baseline technical audit
Date: 2026-11-21
Branch: `audit/veyrion-baseline`
Base: `main` at `2c3278c07097c91069fe1e822591ec9193121bd9`

## Verified facts
- Repository: `RLGOMES92/veyrion`, Next.js 15 / React 19 / TypeScript, Supabase JS v2.
- The main UI is currently concentrated in `app/page.tsx` (large single client component; approximately 419 KB in the fetched file). This creates maintenance, regression, and review risk.
- Authentication in the current main branch is Supabase email OTP/magic-link (`signInWithOtp`); there is no `signInWithPassword` call in the fetched main page. README describes the same magic-link flow.
- The app reads/writes workspace records directly through the Supabase client. Correct isolation therefore depends on RLS policies and the organization/membership functions/migrations being applied and correct.
- `package.json` scripts: `build = tsc --noEmit && next build`, `test = node --experimental-strip-types --test tests/*.test.mjs`. The test suite's file inventory and actual execution have not yet been verified.
- `next.config.ts` sets security headers (DENY frame, nosniff, Referrer Policy, Permissions Policy, HSTS, etc.).
- The repo's GitHub Actions validation workflow was removed on 2026-11-08 (commit above), consistent with owner's request to avoid paid/locked Actions. No Actions-based CI will be assumed.
- Current Vercel project `veyrion-os` exists and its production domain `veyrion-os.vercel.app` is verified. The latest deployment records available include READY previews on `hardening/contract-idempotency`; the deployment list did not clearly identify a Production target, so production commit/state remains unverified.
- Supabase schema/migrations include initial workspace records, organizations/roles (002), duplicate monthly charge prevention (003), workspace audit (004), sales goals (005), invitations (006), team audit (007). Actual database migration state is not confirmed.

## Priority risks / questions to verify
1. **Auth UX & configuration:** current magic-link login conflicts with the previously discussed preference for email/password. Confirm whether to migrate; do not change auth without checking existing user access and Supabase settings.
2. **Tenant isolation:** audit every table, policy, RPC, trigger and elevated function for organization scoping, role checks, and safe `search_path`; verify migration application order and actual live schema.
3. **Large monolithic UI:** split into manageable modules/components only with characterization tests and staged changes; avoid a risky wholesale rewrite.
4. **Runtime validation:** inspect production and preview deployment logs, browser console, critical workflows, and Supabase configuration. READY build status is not proof of end-to-end correctness.
5. **Tests:** confirm the test files exist and run the available checks without GitHub Actions. Prefer Vercel previews and local/prebuild validation.
6. **External integrations:** confirm Zoho and ZapSign implementation, secret handling, webhook verification, idempotency and retry behavior; do not expose tokens or secret values.
7. **Business scope:** payments and payout processing remain outside VEYRION; financial module is management/recording only, unless owner changes scope.

## Audit process
- Preserve `main`; perform changes in isolated branches.
- Make focused fixes, review diffs, validate, and deploy preview before production.
- No secrets in commits or reports.
- Do not claim a fix is complete until the deployed behavior is verified.

## Additional findings from policy review

- The role matrix in migration 002 is restrictive by design, but several modules are not explicitly granted to non-admin roles: `maintenance`, `procurement`, and `campaigns` (as well as module-specific `audit`/team UI handled outside `workspace_records`). Confirm whether this is intended; operations currently gets explicit access to `assets` and `contracts`, not `maintenance`/procurement. This can look like broken screens for those roles even if RLS is functioning correctly.
- `current_user_organization_id()` selects one membership (owner first, then admin, then other roles). The app has no visible organization selector in the reviewed code. Multi-organization users may silently act in the selected/first organization; verify and consider an explicit org picker or reject multi-org accounts until supported.
- The insert/update RLS checks organization against that helper; update also checks module permission. Deletes are restricted to owner/admin. This is a positive security control, but should be tested with each role and organization, not inferred from the UI.

## Next checks (not yet performed)
- Full migration policy review and Supabase live migration-state verification.
- Inventory and run the repository's actual test files; then run TypeScript/build without Actions.
- Inspect API routes for auth/session checks, rate limits, secret exposure, and webhook signature/idempotency.
- Check Vercel production deployment target and live critical flows. Preview READY status alone is insufficient.
- UI/browser review on mobile and desktop; check responsive navigation and dashboard density.

## Runtime and endpoint findings

- Vercel confirms the Production deployment on `main` is READY and points to commit `2c3278c`. Build logs show a package-lock parsing error warning, but the build continued to install dependencies and completed successfully. This means production is deployed, while lockfile reproducibility still needs cleanup.
- `app/api/company-enrichment/route.ts` exposes a GET that calls third-party company/CNPJ data providers. Before this audit, it did not authenticate callers; it also has no explicit request-rate limit. This can be abused to consume provider quota. A focused fix is underway in branch `fix/company-enrichment-auth`: require a valid Supabase session and cap the query length; the UI now sends the bearer token.
- `app/api/assistant/analyze/route.ts` already authenticates with `requireUser`, caps input records, uses a server-side OpenAI key, has a per-user quota RPC, and falls back to deterministic rules. This is a stronger pattern to follow for other routes.
- The Vercel Preview for `fix/company-enrichment-auth` is currently QUEUED (not yet built). Do not merge or publish this change until the preview build completes and behavior is checked.
