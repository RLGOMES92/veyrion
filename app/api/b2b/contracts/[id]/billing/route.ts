import { NextRequest, NextResponse } from "next/server";
import { getServiceClient, jsonError, requireUser } from "@/lib/b2b-server";

export const dynamic = "force-dynamic";

const SANDBOX_URL = "https://api-sandbox.asaas.com/v3";
const BILLING_TYPES = new Set(["UNDEFINED", "BOLETO", "CREDIT_CARD", "PIX"]);

type AsaasSubscription = {
  id?: string;
  externalReference?: string;
  status?: string;
};

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function asaasHeaders(apiKey: string) {
  return {
    access_token: apiKey,
    accept: "application/json",
    "content-type": "application/json",
    "user-agent": "VEYRION-OS/0.2",
  };
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(request);
  if (!auth) return jsonError("Sessão inválida.", 401);

  // This route is intentionally sandbox-only while the product remains in Preview.
  if (process.env.VEYRION_INTEGRATION_MODE !== "preview") {
    return jsonError("Integração financeira bloqueada: habilite explicitamente o modo Preview.", 403);
  }
  const baseUrl = (process.env.ASAAS_API_URL || SANDBOX_URL).replace(/\/$/, "");
  if (baseUrl !== SANDBOX_URL) {
    return jsonError("O fluxo de cobrança do Preview aceita exclusivamente a API Sandbox do Asaas.", 403);
  }
  const apiKey = process.env.ASAAS_API_KEY;
  if (!apiKey) return jsonError("ASAAS_API_KEY não configurada no ambiente Preview.", 503);

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return jsonError("Payload inválido.");

  const action = body.action === "reconcile" ? "reconcile" : "create";
  const { data: contract, error: contractError } = await auth.client
    .from("b2b_contracts")
    .select("id,status,client_id,recurring_amount,start_date,billing_provider,billing_subscription_id,signature_document_id,signed_at")
    .eq("id", id)
    .maybeSingle();

  if (contractError || !contract) return jsonError("Contrato não encontrado ou sem acesso.", 404);
  if (contract.status !== "ACTIVE" || !contract.signature_document_id || !contract.signed_at) {
    return jsonError("A cobrança só pode ser criada depois da assinatura confirmada e da ativação do contrato.", 409);
  }

  const service = getServiceClient();
  const { data: notification, error: notificationError } = await service
    .from("b2b_notification_outbox")
    .select("id,status")
    .eq("contract_id", id)
    .eq("notification_type", "SUPPLIER_CONTRACT_ACTIVATED")
    .maybeSingle();

  if (notificationError) return jsonError("Não foi possível validar a notificação do fornecedor.", 500);
  if (notification?.status !== "SENT") {
    return jsonError("A cobrança está bloqueada até a notificação de ativação do fornecedor ser enviada.", 409);
  }

  const { data: client, error: clientError } = await service
    .from("b2b_clients")
    .select("asaas_customer_id")
    .eq("id", contract.client_id)
    .maybeSingle();
  if (clientError || !client?.asaas_customer_id) {
    return jsonError("Cadastre e vincule o cliente no Asaas antes de ativar a cobrança.", 422);
  }

  if (action === "reconcile") {
    if (contract.billing_provider !== "ASAAS_UNKNOWN" && contract.billing_provider !== "ASAAS_CREATING") {
      return NextResponse.json({
        ok: true,
        state: contract.billing_provider || "NOT_STARTED",
        subscription_id: contract.billing_subscription_id || null,
      });
    }
    const externalReference = `veyrion-contract:${id}`;
    const response = await fetch(`${SANDBOX_URL}/subscriptions?externalReference=${encodeURIComponent(externalReference)}`, {
      method: "GET",
      headers: asaasHeaders(apiKey),
      signal: AbortSignal.timeout(20000),
      cache: "no-store",
    }).catch(() => null);
    if (!response?.ok) return jsonError("Não foi possível consultar a assinatura no Sandbox. O estado permanece inconclusivo; não crie outra assinatura.", 502);
    const payload = await response.json().catch(() => ({}));
    const matches = Array.isArray(payload.data)
      ? payload.data.filter((item: AsaasSubscription) => item.externalReference === externalReference && item.id)
      : [];
    if (matches.length !== 1) {
      return NextResponse.json({
        ok: false,
        state: matches.length > 1 ? "DUPLICATE_REVIEW_REQUIRED" : "UNKNOWN",
        matches: matches.length,
        message: matches.length > 1
          ? "Mais de uma assinatura foi localizada. É necessária conciliação manual."
          : "Nenhuma assinatura foi localizada. Não será criada outra automaticamente.",
      }, { status: 409 });
    }
    const subscriptionId = String(matches[0].id);
    const { error: saveError } = await auth.client.from("b2b_contracts")
      .update({ billing_provider: "ASAAS", billing_subscription_id: subscriptionId })
      .eq("id", id)
      .eq("status", "ACTIVE")
      .in("billing_provider", ["ASAAS_UNKNOWN", "ASAAS_CREATING"]);
    if (saveError) return jsonError("Assinatura localizada, mas não foi possível salvar o vínculo. Faça nova conciliação.", 500);
    return NextResponse.json({ ok: true, state: "ASAAS", subscription_id: subscriptionId, reconciled: true });
  }

  if (contract.billing_subscription_id || contract.billing_provider === "ASAAS") {
    return NextResponse.json({
      ok: true,
      state: "ASAAS",
      subscription_id: contract.billing_subscription_id,
      message: "A assinatura recorrente já está vinculada ao contrato.",
    });
  }
  if (contract.billing_provider === "ASAAS_UNKNOWN" || contract.billing_provider === "ASAAS_CREATING") {
    return jsonError("Existe uma tentativa anterior sem resultado conclusivo. Execute a conciliação antes de qualquer novo envio.", 409);
  }

  const billingType = String(body.billing_type || "UNDEFINED");
  if (!BILLING_TYPES.has(billingType)) return jsonError("Forma de cobrança inválida.");
  if (!validDate(body.next_due_date)) return jsonError("Informe o primeiro vencimento no formato AAAA-MM-DD.");
  const due = new Date(`${body.next_due_date}T00:00:00.000Z`);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  if (due < today) return jsonError("O primeiro vencimento não pode estar no passado.");

  const amount = Number(contract.recurring_amount);
  if (!Number.isFinite(amount) || amount <= 0) return jsonError("O valor mensal do contrato precisa ser maior que zero.");

  // Atomic claim: only one request can start subscription creation for this contract.
  const { data: claimed, error: claimError } = await auth.client.from("b2b_contracts")
    .update({ billing_provider: "ASAAS_CREATING" })
    .eq("id", id)
    .eq("status", "ACTIVE")
    .is("billing_provider", null)
    .is("billing_subscription_id", null)
    .select("id")
    .maybeSingle();
  if (claimError) return jsonError("Não foi possível reservar a criação da assinatura.", 500);
  if (!claimed) return jsonError("A cobrança já foi iniciada ou exige conciliação. Atualize o contrato antes de continuar.", 409);

  const externalReference = `veyrion-contract:${id}`;
  let response: Response;
  try {
    response = await fetch(`${SANDBOX_URL}/subscriptions`, {
      method: "POST",
      headers: asaasHeaders(apiKey),
      body: JSON.stringify({
        customer: client.asaas_customer_id,
        billingType,
        value: amount,
        nextDueDate: body.next_due_date,
        cycle: "MONTHLY",
        description: `Locação de equipamentos VEYRION — contrato ${id}`.slice(0, 500),
        externalReference,
      }),
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    await auth.client.from("b2b_contracts")
      .update({ billing_provider: "ASAAS_UNKNOWN" })
      .eq("id", id)
      .eq("billing_provider", "ASAAS_CREATING");
    return jsonError("A resposta do Asaas foi inconclusiva. A assinatura não será reenviada automaticamente; execute a conciliação.", 502);
  }

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const isDefinitive = response.status >= 400 && response.status < 500;
    await auth.client.from("b2b_contracts")
      .update({ billing_provider: isDefinitive ? null : "ASAAS_UNKNOWN" })
      .eq("id", id)
      .eq("billing_provider", "ASAAS_CREATING");
    return NextResponse.json({
      error: isDefinitive ? "O Asaas rejeitou os dados da assinatura. Corrija a causa antes de tentar novamente." : "O Asaas retornou uma resposta inconclusiva. Faça a conciliação antes de repetir.",
      provider_status: response.status,
      provider_error: result,
    }, { status: isDefinitive ? 422 : 502 });
  }

  if (!result.id) {
    await auth.client.from("b2b_contracts")
      .update({ billing_provider: "ASAAS_UNKNOWN" })
      .eq("id", id)
      .eq("billing_provider", "ASAAS_CREATING");
    return jsonError("O Asaas respondeu sem ID de assinatura. Faça a conciliação antes de qualquer nova tentativa.", 502);
  }

  const { error: saveError } = await auth.client.from("b2b_contracts")
    .update({ billing_provider: "ASAAS", billing_subscription_id: String(result.id) })
    .eq("id", id)
    .eq("status", "ACTIVE")
    .eq("billing_provider", "ASAAS_CREATING");
  if (saveError) {
    await auth.client.from("b2b_contracts")
      .update({ billing_provider: "ASAAS_UNKNOWN" })
      .eq("id", id)
      .eq("billing_provider", "ASAAS_CREATING");
    return jsonError("A assinatura foi criada no Sandbox, mas o vínculo não foi salvo. Execute a conciliação; não crie outra.", 500);
  }

  return NextResponse.json({ ok: true, state: "ASAAS", subscription_id: String(result.id), next_due_date: body.next_due_date });
}
