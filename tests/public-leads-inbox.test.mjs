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
