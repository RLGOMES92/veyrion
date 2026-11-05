import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/b2b-server";

export const dynamic = "force-dynamic";
const MAX_ATTEMPTS = 8;

async function processQueue(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || request.headers.get("x-cron-secret");
  if (!secret || supplied !== secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (process.env.VEYRION_INTEGRATION_MODE !== "preview") {
    return NextResponse.json({ error: "O worker de notificações está bloqueado fora do modo Preview nesta etapa." }, { status: 403 });
  }
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const testMode = process.env.RESEND_TEST_MODE === "true";
  const testRecipient = process.env.RESEND_TEST_RECIPIENT;
  if (!apiKey || !from || !testMode || !testRecipient) {
    return NextResponse.json({ error: "Preview exige RESEND_API_KEY, RESEND_FROM_EMAIL, RESEND_TEST_MODE=true e RESEND_TEST_RECIPIENT." }, { status: 503 });
  }

  const db = getServiceClient();
  // Automatically release notifications that were blocked only because the supplier
  // had no email address when the contract was activated.
  const { data: blockedJobs } = await db.from("b2b_notification_outbox")
    .select("id,supplier_id").eq("status", "BLOCKED").not("supplier_id", "is", null).limit(50);
  let unblocked = 0;
  for (const blocked of blockedJobs || []) {
    const { data: supplier } = await db.from("b2b_suppliers").select("contact_email").eq("id", blocked.supplier_id).maybeSingle();
    if (!supplier?.contact_email) continue;
    const { error } = await db.from("b2b_notification_outbox").update({
      recipient_email: supplier.contact_email,
      status: "PENDING",
      last_error: null,
      next_attempt_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", blocked.id).eq("status", "BLOCKED");
    if (!error) unblocked += 1;
  }

  const { data: jobs, error: claimError } = await db.rpc("claim_b2b_notification_outbox", { p_limit: 20 });
  if (claimError) return NextResponse.json({ error: "Could not claim notification jobs.", details: claimError.message }, { status: 500 });

  const results: Array<{ id: string; status: string; detail?: string }> = [];
  for (const job of jobs || []) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": job.idempotency_key,
        },
        body: JSON.stringify({
          from,
          to: [testRecipient],
          subject: job.subject,
          html: job.html_body,
        }),
        signal: AbortSignal.timeout(20000),
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload.id) {
        const { error: saveError } = await db.from("b2b_notification_outbox").update({
          status: "SENT",
          sent_at: new Date().toISOString(),
          provider_message_id: payload.id,
          last_error: null,
          locked_at: null,
          updated_at: new Date().toISOString(),
        }).eq("id", job.id).eq("status", "PROCESSING");
        if (saveError) results.push({ id: job.id, status: "PERSISTENCE_ERROR", detail: saveError.message });
        else results.push({ id: job.id, status: "SENT" });
        continue;
      }

      const detail = `Resend HTTP ${response.status}: ${JSON.stringify(payload).slice(0, 1200)}`;
      const permanent = [400, 401, 403, 422].includes(response.status) || (response.status === 409 && (payload.name === "invalid_idempotent_request" || payload.error === "invalid_idempotent_request"));
      const failed = permanent || job.attempt_count >= MAX_ATTEMPTS;
      const delayMinutes = Math.min(360, 2 ** Math.max(0, job.attempt_count - 1) * 5);
      const { error: saveError } = await db.from("b2b_notification_outbox").update({
        status: failed ? "FAILED" : "RETRY",
        next_attempt_at: new Date(Date.now() + delayMinutes * 60_000).toISOString(),
        last_error: detail,
        locked_at: null,
        updated_at: new Date().toISOString(),
      }).eq("id", job.id).eq("status", "PROCESSING");
      results.push({ id: job.id, status: saveError ? "PERSISTENCE_ERROR" : failed ? "FAILED" : "RETRY", detail: saveError?.message || detail });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown delivery error";
      const failed = job.attempt_count >= MAX_ATTEMPTS;
      const delayMinutes = Math.min(360, 2 ** Math.max(0, job.attempt_count - 1) * 5);
      const { error: saveError } = await db.from("b2b_notification_outbox").update({
        status: failed ? "FAILED" : "RETRY",
        next_attempt_at: new Date(Date.now() + delayMinutes * 60_000).toISOString(),
        last_error: detail.slice(0, 1500),
        locked_at: null,
        updated_at: new Date().toISOString(),
      }).eq("id", job.id).eq("status", "PROCESSING");
      results.push({ id: job.id, status: saveError ? "PERSISTENCE_ERROR" : failed ? "FAILED" : "RETRY", detail: saveError?.message || detail });
    }
  }

  return NextResponse.json({ ok: true, unblocked, claimed: jobs?.length || 0, results });
}

export async function POST(request: NextRequest) { return processQueue(request); }
export async function GET(request: NextRequest) { return processQueue(request); }
