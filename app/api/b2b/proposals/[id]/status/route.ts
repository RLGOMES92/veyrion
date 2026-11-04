import { NextRequest,NextResponse } from "next/server";
import { requireUser,jsonError } from "@/lib/b2b-server";
export async function PATCH(request:NextRequest,{params}:{params:Promise<{id:string}>}) {
 const auth=await requireUser(request); if(!auth)return jsonError("Sessão inválida.",401);
 const {id}=await params; const body=await request.json().catch(()=>({}));
 const status=String(body.status||"");
 if(!["SENT","NEGOTIATION","LOST","CANCELLED"].includes(status))return jsonError("Transição de status inválida.");
 const update:any={status};
 if(body.manual_override_reason){
  const {data:membership}=await auth.client.from("organization_members").select("role").eq("user_id",auth.user.id).maybeSingle();
  if(!membership || !["owner","admin","manager","finance"].includes(membership.role))return jsonError("Somente gestão ou financeiro pode autorizar exceção de crédito.",403);
  if(String(body.manual_override_reason).trim().length<10)return jsonError("Justificativa da exceção deve ter ao menos 10 caracteres.");
  update.manual_credit_override=true;update.manual_override_reason=String(body.manual_override_reason);update.approved_by=auth.user.id;update.approved_at=new Date().toISOString();}
 const {data,error}=await auth.client.from("b2b_proposals").update(update).eq("id",id).select().single();
 if(error)return jsonError(error.message,409);
 return NextResponse.json({proposal:data});
}
