import { NextRequest, NextResponse } from "next/server";
import { requireUser, jsonError } from "@/lib/b2b-server";

const esc=(v:unknown)=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
export async function POST(request:NextRequest) {
 const auth=await requireUser(request); if(!auth)return jsonError("Sessão inválida.",401);
 const body=await request.json().catch(()=>null); if(!body?.proposal_id)return jsonError("Informe a proposta.");
 const {data:p,error}=await auth.client.from("b2b_proposals").select("*,client:b2b_clients(*),supplier:b2b_suppliers(*) ,items:b2b_proposal_items(*)").eq("id",body.proposal_id).single();
 if(error||!p)return jsonError("Proposta não encontrada.");
 if(!["SENT","NEGOTIATION","SIGNING"].includes(p.status))return jsonError("A proposta precisa estar enviada e aprovada para gerar contrato.");
 if(p.client.registration_status!=="ATIVA")return jsonError("CNPJ não ativo. Contrato bloqueado.");
 const start=new Date(); const end=new Date(start); end.setMonth(end.getMonth()+p.term_months);
 const clauses=body.clauses||{};
 const html=`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Contrato VEYRION ${esc(p.proposal_number)}</title><body style="font:14px/1.6 Arial;color:#172033;max-width:850px;margin:40px auto"><h1>CONTRATO TRIPARTITE DE LOCAÇÃO E SERVIÇOS DE TI</h1><p><b>Contratante:</b> ${esc(p.client.legal_name)} · CNPJ ${esc(p.client.cnpj)}</p><p><b>Intermediadora:</b> VEYRION OS — ${esc(process.env.VEYRION_LEGAL_NAME)} · CNPJ ${esc(process.env.VEYRION_CNPJ)} · ${esc(process.env.VEYRION_LEGAL_ADDRESS)}.</p><p><b>Parceiro técnico:</b> ${esc(p.supplier.legal_name)} · CNPJ ${esc(p.supplier.cnpj||"não informado")}</p><h2>1. Objeto e equipamentos</h2><ul>${(p.items||[]).map((i:any)=>`<li>${esc(i.quantity)} × ${esc(i.model)} — R$ ${Number(i.client_unit_monthly).toFixed(2)} por unidade/mês</li>`).join("")}</ul><h2>2. Prazo e recorrência</h2><p>Vigência de ${esc(p.term_months)} meses. Valor mensal total: R$ ${Number(p.monthly_revenue).toFixed(2)}. Início previsto: ${start.toLocaleDateString("pt-BR")}; término estimado: ${end.toLocaleDateString("pt-BR")}.</p><h2>3. Obrigações e SLA</h2><p>O parceiro técnico executará entrega, manutenção e substituição conforme SLA pactuado de ${esc(p.supplier.sla_replacement_hours||48)} horas, sujeito à validação de cobertura, estoque e logística no anexo operacional.</p><h2>4. Pagamento e inadimplência</h2><p>Cobrança mensal recorrente. Multa moratória de ${esc(clauses.late_fee_percent??2)}% e juros de ${esc(clauses.interest_monthly_percent??1)}% ao mês, observada a legislação aplicável e revisão jurídica.</p><h2>5. Responsabilidades</h2><p>A VEYRION OS atua como intermediadora comercial e gestora contratual. As responsabilidades técnicas, garantias, logística, manutenção, proteção de dados, seguros, limites de responsabilidade, rescisão e foro deverão constar no instrumento final validado por assessoria jurídica.</p><p><b>ATENÇÃO:</b> minuta operacional gerada automaticamente; não constitui aconselhamento jurídico e não deve ser assinada antes da qualificação completa da VEYRION, revisão das cláusulas e validação dos anexos.</p></body></html>`;
 const {data:contract,error:insertError}=await auth.client.from("b2b_contracts").insert({proposal_id:p.id,client_id:p.client_id,supplier_id:p.supplier_id,status:"DRAFT",contract_html:html,recurring_amount:p.monthly_revenue,partner_amount:p.monthly_supplier_cost,veyrion_commission:p.monthly_gross_margin,sla_replacement_hours:p.supplier.sla_replacement_hours||48,late_fee_percent:clauses.late_fee_percent??2,interest_monthly_percent:clauses.interest_monthly_percent??1,start_date:start.toISOString().slice(0,10),end_date:end.toISOString().slice(0,10)}).select().single();
 if(insertError||!contract)return jsonError(insertError?.message||"Falha ao salvar contrato.");
 const token=process.env.ZAPSIGN_API_TOKEN;
 if(!token)return NextResponse.json({contract,signature:"NOT_CONFIGURED",message:"Minuta salva. Configure ZAPSIGN_API_TOKEN e os dados do signatário para habilitar assinatura digital."},{status:201});
 const signer=body.signer||{};
 if(!signer.name||!signer.email)return NextResponse.json({contract,signature:"MISSING_SIGNER",message:"Informe nome e e-mail do representante legal para enviar à assinatura."},{status:201});
 const response=await fetch("https://api.zapsign.com.br/api/v1/docs/",{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({name:`Contrato VEYRION ${p.proposal_number}`,markdown_text:html.replace(/<[^>]*>/g," ").replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/\s+/g," ").trim(),signers:[{name:signer.name,email:signer.email,auth_mode:"assinaturaTela"}],observers:[p.supplier.contact_email].filter(Boolean),metadata:[{key:"veyrion_contract_id",value:contract.id}]})});
 const z=await response.json().catch(()=>({}));
 if(!response.ok)return NextResponse.json({contract,signature:"FAILED",provider_error:z},{status:502});
 const docId=z.token||z.doc_token||z.id;
 await auth.client.from("b2b_contracts").update({status:"PENDING_SIGNATURE",signature_provider:"ZAPSIGN",signature_document_id:docId,signature_url:z.signers?.[0]?.sign_url||z.url_doc||null}).eq("id",contract.id);
 await auth.client.from("b2b_proposals").update({status:"SIGNING"}).eq("id",p.id);
 return NextResponse.json({contract:{...contract,status:"PENDING_SIGNATURE",signature_document_id:docId},signature:"SENT",provider_response:z},{status:201});
}
