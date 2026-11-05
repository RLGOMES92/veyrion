import { NextRequest,NextResponse } from "next/server";
import { getServiceClient } from "@/lib/b2b-server";

export async function POST(request:NextRequest) {
 const secret=process.env.ASAAS_WEBHOOK_TOKEN;
 if(!secret||request.headers.get("asaas-access-token")!==secret)return NextResponse.json({error:"Unauthorized"},{status:401});
 const body=await request.json().catch(()=>null);
 if(!body)return NextResponse.json({error:"Invalid payload"},{status:400});
 const event=String(body.event||"");
 const payment=body.payment||{};
 const eventId=String(body.id||`${payment.id||"unknown"}:${event}`);
 const db=getServiceClient();
 const claimedAt=new Date();
 const {error:logError}=await db.from("b2b_integration_events").insert({provider:"ASAAS",event_id:eventId,event_type:event,payload:body,processing_started_at:claimedAt.toISOString()});
 if(logError?.code==="23505") {
  const staleBefore=new Date(claimedAt.getTime()-5*60*1000).toISOString();
  const {data:claim,error:claimError}=await db.from("b2b_integration_events")
   .update({processing_started_at:claimedAt.toISOString(),processing_error:null})
   .eq("provider","ASAAS").eq("event_id",eventId).is("processed_at",null)
   .or(`processing_started_at.is.null,processing_started_at.lt.${staleBefore}`)
   .select("id").maybeSingle();
  if(claimError)return NextResponse.json({error:claimError.message},{status:500});
  if(!claim)return NextResponse.json({ok:true,duplicate:true,inProgress:true},{status:202});
 } else if(logError) return NextResponse.json({error:logError.message},{status:500});

 if(payment.id&&event==="PAYMENT_CREATED"&&payment.subscription) {
  const {data:contract}=await db.from("b2b_contracts").select("id,client_id,supplier_id,organization_id,recurring_amount,partner_amount,veyrion_commission").eq("billing_subscription_id",String(payment.subscription)).maybeSingle();
  if(!contract) {
   const message="Assinatura Asaas ainda não vinculada a contrato.";
   await db.from("b2b_integration_events").update({processing_error:message,processing_started_at:null}).eq("provider","ASAAS").eq("event_id",eventId);
   return NextResponse.json({error:message},{status:409});
  }
  const {error}=await db.from("b2b_charges").upsert({
   organization_id:contract.organization_id,contract_id:contract.id,client_id:contract.client_id,supplier_id:contract.supplier_id,
   provider:"ASAAS",provider_charge_id:payment.id,provider_subscription_id:String(payment.subscription),status:"PENDING",
   due_date:payment.dueDate||new Date().toISOString().slice(0,10),gross_amount:Number(payment.value||contract.recurring_amount),
   veyrion_fee:Number(contract.veyrion_commission),supplier_net:Number(contract.partner_amount),gateway_fee:0,veyrion_net:0,
   payment_method:payment.billingType||null,invoice_url:payment.invoiceUrl||null,split_status:"PENDING",provider_payload:body
  },{onConflict:"provider,provider_charge_id",ignoreDuplicates:true});
  if(error) {
   await db.from("b2b_integration_events").update({processing_error:error.message,processing_started_at:null}).eq("provider","ASAAS").eq("event_id",eventId);
   return NextResponse.json({error:error.message},{status:500});
  }
 }
 if(payment.id) {
  const status=event==="PAYMENT_RECEIVED"?"RECEIVED":event==="PAYMENT_CONFIRMED"?"CONFIRMED":event==="PAYMENT_OVERDUE"?"OVERDUE":event.startsWith("PAYMENT_REFUNDED")?"REFUNDED":null;
  if(status) {
   const netValue=Number(payment.netValue??payment.value??0);
   const grossValue=Number(payment.value??0);
   const {data:charge}=await db.from("b2b_charges").select("supplier_net").eq("provider","ASAAS").eq("provider_charge_id",payment.id).maybeSingle();
   if(!charge) {
    const message="Cobrança não localizada para o evento Asaas.";
    await db.from("b2b_integration_events").update({processing_error:message,processing_started_at:null}).eq("provider","ASAAS").eq("event_id",eventId);
    return NextResponse.json({error:message},{status:409});
   }
   const supplierNet=Number(charge.supplier_net||0);
   let chargeUpdate=db.from("b2b_charges").update({
    status,...(status==="RECEIVED"?{paid_at:new Date().toISOString()}:{}),
    gateway_fee:Math.max(0,grossValue-netValue),
    veyrion_net:status==="RECEIVED"?Math.max(0,netValue-supplierNet):0,
    provider_payload:body
   }).eq("provider","ASAAS").eq("provider_charge_id",payment.id);
   // Ignore stale status notifications so an out-of-order event cannot regress a settled charge.
   if(status==="CONFIRMED"||status==="OVERDUE") chargeUpdate=chargeUpdate.eq("status","PENDING");
   else if(status==="RECEIVED") chargeUpdate=chargeUpdate.in("status",["PENDING","CONFIRMED","OVERDUE"]);
   const {error}=await chargeUpdate;
   if(error) {
    await db.from("b2b_integration_events").update({processing_error:error.message,processing_started_at:null}).eq("provider","ASAAS").eq("event_id",eventId);
    return NextResponse.json({error:error.message},{status:500});
   }
  }
  if(event==="PAYMENT_SPLIT_DONE") {
   const {error}=await db.from("b2b_charges").update({split_status:"DONE",provider_payload:body}).eq("provider","ASAAS").eq("provider_charge_id",payment.id);
   if(error) { await db.from("b2b_integration_events").update({processing_error:error.message,processing_started_at:null}).eq("provider","ASAAS").eq("event_id",eventId); return NextResponse.json({error:error.message},{status:500}); }
  }
  if(["PAYMENT_SPLIT_DIVERGENCE_BLOCK","PAYMENT_SPLIT_DIVERGENCE_BLOCK_FINISHED"].includes(event)) {
   const {error}=await db.from("b2b_charges").update({split_status:"FAILED",provider_payload:body}).eq("provider","ASAAS").eq("provider_charge_id",payment.id);
   if(error) {
    await db.from("b2b_integration_events").update({processing_error:error.message,processing_started_at:null}).eq("provider","ASAAS").eq("event_id",eventId);
    return NextResponse.json({error:error.message},{status:500});
   }
  }
 }
 await db.from("b2b_integration_events").update({processed_at:new Date().toISOString(),processing_error:null,processing_started_at:null}).eq("provider","ASAAS").eq("event_id",eventId);
 return NextResponse.json({ok:true});
}
