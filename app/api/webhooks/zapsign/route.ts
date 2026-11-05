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
  const {data:contract,error:lookupError}=await db.from("b2b_contracts").select("id,proposal_id,supplier_id,organization_id").eq("signature_document_id",docId).single();
  if(lookupError||!contract) {
   const message="Contrato não localizado para o documento assinado.";
   await db.from("b2b_integration_events").update({processing_error:message,processing_started_at:null,processing_started_at:null}).eq("provider","ZAPSIGN").eq("event_id",eventId);
   return NextResponse.json({error:message},{status:409});
  }
  const {error:activationError}=await db.from("b2b_contracts").update({status:"ACTIVE",signed_at:new Date().toISOString()}).eq("id",contract.id);
  if(activationError) {
   await db.from("b2b_integration_events").update({processing_error:activationError.message,processing_started_at:null,processing_started_at:null}).eq("provider","ZAPSIGN").eq("event_id",eventId);
   return NextResponse.json({error:"Contrato assinado, mas ativação/estoque precisa de intervenção: "+activationError.message},{status:409});
  }
  const {error:proposalError}=await db.from("b2b_proposals").update({status:"WON"}).eq("id",contract.proposal_id);
  if(proposalError) {
   await db.from("b2b_integration_events").update({processing_error:proposalError.message,processing_started_at:null,processing_started_at:null}).eq("provider","ZAPSIGN").eq("event_id",eventId);
   return NextResponse.json({error:proposalError.message},{status:500});
  }
  const {data:supplier}=await db.from("b2b_suppliers").select("contact_email,legal_name").eq("id",contract.supplier_id).single();
  if(supplier?.contact_email&&process.env.RESEND_API_KEY) {
   const mail=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({from:process.env.RESEND_FROM_EMAIL||"VEYRION OS <onboarding@resend.dev>",to:[supplier.contact_email],subject:"Contrato VEYRION assinado — preparar entrega",html:`<p>O contrato foi assinado. Parceiro: ${supplier.legal_name}. Acesse o VEYRION OS para conferir equipamentos, SLA e data de entrega.</p>`})});
   if(!mail.ok) console.error("VEYRION supplier notification failed after contract activation.");
  }
 }
 await db.from("b2b_integration_events").update({processed_at:new Date().toISOString(),processing_error:null,processing_started_at:null}).eq("provider","ZAPSIGN").eq("event_id",eventId);
 return NextResponse.json({ok:true});
}
