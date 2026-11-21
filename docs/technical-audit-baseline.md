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
