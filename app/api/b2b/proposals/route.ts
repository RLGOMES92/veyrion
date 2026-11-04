import { NextRequest, NextResponse } from "next/server";
import { requireUser, jsonError } from "@/lib/b2b-server";

export async function GET(request:NextRequest) {
 const auth=await requireUser(request); if(!auth)return jsonError("Sessão inválida.",401);
 const {data,error}=await auth.client.from("b2b_proposals").select("*,client:b2b_clients(legal_name,cnpj,credit_decision,monthly_revenue_estimate),supplier:b2b_suppliers(legal_name),items:b2b_proposal_items(*)").order("created_at",{ascending:false}).limit(100);
 if(error)return jsonError(error.message,400); return NextResponse.json({proposals:data});
}
export async function POST(request:NextRequest) {
 const auth=await requireUser(request); if(!auth)return jsonError("Sessão inválida.",401);
 const body=await request.json().catch(()=>null); if(!body)return jsonError("Dados inválidos.");
 const {client_id,supplier_id,term_months,items}=body;
 if(!client_id||!supplier_id||![12,24,36].includes(Number(term_months))||!Array.isArray(items)||!items.length)return jsonError("Cliente, parceiro, vigência e ao menos um item são obrigatórios.");
 const {data:client,error:ce}=await auth.client.from("b2b_clients").select("*").eq("id",client_id).single();
 if(ce||!client)return jsonError("Cliente não encontrado.");
 if(client.registration_status!=="ATIVA")return jsonError("Proposta bloqueada: CNPJ não está ATIVO.");
 if(client.credit_decision==="REJECTED")return jsonError("Proposta bloqueada pela análise de risco.");
 const {data:supplier,error:se}=await auth.client.from("b2b_suppliers").select("id").eq("id",supplier_id).eq("active",true).single();
 if(se||!supplier)return jsonError("Fornecedor parceiro não encontrado ou inativo.");
 const number="VYR-"+new Date().getFullYear()+"-"+crypto.randomUUID().slice(0,8).toUpperCase();
 const {data:proposal,error:pe}=await auth.client.from("b2b_proposals").insert({client_id,supplier_id,term_months:Number(term_months),proposal_number:number,status:"DRAFT",notes:body.notes||null}).select().single();
 if(pe||!proposal)return jsonError(pe?.message||"Não foi possível criar proposta.");
 const rows:any[]=[];
 for(const x of items) {
  let model=String(x.model||"Modelo não informado");
  let partnerCost=Number(x.partner_unit_monthly);
  if(x.supplier_product_id) {
   const {data:product,error:productError}=await auth.client.from("b2b_supplier_products").select("id,supplier_id,model,description,available_quantity,partner_unit_monthly,active").eq("id",x.supplier_product_id).single();
   if(productError||!product||product.supplier_id!==supplier_id||!product.active){await auth.client.from("b2b_proposals").delete().eq("id",proposal.id);return jsonError("Modelo não pertence ao parceiro selecionado ou está inativo.");}
   if(Number(x.quantity)>product.available_quantity){await auth.client.from("b2b_proposals").delete().eq("id",proposal.id);return jsonError("Estoque insuficiente para o modelo "+product.model+".");}
   model=product.model;partnerCost=Number(product.partner_unit_monthly);
  }
  if(!x.supplier_product_id&&(x.partner_unit_monthly===undefined||x.partner_unit_monthly==="")){await auth.client.from("b2b_proposals").delete().eq("id",proposal.id);return jsonError("Informe o custo mensal do parceiro ou selecione um modelo do catálogo.");}
  if(!Number.isFinite(Number(x.client_unit_monthly))||Number(x.client_unit_monthly)<=0){await auth.client.from("b2b_proposals").delete().eq("id",proposal.id);return jsonError("O preço mensal cobrado do cliente deve ser maior que zero.");}
  rows.push({proposal_id:proposal.id,supplier_product_id:x.supplier_product_id||null,description:String(x.description||model),model,quantity:Number(x.quantity),partner_unit_monthly:partnerCost,client_unit_monthly:Number(x.client_unit_monthly)});
 }
 if(rows.some(x=>!x.model||!Number.isInteger(x.quantity)||x.quantity<1||!Number.isFinite(x.partner_unit_monthly)||!Number.isFinite(x.client_unit_monthly)||x.partner_unit_monthly<0||x.client_unit_monthly<0)){await auth.client.from("b2b_proposals").delete().eq("id",proposal.id);return jsonError("Confira modelo, quantidade e valores dos itens.");}
 const {error:ie}=await auth.client.from("b2b_proposal_items").insert(rows);
 if(ie){await auth.client.from("b2b_proposals").delete().eq("id",proposal.id);return jsonError(ie.message);}
 const {data:complete,error:fe}=await auth.client.from("b2b_proposals").select("*,items:b2b_proposal_items(*)").eq("id",proposal.id).single();
 if(fe)return jsonError(fe.message);
 return NextResponse.json({proposal:complete}, {status:201});
}
