import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = (path) => readFileSync(resolve(root, path), "utf8");

test("billing endpoint is restricted to authenticated finance roles and Preview Sandbox", () => {
  const code = source("app/api/b2b/contracts/[id]/billing/route.ts");
  assert.match(code, /requireUser\(request\)/);
  assert.match(code, /\["owner",\s*"admin",\s*"finance"\]/);
  assert.match(code, /VEYRION_INTEGRATION_MODE\s*!==\s*"preview"/);
  assert.match(code, /https:\/\/api-sandbox\.asaas\.com\/v3/);
  assert.match(code, /ASAAS_UNKNOWN/);
});

test("recurring billing requires signed active contract and supplier notification", () => {
  const code = source("app/api/b2b/contracts/[id]/billing/route.ts");
  assert.match(code, /contract\.status\s*!==\s*"ACTIVE"/);
  assert.match(code, /signature_document_id/);
  assert.match(code, /notification\?\.status\s*!==\s*"SENT"/);
  assert.match(code, /walletId:\s*supplier\.asaas_wallet_id/);
  assert.match(code, /externalReference/);
});

test("signature reconciliation is restricted to finance roles and never resends a document", () => {
  const code = source("app/api/b2b/contracts/[id]/reconcile/route.ts");
  assert.match(code, /current_user_organization_id/);
  assert.match(code, /\["owner",\s*"admin",\s*"finance"\]/);
  assert.match(code, /signature_dispatch_status",\s*"UNKNOWN"/);
  assert.match(code, /Nenhuma nova solicitação foi enviada/);
});

test("ZapSign webhook uses a secret, idempotent event claim and conditional activation", () => {
  const code = source("app/api/webhooks/zapsign/route.ts");
  assert.match(code, /ZAPSIGN_WEBHOOK_SECRET/);
  assert.match(code, /b2b_integration_events/);
  assert.match(code, /processed_at/);
  assert.match(code, /eq\("status",\s*"PENDING_SIGNATURE"\)/);
  assert.match(code, /b2b_notification_outbox/);
});

test("payment endpoints are explicitly disabled because payments happen externally", () => {
  const webhook = source("app/api/webhooks/asaas/route.ts");
  const billing = source("app/api/b2b/contracts/[id]/billing/route.ts");
  assert.match(webhook, /EXTERNAL_PAYMENT_ONLY/);
  assert.match(billing, /EXTERNAL_PAYMENT_ONLY/);
  assert.match(webhook, /status:\\s*410/);
  assert.match(billing, /status:\\s*410/);
});

test("brokerage workspace focuses on company, proposal and contract lifecycle only", () => {
  const code = source("app/brokerage/page.tsx");
  assert.doesNotMatch(code, /tab===\\"billing\\"/);
  assert.doesNotMatch(code, /b2b_charges|Asaas|asaas_wallet_id|split/i);
  assert.match(code, /Contratos e assinatura/);
  assert.match(code, /pagamentos e repasses são combinados e realizados fora da plataforma/i);
});

test("Preview notification worker cannot send to the real supplier address", () => {
  const code = source("app/api/cron/notifications/route.ts");
  assert.match(code, /CRON_SECRET/);
  assert.match(code, /RESEND_TEST_MODE/);
  assert.match(code, /RESEND_TEST_RECIPIENT/);
  assert.match(code, /to:\s*\[testRecipient\]/);
  assert.match(code, /VEYRION_INTEGRATION_MODE\s*!==\s*"preview"/);
});
