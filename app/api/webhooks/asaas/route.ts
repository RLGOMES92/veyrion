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
  if(status)await db.from("b2b_charges").update({status,paid_at:status==="RECEIVED"?new Date().toISOString():null,provider_payload:body}).eq("provider","ASAAS").eq("provider_charge_id",payment.id);
 }
 await db.from("b2b_integration_events").update({processed_at:new Date().toISOString()}).eq("provider","ASAAS").eq("event_id",eventId);
 return NextResponse.json({ok:true});
}
