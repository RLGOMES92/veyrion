import { NextRequest,NextResponse } from "next/server";
import { requireUser,jsonError } from "@/lib/b2b-server";

const managementRoles=["owner","admin","manager","finance"];

export async function PATCH(request:NextRequest,{params}:{params:Promise<{id:string}>}) {
 const auth=await requireUser(request);
 if(!auth)return jsonError("Sessão inválida.",401);

 const {id}=await params;
 const body=await request.json().catch(()=>({}));
 const status=String(body.status||"");
 const allowed=["CREDIT_REVIEW","SENT","NEGOTIATION","SIGNING","LOST","CANCELLED"];
 if(!allowed.includes(status))return jsonError("Transição de status inválida.");

 const {data:proposal,error:proposalError}=await auth.client
  .from("b2b_proposals")
  .select("id,status,organization_id,monthly_revenue,monthly_supplier_cost,client:b2b_clients(credit_decision,registration_status)")
  .eq("id",id)
  .single();
 if(proposalError||!proposal)return jsonError("Proposta não encontrada.",404);

 const client:any=Array.isArray(proposal.client)?proposal.client[0]:proposal.client;
 if(!client)return jsonError("Cliente da proposta não encontrado.",409);
 if(client.registration_status!=="ATIVA")return jsonError("CNPJ não ativo. A proposta não pode avançar.",409);

 const current=String(proposal.status||"");
 const transitions:Record<string,string[]> = {
  DRAFT:["CREDIT_REVIEW","LOST","CANCELLED"],
  CREDIT_REVIEW:["SENT","LOST","CANCELLED"],
  SENT:["NEGOTIATION","SIGNING","LOST","CANCELLED"],
  NEGOTIATION:["SENT","SIGNING","LOST","CANCELLED"],
  SIGNING:["LOST","CANCELLED"],
 };
 if(!transitions[current]?.includes(status))return jsonError("Transição não permitida: "+current+" → "+status,409);

 const update:any={status};
 if(status==="SENT"&&Number(proposal.monthly_revenue)<=Number(proposal.monthly_supplier_cost))return jsonError("A proposta precisa ter margem positiva antes do envio.",409);\n if(status==="SENT"&&client.credit_decision!=="APPROVED") {
  const reason=String(body.manual_override_reason||"").trim();
  if(reason.length<10)return jsonError("A proposta exige aprovação cadastral ou justificativa formal de exceção de crédito.",409);
  const {data:membership}=await auth.client.from("organization_members")
   .select("organization_id,role")
   .eq("user_id",auth.user.id)
   .eq("organization_id",proposal.organization_id)
   .maybeSingle();
  if(!membership||!managementRoles.includes(membership.role))return jsonError("Somente gestão ou financeiro pode autorizar exceção de crédito.",403);
  update.manual_credit_override=true;
  update.manual_override_reason=reason;
  update.approved_by=auth.user.id;
  update.approved_at=new Date().toISOString();
 }

 const {data,error}=await auth.client.from("b2b_proposals").update(update).eq("id",id).select().single();
 if(error)return jsonError(error.message,409);
 return NextResponse.json({proposal:data});
}
