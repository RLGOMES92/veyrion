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
  const { data: organizationId, error: organizationError } = await auth.client.rpc("current_user_organization_id");
  if (organizationError || !organizationId) return jsonError("Não foi possível identificar a organização ativa.", 403);
  const { data: membership } = await auth.client.from("organization_members")
    .select("organization_id,role")
    .eq("user_id", auth.user.id)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!membership || !["owner", "admin", "finance"].includes(membership.role)) {
    return jsonError("Somente proprietário, administrador ou financeiro pode ativar cobrança.", 403);
  }

  const { data: contract, error: contractError } = await auth.client
    .from("b2b_contracts")
    .select("id,organization_id,proposal_id,supplier_id,status,client_id,recurring_amount,partner_amount,start_date,billing_provider,billing_subscription_id,signature_document_id,signed_at")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (contractError || !contract) return jsonError("Contrato não encontrado ou sem acesso.", 404);
  if (contract.status !== "ACTIVE" || !contract.signature_document_id || !contract.signed_at) {
    return jsonError("A cobrança só pode ser criada depois da assinatura confirmada e da ativação do contrato.", 409);
  }

  let service;\n  try { service = getServiceClient(); } catch { return jsonError("Configure SUPABASE_SERVICE_ROLE_KEY no ambiente Preview.", 503); }
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

  const [{ data: client, error: clientError }, { data: supplier, error: supplierError }, { data: proposal }] = await Promise.all([
    service.from("b2b_clients").select("id,asaas_customer_id,legal_name,cnpj,contact_email,contact_phone").eq("id", contract.client_id).maybeSingle(),
    service.from("b2b_suppliers").select("asaas_wallet_id").eq("id", contract.supplier_id).maybeSingle(),
    service.from("b2b_proposals").select("term_months").eq("id", contract.proposal_id).maybeSingle(),
  ]);
  if (clientError || !client) return jsonError("Cliente não encontrado para cobrança.", 422);
  if (supplierError || !supplier?.asaas_wallet_id) return jsonError("Fornecedor sem walletId Asaas; o split não pode ser ativado.", 422);

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
      .eq("organization_id", organizationId)
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

  const { data: claimed, error: claimError } = await auth.client.from("b2b_contracts")
    .update({ billing_provider: "ASAAS_CREATING" })
    .eq("id", id)
    .eq("organization_id", organizationId)
    .eq("status", "ACTIVE")
    .is("billing_provider", null)
    .is("billing_subscription_id", null)
    .select("id")
    .maybeSingle();
  if (claimError) return jsonError("Não foi possível reservar a criação da assinatura.", 500);
  if (!claimed) return jsonError("A cobrança já foi iniciada ou exige conciliação. Atualize o contrato antes de continuar.", 409);

  // Resolve or create the payer using a stable externalReference. An inconclusive
  // customer creation is reconciled before any later attempt to avoid duplicates.
  const customerReference = `veyrion-client:${client.id}`;
  const listCustomers = async () => {
    const response = await fetch(`${SANDBOX_URL}/customers?externalReference=${encodeURIComponent(customerReference)}`, {
      method: "GET", headers: asaasHeaders(apiKey), signal: AbortSignal.timeout(20000), cache: "no-store",
    });
    if (!response.ok) throw new Error("Falha ao consultar clientes no Asaas Sandbox.");
    const payload = await response.json().catch(() => ({}));
    return Array.isArray(payload.data) ? payload.data.filter((item: { id?: string; externalReference?: string }) => item.externalReference === customerReference && item.id) : [];
  };
  let customerId = client.asaas_customer_id && !String(client.asaas_customer_id).startsWith("UNKNOWN:")
    ? String(client.asaas_customer_id) : "";
  if (!customerId) {
    try {
      const matches = await listCustomers();
      if (matches.length > 1) throw new Error("Mais de um cliente Asaas corresponde a esta empresa; conciliação manual necessária.");
      if (matches.length === 1) customerId = String(matches[0].id);
      else if (String(client.asaas_customer_id || "").startsWith("UNKNOWN:")) {
        throw new Error("Cadastro de cliente com resultado inconclusivo. Nenhum novo cadastro será criado; verifique o Asaas e tente novamente.");
      } else {
        let customerResponse: Response | null = null;
        try {
          customerResponse = await fetch(`${SANDBOX_URL}/customers`, {
            method: "POST",
            headers: asaasHeaders(apiKey),
            body: JSON.stringify({
              name: client.legal_name,
              cpfCnpj: String(client.cnpj || "").replace(/\\D/g, ""),
              email: client.contact_email || undefined,
              mobilePhone: client.contact_phone ? String(client.contact_phone).replace(/\\D/g, "") : undefined,
              externalReference: customerReference,
            }),
            signal: AbortSignal.timeout(30000),
          });
        } catch {
          await service.from("b2b_clients").update({ asaas_customer_id: `UNKNOWN:${customerReference}` }).eq("id", client.id);
          const recovered = await listCustomers().catch(() => []);
          if (recovered.length === 1) customerId = String(recovered[0].id);
          else throw new Error("Resultado do cadastro do cliente inconclusivo. O sistema bloqueou nova criação para evitar duplicidade.");
        }
        if (!customerId && customerResponse) {
          const customerPayload = await customerResponse.json().catch(() => ({}));
          if (customerResponse.ok && customerPayload.id) customerId = String(customerPayload.id);
          else if (customerResponse.status >= 400 && customerResponse.status < 500) {
            throw new Error("O Asaas rejeitou o cadastro do cliente: " + JSON.stringify(customerPayload).slice(0, 500));
          } else {
            await service.from("b2b_clients").update({ asaas_customer_id: `UNKNOWN:${customerReference}` }).eq("id", client.id);
            const recovered = await listCustomers().catch(() => []);
            if (recovered.length === 1) customerId = String(recovered[0].id);
            else throw new Error("O cadastro do cliente teve resultado inconclusivo. Faça a conciliação antes de repetir.");
          }
        }
      }
      if (customerId) {
        const { error: customerSaveError } = await service.from("b2b_clients")
          .update({ asaas_customer_id: customerId }).eq("id", client.id);
        if (customerSaveError) throw new Error("Cliente localizado no Asaas, mas o vínculo não foi salvo: " + customerSaveError.message);
      }
    } catch (error) {
      await auth.client.from("b2b_contracts").update({ billing_provider: null }).eq("id", id).eq("billing_provider", "ASAAS_CREATING");
      return jsonError(error instanceof Error ? error.message : "Falha ao resolver cliente Asaas.", 409);
    }
  }

  const externalReference = `veyrion-contract:${id}`;
  let response: Response;
  try {
    response = await fetch(`${SANDBOX_URL}/subscriptions`, {
      method: "POST",
      headers: asaasHeaders(apiKey),
      body: JSON.stringify({
        customer: customerId,
        billingType,
        value: amount,
        nextDueDate: body.next_due_date,
        cycle: "MONTHLY",
        description: `Locação de equipamentos VEYRION — contrato ${id}`.slice(0, 500),
        externalReference,
        maxPayments: Number(proposal?.term_months || 36),
        split: [{ walletId: supplier.asaas_wallet_id, fixedValue: Number(contract.partner_amount), description: "Repasse parceiro técnico" }],
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
    .eq("organization_id", organizationId)
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
