import { NextRequest } from "next/server";
import { jsonError, requireUser } from "@/lib/b2b-server";
import { getZohoAccessToken, zohoV2Request } from "@/lib/zoho";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth) return jsonError("Sessão inválida ou expirada.", 401);
  const { data: organizationId, error: organizationError } = await auth.client.rpc("current_user_organization_id");
  if (organizationError || !organizationId) return jsonError("Organização não autorizada.", 403);
  const { data: membership, error: membershipError } = await auth.client
    .from("organization_members").select("role")
    .eq("organization_id", organizationId).eq("user_id", auth.user.id).maybeSingle();
  if (membershipError || !membership || !["owner", "admin", "manager", "sales"].includes(membership.role)) {
    return jsonError("Seu perfil não possui permissão para criar Leads no Zoho CRM.", 403);
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("Envie os dados do formulário em JSON.", 400);
  }

  const firstName = text(body.firstName);
  const lastName = text(body.lastName);
  const email = text(body.email).toLowerCase();
  const phone = text(body.phone);
  const company = text(body.company);

  if (!lastName || !company) {
    return jsonError("Sobrenome e empresa são obrigatórios para criar um Lead.", 400);
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonError("Informe um e-mail válido.", 400);
  }

  try {
    const accessToken = await getZohoAccessToken();
    const lead: Record<string, string> = {
      Last_Name: lastName,
      Company: company,
    };
    if (firstName) lead.First_Name = firstName;
    if (email) lead.Email = email;
    if (phone) lead.Phone = phone;

    // Prevent duplicates: update only when both email and company match.
    if (email) {
      const search = await zohoV2Request(
        `Leads/search?email=${encodeURIComponent(email)}`,
        accessToken,
      );
      const matches = search.result?.data;
      if (search.response.ok && Array.isArray(matches) && matches.length > 0) {
        const normalizedCompany = company.toLocaleLowerCase("pt-BR");
        const sameCompany = matches.find((item: Record<string, unknown>) =>
          text(item.Company).toLocaleLowerCase("pt-BR") === normalizedCompany
        );
        if (!sameCompany) {
          return Response.json(
            {
              success: false,
              code: "POSSIBLE_DUPLICATE",
              message: "Já existe um Lead com este e-mail em outra empresa. Revise o cadastro no Zoho antes de continuar.",
            },
            { status: 409 },
          );
        }

        const update = await zohoV2Request(
          `Leads/${encodeURIComponent(String(sameCompany.id))}`,
          accessToken,
          { method: "PUT", body: JSON.stringify({ data: [lead] }) },
        );
        const item = update.result?.data?.[0];
        if (!update.response.ok || String(item?.status).toUpperCase() !== "SUCCESS") {
          return jsonError(
            String(item?.message || update.result?.message || "O Zoho não conseguiu atualizar o Lead."),
            502,
          );
        }
        return Response.json({
          success: true,
          action: "updated",
          zohoLeadId: item?.details?.id || sameCompany.id,
          message: "Lead existente atualizado no Zoho CRM.",
        });
      }

      if (!search.response.ok && search.result?.code !== "NO_DATA") {
        return jsonError("Não foi possível verificar se o Lead já existe no Zoho.", 502);
      }
    }

    const created = await zohoV2Request(
      "Leads",
      accessToken,
      {
        method: "POST",
        body: JSON.stringify({ data: [lead], trigger: [] }),
      },
    );
    const item = created.result?.data?.[0];
    if (!created.response.ok || String(item?.status).toUpperCase() !== "SUCCESS") {
      return jsonError(
        String(item?.message || created.result?.message || "O Zoho não conseguiu criar o Lead."),
        502,
      );
    }

    return Response.json(
      {
        success: true,
        action: "created",
        zohoLeadId: item?.details?.id || null,
        message: "Lead criado com sucesso no Zoho CRM.",
      },
      { status: 201 },
    );
  } catch (error) {
    // Never log OAuth credentials or access tokens.
    console.error(
      "Zoho lead creation failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return jsonError("Falha na integração com o Zoho CRM. Confira a configuração do servidor.", 502);
  }
}
