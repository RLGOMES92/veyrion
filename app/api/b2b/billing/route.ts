import { NextRequest,NextResponse } from "next/server";
import { requireUser,jsonError } from "@/lib/b2b-server";

export async function POST(request:NextRequest) {
 const auth=await requireUser(request); if(!auth)return jsonError("Sessão inválida.",401);
 const body=await request.json().catch(()=>null); if(!body?.contract_id)return jsonError("Informe o contrato.");
 const {data:c,error}=await auth.client.from("b2b_contracts").select("*,client:b2b_clients(*),supplier:b2b_suppliers(*)").eq("id",body.contract_id).single();
 if(error||!c)return jsonError("Contrato não encontrado.");
 if(c.status!=="ACTIVE")return jsonError("Somente contratos ativos podem gerar assinatura recorrente.");
 const apiKey=process.env.ASAAS_API_KEY;
 if(!apiKey)return NextResponse.json({status:"NOT_CONFIGURED",message:"Configure ASAAS_API_KEY. Nenhuma cobrança foi criada."},{status:409});
 const customerId=c.client.asaas_customer_id;
 if(!customerId)return jsonError("Cliente ainda não possui customerId no Asaas.",409);
 const walletId=c.supplier.asaas_wallet_id;
 if(!walletId)return jsonError("Fornecedor sem walletId Asaas. O split não pode ser ativado.",409);
 const billingType=body.billing_type==="CREDIT_CARD"?"CREDIT_CARD":"BOLETO";
 const base=process.env.ASAAS_API_URL||"https://api.asaas.com/v3";
 const response=await fetch(`${base}/subscriptions`,{method:"POST",headers:{access_token:apiKey,"Content-Type":"application/json","User-Agent":"VEYRION-OS/1.0"},body:JSON.stringify({customer:customerId,billingType,value:Number(c.recurring_amount),nextDueDate:body.next_due_date||new Date(Date.now()+86400000*7).toISOString().slice(0,10),cycle:"MONTHLY",description:`Locação TI VEYRION — contrato ${c.id}`,externalReference:c.id,split:[{walletId,fixedValue:Number(c.partner_amount),description:"Repasse parceiro técnico"}]})});
 const payload=await response.json().catch(()=>({}));
 if(!response.ok)return NextResponse.json({error:payload},{status:502});
 const {error:updateError}=await auth.client.from("b2b_contracts").update({billing_provider:"ASAAS",billing_subscription_id:payload.id}).eq("id",c.id);
 if(updateError)return jsonError("Assinatura criada no Asaas, mas falhou ao salvar o vínculo: "+updateError.message,500);
 return NextResponse.json({subscription:payload,split:{supplier_wallet:walletId,supplier_fixed_value:c.partner_amount,veyrion_remainder:"Valor líquido restante após taxas e split"}});
}
