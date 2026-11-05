import { NextRequest, NextResponse } from "next/server";
import { requireUser, jsonError } from "@/lib/b2b-server";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  const auth = await requireUser(request);
  if (!auth) return jsonError("Sessão inválida.", 401);

  const { id } = await context.params;
  if (!id) return jsonError("Contrato inválido.");

  const body = await request.json().catch(() => null);
  const documentId = String(body?.signature_document_id || "").trim();
  const signatureUrl = String(body?.signature_url || "").trim();

  if (body?.document_confirmed !== true) {
    return jsonError("Confirme que o documento foi localizado na ZapSign antes de reconciliar.");
  }
  if (!documentId || documentId.length > 255) {
    return jsonError("Informe o identificador do documento localizado na ZapSign.");
  }
  if (signatureUrl) {
    try {
      const parsed = new URL(signatureUrl);
      if (parsed.protocol !== "https:" || !/(^|\.)zapsign\.com\.br$/i.test(parsed.hostname)) {
        return jsonError("O link deve ser HTTPS e pertencer ao domínio oficial da ZapSign.");
      }
    } catch {
      return jsonError("Link de assinatura inválido.");
    }
  }

  // RLS scopes this read to the authenticated user's organization.
  const { data: contract, error: readError } = await auth.client
    .from("b2b_contracts")
    .select("id,status,signature_dispatch_status,signature_document_id")
    .eq("id", id)
    .maybeSingle();

  if (readError) return jsonError("Não foi possível consultar o contrato.", 400);
  if (!contract) return jsonError("Contrato não encontrado nesta organização.", 404);
  if (contract.signature_dispatch_status !== "UNKNOWN") {
    return NextResponse.json({
      error: "Somente contratos com envio UNKNOWN podem ser reconciliados por este fluxo.",
      current_status: contract.signature_dispatch_status || "MIGRATION_REQUIRED"
    }, { status: 409 });
  }
  if (contract.signature_document_id && contract.signature_document_id !== documentId) {
    return jsonError("O contrato já possui outro identificador de documento. Exige análise manual.", 409);
  }

  // Conditional update prevents two operators from reconciling different documents concurrently.
  const { data: updated, error: updateError } = await auth.client
    .from("b2b_contracts")
    .update({
      signature_document_id: documentId,
      signature_url: signatureUrl || null,
      signature_provider: "ZAPSIGN",
      signature_dispatch_status: "SENT",
      signature_dispatch_error: null,
      status: "PENDING_SIGNATURE"
    })
    .eq("id", id)
    .eq("signature_dispatch_status", "UNKNOWN")
    .select("id,status,signature_document_id,signature_url,signature_dispatch_status")
    .maybeSingle();

  if (updateError) return jsonError("Falha ao persistir a reconciliação: " + updateError.message, 500);
  if (!updated) return NextResponse.json({ error: "O estado do contrato mudou durante a operação. Atualize a tela e confira novamente." }, { status: 409 });

  return NextResponse.json({
    contract: updated,
    message: "Documento vinculado manualmente. Nenhuma nova solicitação foi enviada à ZapSign."
  });
}
