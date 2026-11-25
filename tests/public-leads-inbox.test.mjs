import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const api = readFileSync(new URL("../app/api/public-leads/route.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/leads/page.tsx", import.meta.url), "utf8");
const form = readFileSync(new URL("../app/locacao/lead-form.tsx", import.meta.url), "utf8");

test("lead inbox API requires a verified user session", () => {
  assert.match(api, /export async function GET\(request: NextRequest\)/);
  assert.match(api, /requireUser\(request\)/);
  assert.match(api, /Sessão inválida ou expirada/);
});

test("lead inbox API limits access to VEYRION sales roles and organization", () => {
  assert.match(api, /current_user_organization_id/);
  assert.match(api, /currentOrganization !== organizationId/);
  assert.match(api, /\["owner", "admin", "manager", "sales"\]/);
  assert.match(api, /\.eq\("organization_id", organizationId\)/);
  assert.match(api, /\.limit\(100\)/);
});

test("lead inbox fetch uses bearer session and does not cache", () => {
  assert.ok(page.includes("Authorization: `Bearer ${token}`"));
  assert.match(page, /cache: "no-store"/);
});

test("public form includes bot honeypot and server submission", () => {
  assert.match(form, /name="website"/);
  assert.match(form, /fetch\("\/api\/public-leads"/);
  assert.match(form, /setSending\(true\)/);
});

test("public lead endpoint rejects non-JSON and oversized requests before parsing", () => {
  assert.match(api, /content-type/);
  assert.match(api, /status: 415/);
  assert.match(api, /MAX_REQUEST_BYTES = 8 \* 1024/);
  assert.match(api, /status: 413/);
  assert.ok(api.indexOf("request.text()") < api.indexOf("JSON.parse(rawBody)"));
});

test("public lead endpoint rejects non-object payloads and keeps bounded fields", () => {
  assert.ok(api.includes('typeof body !== "object"'));
  assert.ok(api.includes("clean(payload.name, 120)"));
  assert.ok(api.includes("clean(payload.email, 254)"));
  assert.ok(api.includes('name="website"'));
);

test("company enrichment API requires session and caps search input", () => {
  const enrichment = readFileSync(new URL("../app/api/company-enrichment/route.ts", import.meta.url), "utf8");
  const crm = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(enrichment, /requireUser\(request\)/);
  assert.match(enrichment, /q\.length > 120/);
  assert.match(enrichment, /\["owner", "admin", "manager", "sales"\]/);
  assert.match(crm, /Authorization:"Bearer "\+session\.access_token/);
});

test("lead PII read policy is role-restricted and grants are minimized", () => {
  const migration = readFileSync(new URL("../supabase/migrations/034_public_lead_inquiries_role_restriction.sql", import.meta.url), "utf8");
  assert.match(migration, /member\.role in \('owner', 'admin', 'manager', 'sales'\)/);
  assert.match(migration, /revoke select, update, delete/i);
  assert.match(migration, /grant select .* authenticated/i);
  assert.match(migration, /grant insert .* anon/i);
});

test("lead table privileges are reduced to anonymous INSERT and authenticated SELECT", () => {
  const migration = readFileSync(new URL("../supabase/migrations/035_public_lead_inquiries_minimal_grants.sql", import.meta.url), "utf8");
  assert.match(migration, /revoke all privileges/i);
  assert.match(migration, /grant insert .* anon/i);
  assert.match(migration, /grant select .* authenticated/i);
  assert.doesNotMatch(migration, /grant update|grant delete|grant truncate/i);
});

test("VEYRION login uses password and invitation-gated first access", () => {
  const crm = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  const inviteMigration = readFileSync(new URL("../supabase/migrations/20261108153806_restrict_veyrion_signups_to_invites.sql", import.meta.url), "utf8");
  assert.match(crm, /signInWithPassword/);
  assert.match(crm, /firstAccess/);
  assert.match(crm, /password\.length<8/);
  assert.match(inviteMigration, /organization_invitations/);
  assert.match(inviteMigration, /raise exception/);
});

test("Zoho integration requires authenticated requests and server-only credentials", () => {
  const sync = readFileSync(new URL("../app/api/integrations/zoho/sync-company/route.ts", import.meta.url), "utf8");
  const create = readFileSync(new URL("../app/api/integrations/zoho/create-lead/route.ts", import.meta.url), "utf8");
  const zoho = readFileSync(new URL("../lib/zoho.ts", import.meta.url), "utf8");
  assert.match(sync, /requireUser\(request\)/);
  assert.match(create, /requireUser\(request\)/);
  assert.match(zoho, /ZOHO_CLIENT_SECRET/);
  assert.match(zoho, /ZOHO_REFRESH_TOKEN/);
  assert.doesNotMatch(zoho, /NEXT_PUBLIC_ZOHO/);
});

test("Zoho company sync requires commercial role", () => {
  const sync = readFileSync(new URL("../app/api/integrations/zoho/sync-company/route.ts", import.meta.url), "utf8");
  assert.match(sync, /organization_members/);
  assert.match(sync, /\["owner", "admin", "manager", "sales"\]/);
});
