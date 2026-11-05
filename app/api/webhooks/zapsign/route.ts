import { NextRequest,NextResponse } from "next/server";
import { getServiceClient } from "@/lib/b2b-server";

export async function POST(request:NextRequest) {
 const secret=process.env.ZAPSIGN_WEBHOOK_SECRET;
 if(!secret||request.headers.get("x-veyrion-webhook-secret")!==secret)return NextResponse.json({error:"Unauthorized"},{status:401});
 const body=await request.json().catch(()=>null);
 if(!body)return NextResponse.json({error:"Invalid payload"},{status:400});
 const event=String(body.event||body.type||"").toLowerCase();
 const doc=body.doc||body.document||body;
 const docId=String(doc.token||doc.doc_token||doc.id||body.token||"");
 if(!docId)return NextResponse.json({error:"Document id missing"},{status:400});
 const db=getServiceClient();
 const eventId=String(body.event_id||body.id||`${docId}:${event}:${doc.status||""}`);
 const claimedAt=new Date();
 const {error:logError}=await db.from("b2b_integration_events").insert({provider:"ZAPSIGN",event_id:eventId,event_type:event,payload:body,processing_started_at:claimedAt.toISOString()});
 if(logError?.code==="23505") {
  const staleBefore=new Date(claimedAt.getTime()-5*60*1000).toISOString();
  const {data:claim,error:claimError}=await db.from("b2b_integration_events")
   .update({processing_started_at:claimedAt.toISOString(),processing_error:null})
   .eq("provider","ZAPSIGN").eq("event_id",eventId).is("processed_at",null)
   .or(`processing_started_at.is.null,processing_started_at.lt.${staleBefore}`)
   .select("id").maybeSingle();
  if(claimError)return NextResponse.json({error:claimError.message},{status:500});
  if(!claim)return NextResponse.json({ok:true,duplicate:true,inProgress:true},{status:202});
 } else if(logError) return NextResponse.json({error:logError.message},{status:500});

 const signed=/signed|assinado|completed/.test(event)||String(doc.status||"").toLowerCase()==="signed";
 if(signed) {
  const {data:contract,error:lookupError}=await db.from("b2b_contracts").select("id,proposal_id,supplier_id,organization_id,status").eq("signature_document_id",docId).single();
  if(lookupError||!contract) {
   const message="Contrato não localizado para o documento assinado.";
   await db.from("b2b_integration_events").update({processing_error:message,processing_started_at:null}).eq("provider","ZAPSIGN").eq("event_id",eventId);
   return NextResponse.json({error:message},{status:409});
  }
  // A signed callback must never revive a cancelled/draft contract or overwrite a
  // terminal proposal state. Keep the event retryable for manual investigation.
  if(!["PENDING_SIGNATURE","ACTIVE"].includes(contract.status)) {
   const message="Contrato não está aguardando assinatura nem ativo; ativação automática bloqueada.";
   await db.from("b2b_integration_events").update({processing_error:message,processing_started_at:null}).eq("provider","ZAPSIGN").eq("event_id",eventId);
   return NextResponse.json({error:message},{status:409});
  }
  const {data:proposalState,error:proposalReadError}=await db.from("b2b_proposals").select("id,status").eq("id",contract.proposal_id).maybeSingle();
  if(proposalReadError||!proposalState||!["SIGNING","WON"].includes(proposalState.status)) {
   const message=proposalReadError?.message||"A proposta não está em assinatura ou já foi encerrada; ativação automática bloqueada.";
   await db.from("b2b_integration_events").update({processing_error:message,processing_started_at:null}).eq("provider","ZAPSIGN").eq("event_id",eventId);
   return NextResponse.json({error:message},{status:409});
  }
  // Conditional activation makes retries idempotent and prevents reactivation after cancellation.
  const {data:activated,error:activationError}=await db.from("b2b_contracts").update({status:"ACTIVE",signed_at:new Date().toISOString()}).eq("id",contract.id).eq("status","PENDING_SIGNATURE").select("id").maybeSingle();
  if(activationError) {
   await db.from("b2b_integration_events").update({processing_error:activationError.message,processing_started_at:null}).eq("provider","ZAPSIGN").eq("event_id",eventId);
   return NextResponse.json({error:"Contrato assinado, mas ativação/estoque precisa de intervenção: "+activationError.message},{status:409});
  }
  if(proposalState.status==="SIGNING") {
   const {data:wonProposal,error:proposalError}=await db.from("b2b_proposals").update({status:"WON"}).eq("id",contract.proposal_id).eq("status","SIGNING").select("id").maybeSingle();
   if(proposalError||!wonProposal) {
    const message=proposalError?.message||"A proposta mudou de etapa durante a ativação; exige reconciliação manual.";
    await db.from("b2b_integration_events").update({processing_error:message,processing_started_at:null}).eq("provider","ZAPSIGN").eq("event_id",eventId);
    return NextResponse.json({error:message},{status:409});
   }
  }
  const {data:supplier,error:supplierError}=await db.from("b2b_suppliers").select("contact_email,legal_name").eq("id",contract.supplier_id).single();
  if(supplierError) {
   await db.from("b2b_integration_events").update({processing_error:supplierError.message,processing_started_at:null}).eq("provider","ZAPSIGN").eq("event_id",eventId);
   return NextResponse.json({error:"Contrato ativado, mas não foi possível consultar o contato do fornecedor."},{status:500});
  }
  // Persist the notification before acknowledging the signature event. The deterministic
  // key makes webhook retries safe even when the contract was activated by an earlier attempt.
  if(contract.status==="ACTIVE"||Boolean(activated)) {
   const idempotencyKey=`contract-activated:${contract.id}:supplier-email`;
   const hasRecipient=Boolean(supplier?.contact_email);
   const {error:queueError}=await db.from("b2b_notification_outbox").upsert({
    organization_id:contract.organization_id,
    contract_id:contract.id,
    supplier_id:contract.supplier_id,
    notification_type:"SUPPLIER_CONTRACT_ACTIVATED",
    idempotency_key:idempotencyKey,
    recipient_email:supplier?.contact_email||null,
    subject:"Contrato VEYRION assinado — preparar entrega",
    html_body:`<p>O contrato foi assinado. Parceiro: ${supplier?.legal_name||"Fornecedor"}. Acesse o VEYRION OS para conferir equipamentos, SLA e data de entrega.</p>`,
    status:hasRecipient?"PENDING":"BLOCKED",
    last_error:hasRecipient?null:"Fornecedor sem e-mail cadastrado; atualize o contato para liberar o envio."
   },{onConflict:"idempotency_key",ignoreDuplicates:true});
   if(queueError) {
    await db.from("b2b_integration_events").update({processing_error:queueError.message,processing_started_at:null}).eq("provider","ZAPSIGN").eq("event_id",eventId);
    return NextResponse.json({error:"Contrato ativado, mas a notificação não entrou na fila. O evento poderá ser repetido com segurança."},{status:500});
   }
   if(hasRecipient) {
    const {error:unblockError}=await db.from("b2b_notification_outbox").update({
     recipient_email:supplier.contact_email,status:"PENDING",last_error:null,next_attempt_at:new Date().toISOString(),updated_at:new Date().toISOString()
    }).eq("idempotency_key",idempotencyKey).eq("status","BLOCKED");
    if(unblockError) {
     await db.from("b2b_integration_events").update({processing_error:unblockError.message,processing_started_at:null}).eq("provider","ZAPSIGN").eq("event_id",eventId);
     return NextResponse.json({error:"Contrato ativado, mas a notificação bloqueada não pôde ser liberada."},{status:500});
    }
   }
  } }
 const {error:finalizeError}=await db.from("b2b_integration_events").update({processed_at:new Date().toISOString(),processing_error:null,processing_started_at:null}).eq("provider","ZAPSIGN").eq("event_id",eventId);
 if(finalizeError) return NextResponse.json({error:"Webhook side effects completed but event finalization failed; provider retry required."},{status:500});
 return NextResponse.json({ok:true});
}
