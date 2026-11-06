import { NextRequest } from "next/server";
import { getServiceClient, jsonError, requireUser } from "@/lib/b2b-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Configuração ausente: ${name}`);
  return value.replace(/\/$/, "");
}

async function getZohoAccessToken() {
  const accountsUrl = requiredEnv("ZOHO_ACCOUNTS_URL");
  const body = new URLSearchParams({
    refresh_token: requiredEnv("ZOHO_REFRESH_TOKEN"),
    client_id: requiredEnv("ZOHO_CLIENT_ID"),
    client_secret: requiredEnv("ZOHO_CLIENT_SECRET"),
    grant_type: "refresh_token",
  });
  const response = await fetch(`${accountsUrl}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.access_token) {
    throw new Error("Não foi possível renovar a autorização do Zoho. Confira região e credenciais OAuth.");
  }
  return String(result.access_token);
}

function buildLead(payload: Record<string, unknown>) {
  const company = String(payload.name || "").trim();
  const email = String(payload.contact_email || "").trim().toLowerCase();
  const phone = String(payload.phone || "").trim();
  const contactPhone = String(payload.contact_phone || "").trim();
  const lastName = String(payload.contact_person || company).trim();
  const description = [
    "Lead originado no VEYRION OS.",
    payload.cnpj ? `CNPJ: ${String(payload.cnpj)}` : "",
    payload.sector ? `Setor: ${String(payload.sector)}` : "",
    payload.city ? `Localização: ${String(payload.city)}` : "",
    payload.notebook_demand ? `Demanda estimada: ${String(payload.notebook_demand)} notebooks` : "",
    payload.rental_interest ? `Interesse em locação: ${String(payload.rental_interest)}` : "",
    payload.source_detail ? `Origem: ${String(payload.source_detail)}` : "",
    payload.notes ? `Observações: ${String(payload.notes)}` : "",
  ].filter(Boolean).join("\n");
  const lead: Record<string, unknown> = {
    Company: company,
    Last_Name: lastName || company || "Lead VEYRION",
    Lead_Source: "VEYRION OS",
    Description: description,
  };
  if (email) lead.Email = email;
  if (contactPhone || phone) lead.Phone = contactPhone || phone;
  if (payload.website) lead.Website = String(payload.website);
  if (payload.sector) lead.Industry = String(payload.sector);
  if (payload.city) lead.City = String(payload.city);
  if (payload.employees && Number(payload.employees) > 0) lead.No_of_Employees = Number(payload.employees);
  return { lead, email };
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth) return jsonError("Sessão inválida ou expirada.", 401);
  const body = await request.json().catch(() => ({}));
  const recordId = String(body.recordId || "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(recordId)) return jsonError("Informe um ID válido de empresa.", 400);

  const { data: record, error: recordError } = await auth.client
    .from("workspace_records")
    .select("id,module,payload,organization_id")
    .eq("id", recordId)
    .eq("module", "companies")
    .maybeSingle();
  if (recordError || !record) return jsonError("Empresa não encontrada ou sem permissão de acesso.", 404);

  const payload = (record.payload || {}) as Record<string, unknown>;
  const { lead, email } = buildLead(payload);
  if (!String(lead.Company || "").trim()) return jsonError("Cadastre a razão social ou nome da empresa antes de sincronizar.", 422);
  if (!email) {
    const service = getServiceClient();
    await service.from("zoho_sync_jobs").upsert({
      organization_id: record.organization_id,
      workspace_record_id: record.id,
      module: "companies",
      status: "needs_data",
      idempotency_key: `veyrion:${record.organization_id}:${record.id}`,
      last_error: "Cadastre o e-mail do contato para permitir a busca de duplicidade no Zoho.",
      updated_at: new Date().toISOString(),
    }, { onConflict: "organization_id,workspace_record_id" });
    return Response.json({ status: "needs_data", message: "Cadastre o e-mail do contato para sincronizar com segurança e evitar duplicidades." }, { status: 200 });
  }

  const service = getServiceClient();
  const now = new Date().toISOString();
  const key = `veyrion:${record.organization_id}:${record.id}`;
  const { data: job, error: jobError } = await service.from("zoho_sync_jobs")
    .upsert({
      organization_id: record.organization_id,
      workspace_record_id: record.id,
      module: "companies",
      status: "pending",
      idempotency_key: key,
      updated_at: now,
    }, { onConflict: "organization_id,workspace_record_id" })
    .select("id,zoho_record_id,attempts")
    .single();
  if (jobError || !job) return jsonError("Não foi possível registrar a sincronização. Confira a migration 032.", 503);

  try {
    const apiDomain = requiredEnv("ZOHO_API_DOMAIN");
    const accessToken = await getZohoAccessToken();
    const headers = { Authorization: `Zoho-oauthtoken ${accessToken}`, "Content-Type": "application/json" };
    let zohoId = job.zoho_record_id ? String(job.zoho_record_id) : "";

    if (!zohoId) {
      const searchUrl = new URL(`${apiDomain}/crm/v8/Leads/search`);
      searchUrl.searchParams.set("email", email);
      const searchResponse = await fetch(searchUrl, { headers, cache: "no-store" });
      const searchBody = await searchResponse.json().catch(() => ({}));
      if (searchResponse.ok && Array.isArray(searchBody.data) && searchBody.data.length) {
        zohoId = String(searchBody.data[0].id || "");
      } else if (!searchResponse.ok && searchBody.code !== "NO_DATA") {
        throw new Error("Falha ao pesquisar duplicidade no Zoho CRM.");
      }
    }

    const endpoint = zohoId
      ? `${apiDomain}/crm/v8/Leads/${encodeURIComponent(zohoId)}`
      : `${apiDomain}/crm/v8/Leads`;
    const response = await fetch(endpoint, {
      method: zohoId ? "PUT" : "POST",
      headers,
      body: JSON.stringify({ data: [lead], ...(zohoId ? {} : { trigger: [] }) }),
      cache: "no-store",
    });
    const result = await response.json().catch(() => ({}));
    const action = result.data?.[0];
    if (!response.ok || !["SUCCESS", "success"].includes(String(action?.status || ""))) {
      const detail = String(action?.message || result.message || "O Zoho recusou a sincronização.");
      throw new Error(detail.slice(0, 500));
    }
    zohoId = String(action.details?.id || zohoId);
    if (!zohoId) throw new Error("Zoho não retornou o identificador do lead.");
    await service.from("zoho_sync_jobs").update({
      status: "synced",
      zoho_record_id: zohoId,
      attempts: Number(job.attempts || 0) + 1,
      last_error: null,
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", job.id);
    return Response.json({ status: "synced", zohoRecordId: zohoId, message: "Empresa sincronizada com o Zoho CRM." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha inesperada na integração Zoho.";
    await service.from("zoho_sync_jobs").update({
      status: "error",
      attempts: Number(job.attempts || 0) + 1,
      last_error: message.slice(0, 500),
      updated_at: new Date().toISOString(),
    }).eq("id", job.id);
    return jsonError(message, 502);
  }
}
