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
 const {data:existingContract}=await auth.client.from("b2b_contracts").select("id,status,signature_document_id,signature_url,created_at").eq("proposal_id",p.id).maybeSingle();
 if(existingContract)return NextResponse.json({contract:existingContract,signature:"ALREADY_EXISTS",message:"Esta proposta já possui contrato. Reutilize o contrato existente para evitar duplicidade."},{status:409});
 const start=new Date(); const end=new Date(start); end.setMonth(end.getMonth()+p.term_months);
 const clauses=body.clauses||{};
 const html=`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Contrato VEYRION ${esc(p.proposal_number)}</title><body style="font:14px/1.6 Arial;color:#172033;max-width:850px;margin:40px auto"><h1>CONTRATO TRIPARTITE DE LOCAÇÃO E SERVIÇOS DE TI</h1><p><b>Contratante:</b> ${esc(p.client.legal_name)} · CNPJ ${esc(p.client.cnpj)} · endereço: ${esc([p.client.address?.street,p.client.address?.district,p.client.address?.city,p.client.address?.state,p.client.address?.postal_code].filter(Boolean).join(", "))}</p><p><b>Intermediadora:</b> VEYRION OS — ${esc(process.env.VEYRION_LEGAL_NAME||"PREENCHER RAZÃO SOCIAL")} · CNPJ ${esc(process.env.VEYRION_CNPJ||"PREENCHER CNPJ")} · ${esc(process.env.VEYRION_LEGAL_ADDRESS||"PREENCHER ENDEREÇO")}.</p><p><b>Parceiro técnico:</b> ${esc(p.supplier.legal_name)} · CNPJ ${esc(p.supplier.cnpj||"não informado")}</p><p><b>Representante signatário do cliente:</b> ${esc(body.signer?.name||"A definir")} · ${esc(body.signer?.email||"A definir")}</p><h2>1. Objeto e equipamentos</h2><ul>${(p.items||[]).map((i:any)=>`<li>${esc(i.quantity)} × ${esc(i.model)} — R$ ${Number(i.client_unit_monthly).toFixed(2)} por unidade/mês</li>`).join("")}</ul><h2>2. Prazo e recorrência</h2><p>Vigência de ${esc(p.term_months)} meses. Valor mensal total: R$ ${Number(p.monthly_revenue).toFixed(2)}. Início previsto: ${start.toLocaleDateString("pt-BR")}; término estimado: ${end.toLocaleDateString("pt-BR")}.</p><h2>3. Obrigações e SLA</h2><p>O parceiro técnico executará entrega, manutenção e substituição conforme SLA pactuado de ${esc(p.supplier.sla_replacement_hours||48)} horas, sujeito à validação de cobertura, estoque e logística no anexo operacional. Condições do parceiro: ${esc(p.supplier.maintenance_terms||"manutenção preventiva/corretiva e substituição conforme anexo técnico a ser aprovado")}.</p><h2>4. Pagamento e inadimplência</h2><p>Cobrança mensal recorrente. Multa moratória de ${esc(clauses.late_fee_percent??2)}% e juros de ${esc(clauses.interest_monthly_percent??1)}% ao mês, observada a legislação aplicável e revisão jurídica.</p><h2>5. Responsabilidades</h2><p>A VEYRION OS atua como intermediadora comercial e gestora contratual. As responsabilidades técnicas, garantias, logística, manutenção, proteção de dados, seguros, limites de responsabilidade, rescisão e foro deverão constar no instrumento final validado por assessoria jurídica.</p><p><b>ATENÇÃO:</b> minuta operacional gerada automaticamente; não constitui aconselhamento jurídico e não deve ser assinada antes da qualificação completa da VEYRION, revisão das cláusulas e validação dos anexos.</p></body></html>`;
 const {data:contract,error:insertError}=await auth.client.from("b2b_contracts").insert({proposal_id:p.id,client_id:p.client_id,supplier_id:p.supplier_id,status:"DRAFT",contract_html:html,recurring_amount:p.monthly_revenue,partner_amount:p.monthly_supplier_cost,veyrion_commission:p.monthly_gross_margin,sla_replacement_hours:p.supplier.sla_replacement_hours||48,late_fee_percent:clauses.late_fee_percent??2,interest_monthly_percent:clauses.interest_monthly_percent??1,start_date:start.toISOString().slice(0,10),end_date:end.toISOString().slice(0,10)}).select().single();
 if(insertError?.code==="23505") { const {data:duplicate}=await auth.client.from("b2b_contracts").select("id,status,signature_document_id,signature_url,created_at").eq("proposal_id",p.id).maybeSingle(); return NextResponse.json({contract:duplicate,signature:"ALREADY_EXISTS",message:"Esta proposta já possui contrato. Reutilize o contrato existente para evitar duplicidade."},{status:409}); }
 if(insertError||!contract)return jsonError(insertError?.message||"Falha ao salvar contrato.");
 const token=process.env.ZAPSIGN_API_TOKEN;
 if(!token)return NextResponse.json({contract,signature:"NOT_CONFIGURED",message:"Minuta salva. Configure ZAPSIGN_API_TOKEN e os dados do signatário para habilitar assinatura digital."},{status:201});
 const signer=body.signer||{};
 if(!signer.name||!signer.email)return NextResponse.json({contract,signature:"MISSING_SIGNER",message:"Informe nome e e-mail do representante legal para enviar à assinatura."},{status:201});
 await auth.client.from("b2b_contracts").update({signature_dispatch_status:"SENDING",signature_dispatch_error:null,signature_dispatch_attempted_at:new Date().toISOString()}).eq("id",contract.id);
 let response: Response;
 try {
  response=await fetch(`${process.env.ZAPSIGN_API_URL||"https://api.zapsign.com.br/api/v1"}/docs/`,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({name:`Contrato VEYRION ${p.proposal_number}`,external_id:contract.id,markdown_text:html.replace(/<[^>]*>/g," ").replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/\s+/g," ").trim(),signers:[{name:signer.name,email:signer.email,auth_mode:"assinaturaTela"}],observers:[p.supplier.contact_email].filter(Boolean),metadata:[{key:"veyrion_contract_id",value:contract.id}]})});
 } catch (error) {
  const message=error instanceof Error?error.message:"Falha de rede sem confirmação do provedor.";
  await auth.client.from("b2b_contracts").update({signature_dispatch_status:"UNKNOWN",signature_dispatch_error:message}).eq("id",contract.id);
  return NextResponse.json({contract,signature:"UNKNOWN",message:"Não foi possível confirmar o resultado na ZapSign. Não reenvie: confira o documento pelo identificador externo "+contract.id+".",provider_error:message},{status:502});
 }
 const z=await response.json().catch(()=>({}));
 if(!response.ok) {
  const confirmedFailure=response.status>=400&&response.status<500;
  const dispatchStatus=confirmedFailure?"FAILED":"UNKNOWN";
  await auth.client.from("b2b_contracts").update({signature_dispatch_status:dispatchStatus,signature_dispatch_error:JSON.stringify(z).slice(0,2000)}).eq("id",contract.id);
  return NextResponse.json({contract,signature:dispatchStatus,message:confirmedFailure?"A ZapSign rejeitou a solicitação. Corrija os dados antes de tentar novamente.":"A ZapSign retornou erro de servidor; o resultado pode ser incerto. Não reenvie antes de conferir o documento.",provider_error:z},{status:502});
 }
 const docId=z.token||z.doc_token||z.id;
 if(!docId) {
  await auth.client.from("b2b_contracts").update({signature_dispatch_status:"UNKNOWN",signature_dispatch_error:"Resposta 2xx sem identificador do documento."}).eq("id",contract.id);
  return NextResponse.json({contract,signature:"UNKNOWN",message:"A ZapSign respondeu sem identificador do documento. Não reenvie antes de reconciliar pelo identificador externo "+contract.id+".",provider_response:z},{status:502});
 }
 const {error:contractUpdateError}=await auth.client.from("b2b_contracts").update({status:"PENDING_SIGNATURE",signature_provider:"ZAPSIGN",signature_document_id:docId,signature_url:z.signers?.[0]?.sign_url||z.url_doc||null,signature_dispatch_status:"SENT",signature_dispatch_error:null}).eq("id",contract.id);
 if(contractUpdateError) {
  await auth.client.from("b2b_contracts").update({signature_dispatch_status:"UNKNOWN",signature_dispatch_error:"Documento criado na ZapSign, mas não foi possível persistir o vínculo: "+contractUpdateError.message}).eq("id",contract.id);
  return NextResponse.json({contract,signature:"UNKNOWN",message:"Documento criado na ZapSign, mas o vínculo não foi salvo. Não envie novamente; reconcilie pelo identificador externo "+contract.id+".",details:contractUpdateError.message},{status:502});
 }
 const {error:proposalUpdateError}=await auth.client.from("b2b_proposals").update({status:"SIGNING"}).eq("id",p.id);
 if(proposalUpdateError)return NextResponse.json({contract,signature:"PERSISTENCE_FAILED",message:"Documento criado e contrato vinculado, mas a proposta não avançou para SIGNING.",details:proposalUpdateError.message},{status:502});
 return NextResponse.json({contract:{...contract,status:"PENDING_SIGNATURE",signature_document_id:docId},signature:"SENT",provider_response:z},{status:201});
}
