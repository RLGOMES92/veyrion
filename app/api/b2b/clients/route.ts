import { NextRequest, NextResponse } from "next/server";
import { requireUser, jsonError } from "@/lib/b2b-server";

function monthsSince(date?: string | null) {
 if (!date) return null;
 const d = new Date(date + "T00:00:00");
 if (Number.isNaN(d.getTime())) return null;
 const now = new Date();
 return (now.getFullYear()-d.getFullYear())*12 + now.getMonth()-d.getMonth() - (now.getDate()<d.getDate()?1:0);
}

export async function POST(request: NextRequest) {
 const auth = await requireUser(request);
 if (!auth) return jsonError("Sessão inválida. Entre novamente.",401);
 const body = await request.json().catch(()=>null);
 if (!body) return jsonError("Corpo inválido.");
 const cnpj = String(body.cnpj||"").replace(/\D/g,"");
 if (cnpj.length!==14 || !body.legal_name) return jsonError("CNPJ e razão social são obrigatórios.");
 const revenue = body.monthly_revenue_estimate===null || body.monthly_revenue_estimate==="" ? null : Number(body.monthly_revenue_estimate);
 if (revenue!==null && (!Number.isFinite(revenue)||revenue<0)) return jsonError("Faturamento mensal inválido.");
 const status = String(body.registration_status||"").toUpperCase();
 const age = monthsSince(body.opening_date);
 const reasons:string[]=[];
 let decision:"APPROVED"|"MANUAL_REVIEW"|"REJECTED" = "MANUAL_REVIEW";
 if (status!=="ATIVA") { decision="REJECTED"; reasons.push("Situação cadastral diferente de ATIVA: propostas bloqueadas."); }
 else {
   if (age===null) reasons.push("Data de abertura não confirmada: revisão manual.");
   else if (age<6) reasons.push("Empresa com menos de seis meses: revisão manual obrigatória.");
   if (revenue===null || revenue<=0) reasons.push("Faturamento mensal estimado não informado.");
   if (!body.credit_review_confirmed) reasons.push("Aprovação de crédito exige revisão humana e justificativa registrada.");
   if (age!==null && age>=6 && revenue!==null && revenue>0 && body.credit_review_confirmed && String(body.credit_review_note||"").trim().length>=10) {
     decision="APPROVED"; reasons.push("Triagem cadastral aprovada por revisão humana registrada.");
   }
 }
 if(body.credit_review_confirmed) {
  const {data:membership}=await auth.client.from("organization_members").select("role").eq("user_id",auth.user.id).maybeSingle();
  if(!membership || !["owner","admin","manager","finance"].includes(membership.role)) return jsonError("Somente gestão ou financeiro pode registrar aprovação manual de crédito.",403);
  if(String(body.credit_review_note||"").trim().length<10) return jsonError("Justificativa da aprovação manual deve ter ao menos 10 caracteres.");
 }
 const payload = {
  cnpj, legal_name:String(body.legal_name), trade_name:body.trade_name||null,
  registration_status:status||"PENDENTE", opening_date:body.opening_date||null,
  primary_cnae:body.primary_cnae||null, primary_cnae_code:body.primary_cnae_code||null,
  address:body.address||{}, qsa:Array.isArray(body.qsa)?body.qsa:[],
  source_name:body.source_name||null, source_checked_at:new Date().toISOString(),
  contact_email:body.contact_email||null, contact_phone:body.contact_phone||null,
  employee_count:body.employee_count===null||body.employee_count===""?null:Number(body.employee_count),
  employee_range:body.employee_range||null, monthly_revenue_estimate:revenue,
  credit_decision:decision, credit_score:body.credit_score??null,
  credit_reasons:reasons, credit_reviewed_at:body.credit_review_confirmed?new Date().toISOString():null,
  credit_reviewed_by:body.credit_review_confirmed?auth.user.id:null,
  notes:[body.notes,body.credit_review_note].filter(Boolean).join("\n")
 };
 const {data,error}=await auth.client.from("b2b_clients").upsert(payload,{onConflict:"organization_id,cnpj"}).select().single();
 if(error) return jsonError(error.message,400);
 await auth.client.from("b2b_credit_assessments").insert({client_id:data.id,provider:"VEYRION_RULES",status:"COMPLETED",score:data.credit_score,decision,factors:reasons.map(reason=>({reason})),raw_summary:{source:payload.source_name,registration_status:status,opening_age_months:age,monthly_revenue_estimate:revenue,rental_limit_monthly:data.rental_limit_monthly},checked_at:new Date().toISOString(),created_by:auth.user.id});
 return NextResponse.json({client:data,decision,reasons,rental_limit_monthly:data.rental_limit_monthly});
}
