import { NextRequest,NextResponse } from "next/server";
import { getServiceClient } from "@/lib/b2b-server";

export async function POST(request:NextRequest) {
 const secret=process.env.ASAAS_WEBHOOK_TOKEN;
 if(!secret||request.headers.get("asaas-access-token")!==secret)return NextResponse.json({error:"Unauthorized"},{status:401});
 const body=await request.json().catch(()=>null); if(!body)return NextResponse.json({error:"Invalid payload"},{status:400});
 const event=String(body.event||""); const payment=body.payment||{};
 const eventId=String(body.id||payment.id||crypto.randomUUID());
 const db=getServiceClient();
 const {error:logError}=await db.from("b2b_integration_events").insert({provider:"ASAAS",event_id:eventId,event_type:event,payload:body});
 if(logError?.code==="23505")return NextResponse.json({ok:true,duplicate:true});
 if(logError)return NextResponse.json({error:logError.message},{status:500});
 if(payment.id) {
  const paid=["PAYMENT_CONFIRMED","PAYMENT_RECEIVED","PAYMENT_CREDIT_CARD_CAPTURE_REFUSED"];
  const status=event==="PAYMENT_RECEIVED"?"RECEIVED":event==="PAYMENT_CONFIRMED"?"CONFIRMED":event==="PAYMENT_OVERDUE"?"OVERDUE":event.startsWith("PAYMENT_REFUNDED")?"REFUNDED":null;
  if(status) {
   const netValue=Number(payment.netValue??payment.value??0);
   const grossValue=Number(payment.value??0);
   const {data:charge}=await db.from("b2b_charges").select("supplier_net").eq("provider","ASAAS").eq("provider_charge_id",payment.id).maybeSingle();
   const supplierNet=Number(charge?.supplier_net||0);
   await db.from("b2b_charges").update({status,paid_at:status==="RECEIVED"?new Date().toISOString():null,gateway_fee:Math.max(0,grossValue-netValue),veyrion_net:status==="RECEIVED"?Math.max(0,netValue-supplierNet):0,provider_payload:body}).eq("provider","ASAAS").eq("provider_charge_id",payment.id);
  }\n  if(event==="PAYMENT_SPLIT_DONE")await db.from("b2b_charges").update({split_status:"DONE",provider_payload:body}).eq("provider","ASAAS").eq("provider_charge_id",payment.id);\n  if(["PAYMENT_SPLIT_DIVERGENCE_BLOCK","PAYMENT_SPLIT_DIVERGENCE_BLOCK_FINISHED"].includes(event))await db.from("b2b_charges").update({split_status:"FAILED",provider_payload:body}).eq("provider","ASAAS").eq("provider_charge_id",payment.id);
 }
 await db.from("b2b_integration_events").update({processed_at:new Date().toISOString()}).eq("provider","ASAAS").eq("event_id",eventId);
 return NextResponse.json({ok:true});
}
