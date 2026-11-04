import { NextRequest,NextResponse } from "next/server";
import { requireUser,jsonError } from "@/lib/b2b-server";
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}) {
 const auth=await requireUser(request); if(!auth)return jsonError("Sessão inválida.",401);
 const {id}=await params;
 const {data,error}=await auth.client.from("b2b_contracts").select("id,contract_html").eq("id",id).single();
 if(error||!data)return jsonError("Contrato não encontrado.",404);
 return new NextResponse(data.contract_html||"<p>Minuta ainda não foi gerada.</p>",{headers:{"Content-Type":"text/html; charset=utf-8","Content-Security-Policy":"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'","X-Content-Type-Options":"nosniff"}});
}
