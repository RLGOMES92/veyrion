
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
 const {error:logError}=await db.from("b2b_integration_events").insert({provider:"ASAAS",event_id:eventId,event_type:event,payload:body});
 if(logError?.code==="23505")return NextResponse.json({ok:true,duplicate:true});
 if(logError)return NextResponse.json({error:logError.message},{status:500});

 if(payment.id&&event==="PAYMENT_CREATED"&&payment.subscription) {
  const {data:contract}=await db.from("b2b_contracts").select("id,client_id,supplier_id,organization_id,recurring_amount,partner_amount,veyrion_commission").eq("billing_subscription_id",String(payment.subscription)).maybeSingle();
  if(contract) {
   const {error}=await db.from("b2b_charges").upsert({
    organization_id:contract.organization_id,contract_id:contract.id,client_id:contract.client_id,supplier_id:contract.supplier_id,
    provider:"ASAAS",provider_charge_id:payment.id,provider_subscription_id:String(payment.subscription),status:"PENDING",
    due_date:payment.dueDate||new Date().toISOString().slice(0,10),gross_amount:Number(payment.value||contract.recurring_amount),
    veyrion_fee:Number(contract.veyrion_commission),supplier_net:Number(contract.partner_amount),gateway_fee:0,veyrion_net:0,
    payment_method:payment.billingType||null,invoice_url:payment.invoiceUrl||null,split_status:"PENDING",provider_payload:body
   },{onConflict:"provider,provider_charge_id"});
   if(error)await db.from("b2b_integration_events").update({processing_error:error.message}).eq("provider","ASAAS").eq("event_id",eventId);
  }
 }

 if(payment.id) {
  const status=event==="PAYMENT_RECEIVED"?"RECEIVED":event==="PAYMENT_CONFIRMED"?"CONFIRMED":event==="PAYMENT_OVERDUE"?"OVERDUE":event.startsWith("PAYMENT_REFUNDED")?"REFUNDED":null;
  if(status) {
   const netValue=Number(payment.netValue??payment.value??0);
   const grossValue=Number(payment.value??0);
   const {data:charge}=await db.from("b2b_charges").select("supplier_net").eq("provider","ASAAS").eq("provider_charge_id",payment.id).maybeSingle();
   const supplierNet=Number(charge?.supplier_net||0);
   await db.from("b2b_charges").update({
    status,paid_at:status==="RECEIVED"?new Date().toISOString():null,
    gateway_fee:Math.max(0,grossValue-netValue),
    veyrion_net:status==="RECEIVED"?Math.max(0,netValue-supplierNet):0,
    provider_payload:body
   }).eq("provider","ASAAS").eq("provider_charge_id",payment.id);
  }
  if(event==="PAYMENT_SPLIT_DONE")await db.from("b2b_charges").update({split_status:"DONE",provider_payload:body}).eq("provider","ASAAS").eq("provider_charge_id",payment.id);
  if(["PAYMENT_SPLIT_DIVERGENCE_BLOCK","PAYMENT_SPLIT_DIVERGENCE_BLOCK_FINISHED"].includes(event))await db.from("b2b_charges").update({split_status:"FAILED",provider_payload:body}).eq("provider","ASAAS").eq("provider_charge_id",payment.id);
 }
 await db.from("b2b_integration_events").update({processed_at:new Date().toISOString()}).eq("provider","ASAAS").eq("event_id",eventId);
 return NextResponse.json({ok:true});
}
