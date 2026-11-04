import { NextRequest,NextResponse } from "next/server";
import { requireUser,jsonError } from "@/lib/b2b-server";
export async function PATCH(request:NextRequest,{params}:{params:Promise<{id:string}>}) {
 const auth=await requireUser(request); if(!auth)return jsonError("Sessão inválida.",401);
 const {id}=await params; const body=await request.json().catch(()=>({}));
 const status=String(body.status||"");
 if(!["CREDIT_REVIEW","SENT","NEGOTIATION","LOST","CANCELLED"].includes(status))return jsonError("Transição de status inválida.");
 const update:any={status};
 if(body.manual_override_reason){
  const {data:memberships}=await auth.client.from("organization_members").select("organization_id,role,created_at").eq("user_id",auth.user.id).order("created_at",{ascending:true}).limit(100);
  const membership=(memberships||[]).sort((a,b)=>({owner:0,admin:1}[a.role]??2)-({owner:0,admin:1}[b.role]??2))[0];
  if(!membership || !["owner","admin","manager","finance"].includes(membership.role))return jsonError("Somente gestão ou financeiro pode autorizar exceção de crédito.",403);
  if(String(body.manual_override_reason).trim().length<10)return jsonError("Justificativa da exceção deve ter ao menos 10 caracteres.");
  update.manual_credit_override=true;update.manual_override_reason=String(body.manual_override_reason);update.approved_by=auth.user.id;update.approved_at=new Date().toISOString();}
 const {data,error}=await auth.client.from("b2b_proposals").update(update).eq("id",id).select().single();
 if(error)return jsonError(error.message,409);
 return NextResponse.json({proposal:data});
}
