import { NextRequest,NextResponse } from "next/server";
import { requireUser,jsonError,getServiceClient } from "@/lib/b2b-server";

export async function POST(request:NextRequest) {
 const auth=await requireUser(request); if(!auth)return jsonError("Sessão inválida.",401);
 const {data:organizationId,error:organizationError}=await auth.client.rpc("current_user_organization_id");
 if(organizationError||!organizationId)return jsonError("Não foi possível identificar a organização ativa.",403);
 const {data:membership}=await auth.client.from("organization_members").select("organization_id,role").eq("user_id",auth.user.id).eq("organization_id",organizationId).maybeSingle();
 if(!membership||!["owner","admin","finance"].includes(membership.role))return jsonError("Somente proprietário, administrador ou financeiro pode ativar cobrança.",403);
 const body=await request.json().catch(()=>null); if(!body?.contract_id)return jsonError("Informe o contrato.");
 const apiKey=process.env.ASAAS_API_KEY;
 if(!apiKey)return NextResponse.json({status:"NOT_CONFIGURED",message:"Configure ASAAS_API_KEY. Nenhuma cobrança foi criada."},{status:409});
 let db;
 try { db=getServiceClient(); } catch { return jsonError("Configure SUPABASE_SERVICE_ROLE_KEY no ambiente do servidor.",503); }
 const {data:c,error}=await db.from("b2b_contracts").select("*,client:b2b_clients(*),supplier:b2b_suppliers(*),proposal:b2b_proposals(term_months)").eq("id",body.contract_id).eq("organization_id",membership.organization_id).single();
 if(error||!c)return jsonError("Contrato não encontrado nesta organização.");
 if(c.status!=="ACTIVE")return jsonError("Somente contratos ativos podem gerar assinatura recorrente.");
 if(c.billing_subscription_id)return NextResponse.json({error:"Este contrato já possui uma assinatura Asaas vinculada.",subscription_id:c.billing_subscription_id},{status:409});
 const walletId=c.supplier.asaas_wallet_id;
 if(!walletId)return jsonError("Fornecedor sem walletId Asaas. O split não pode ser ativado.",409);
 let customerId=c.client.asaas_customer_id;
 const base=process.env.ASAAS_API_URL||"https://api.asaas.com/v3";
 if(!customerId) {
  const customerResponse=await fetch(`${base}/customers`,{method:"POST",headers:{access_token:apiKey,"Content-Type":"application/json","User-Agent":"VEYRION-OS/1.0"},body:JSON.stringify({name:c.client.legal_name,cpfCnpj:c.client.cnpj,email:c.client.contact_email||undefined,phone:c.client.contact_phone||undefined,externalReference:c.client.id})});
  const customerPayload=await customerResponse.json().catch(()=>({}));
  if(!customerResponse.ok)return NextResponse.json({error:"Falha ao cadastrar cliente no Asaas.",details:customerPayload},{status:502});
  customerId=customerPayload.id;
  const {error:customerSaveError}=await db.from("b2b_clients").update({asaas_customer_id:customerId}).eq("id",c.client_id).eq("organization_id",membership.organization_id);
  if(customerSaveError)return jsonError("Cliente criado no Asaas, mas falhou ao salvar o vínculo: "+customerSaveError.message,500);
 }
 const billingType=["CREDIT_CARD","PIX","BOLETO"].includes(body.billing_type)?body.billing_type:"BOLETO";
 const response=await fetch(`${base}/subscriptions`,{method:"POST",headers:{access_token:apiKey,"Content-Type":"application/json","User-Agent":"VEYRION-OS/1.0"},body:JSON.stringify({
  customer:customerId,billingType,value:Number(c.recurring_amount),
  nextDueDate:body.next_due_date||new Date(Date.now()+86400000*7).toISOString().slice(0,10),
  cycle:"MONTHLY",description:`Locação TI VEYRION — contrato ${c.id}`,externalReference:c.id,
  maxPayments:Number(c.proposal?.term_months||36),
  split:[{walletId,fixedValue:Number(c.partner_amount),description:"Repasse parceiro técnico"}]
 })});
 const payload=await response.json().catch(()=>({}));
 if(!response.ok)return NextResponse.json({error:payload},{status:502});
 const {error:updateError}=await db.from("b2b_contracts").update({billing_provider:"ASAAS",billing_subscription_id:payload.id}).eq("id",c.id).eq("organization_id",membership.organization_id);
 if(updateError)return jsonError("Assinatura criada no Asaas, mas falhou ao salvar o vínculo: "+updateError.message,500);
 return NextResponse.json({subscription:payload,split:{supplier_wallet:walletId,supplier_fixed_value:c.partner_amount,veyrion_remainder:"Valor líquido restante após taxas e split"}});
}
