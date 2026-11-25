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
- The repo's GitHub Actions validation workflow was removed on 2026-11-08, consistent with owner's request to avoid paid/locked Actions. No Actions-based CI will be assumed.
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
- The Vercel Preview for `fix/company-enrichment-auth` is READY and its build passed TypeScript, compilation and page generation. Live authenticated/unauthenticated endpoint behavior remains unverified; do not merge until that runtime test is done.

## Architecture visualization workflow

- Interactive GitDiagram: https://gitdiagram.com/RLGOMES92/veyrion
- Markdown diagram endpoint: https://gitdiagram.com/RLGOMES92/veyrion.md
- GitReverse generated prompt: https://gitreverse.com/RLGOMES92/veyrion
- Hand-authored map and reconstruction brief: `docs/architecture-map.md` on this audit branch.

GitDiagram provides an AI-generated overview, not a complete import graph. GitReverse generates a synthetic prompt based on repo metadata, shallow tree and README; it is not an original prompt or source-level reverse engineering. Because the repository is public, outputs may be cached or shared. The architecture map committed in this branch is a manual synthesis of inspected code and audit notes, not output copied from either service.


## Continuação da auditoria — 25/11/2026

### Captura pública de leads: Preview
- PR #7 (feat/veyrion-public-lead-capture) permanece aberto em Draft, sem merge.
- Commit atual: ee881902ed12c07afbe19c76a1c2400db974db49.
- Deployment Vercel Preview: READY, URL https://veyrion-bsutos6i1-rodrigos-projects-5f32f252.vercel.app/locacao.
- O build confirma compilação/deploy; não comprova teste ponta a ponta nem que uma submissão foi gravada. Teste manual controlado permanece pendente.
- A migration 006_public_lead_inquiries.sql e a rota app/api/public-leads/route.ts constam nos arquivos do PR. Revisar o estado real do banco, RLS e inserção antes de aprovar.

### GitDiagram / GitReverse
- Links para o repositório público foram mantidos em docs/architecture-map.md.
- Tentativa de abrir ambos os serviços a partir desta sessão não foi concluída (serviços inacessíveis pelo navegador de pesquisa); portanto, não afirmar que suas visualizações ou reconstruções foram geradas.
- O mapa arquitetural manual continua como referência, não como resultado validado desses serviços.

### Pendências prioritárias atualizadas
1. Testar formulário de locação no Preview com envio controlado e confirmar registro no banco; confirmar comportamento de erro e prevenção de spam/honeypot.
2. Expor uma inbox interna dos leads com leitura limitada a membros da organização e estado de acompanhamento.
3. Revisar e validar a integração Zoho em PR #3; não sincronizar sem teste com contato/empresa controlados.
4. Resolver aviso de parsing do package-lock.json e tornar build reprodutível; não habilitar GitHub Actions (restrição de billing permanece).
5. Testar runtime/auth/RLS e fluxos críticos em Preview antes de merge/publicação.
6. Revisar PRs #3, #4, #5, #6 e #7; todos devem permanecer isolados até validação específica e revisão do risco de conflitos/base desatualizada.

## Verificação do banco e política de leads — 25/11/2026
- Projeto Supabase `veyrion` (`cmoapcgnsnbmcsizqcom`) está ACTIVE_HEALTHY.
- A tabela `public.public_lead_inquiries` existe e está com RLS habilitado.
- Consulta somente leitura encontrou **0 registros** em `public_lead_inquiries`; portanto, ainda não há evidência de que o formulário recebeu uma solicitação real.
- A organização `rlgomes92` existe com o UUID esperado pela rota pública.
- A política atualmente instalada permite INSERT para `anon` apenas com organization_id fixo, source `site_locacao` e status `novo`.
- A política SELECT atualmente instalada exige organização corrente e membership explícito com papel owner, admin, manager ou sales. A migration do PR #7 consultada não contém essa verificação explícita de papel; há divergência entre o SQL versionado e a política efetiva. Alinhar migration e banco antes de qualquer alteração adicional.
- A rota pública usa a chave anon, valida campos e honeypot, mas não apresenta rate limit. A mitigação de abuso precisa ser avaliada antes de abrir tráfego amplo.
- PR #7 segue Draft/open e não deve ser mesclado até submissão controlada, confirmação de inserção e revisão de segurança.
- A inbox ainda não está implementada. O caminho correto é uma tela interna autenticada, usando a sessão Supabase do usuário e a política RLS existente; não expor leitura pública nem inserir leads diretamente em `workspace_records` sem revisão de esquema e autorização.
