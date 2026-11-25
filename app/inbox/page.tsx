"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Inquiry = {
  id: string; organization_id: string; name: string; company: string; role: string;
  email: string; city: string; quantity: string; term: string; need: string;
  source: string; status: string; created_at: string; assigned_to: string | null;
  follow_up_at: string | null; internal_notes: string; updated_at: string;
};
type Member = { user_id: string; role: string };

const statusLabels: Record<string,string> = {
  novo: "Novo", em_atendimento: "Em atendimento", qualificado: "Qualificado",
  proposta: "Proposta", convertido: "Convertido", perdido: "Perdido"
};
const statusTone: Record<string,string> = {
  novo: "new", em_atendimento: "active", qualificado: "qualified",
  proposta: "proposal", convertido: "won", perdido: "lost"
};

export default function LeadInboxPage() {
  const [items,setItems] = useState<Inquiry[]>([]);
  const [members,setMembers] = useState<Member[]>([]);
  const [userId,setUserId] = useState("");
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const [filter,setFilter] = useState("todos");
  const [search,setSearch] = useState("");
  const [selected,setSelected] = useState<Inquiry|null>(null);
  const [saving,setSaving] = useState(false);
  const [message,setMessage] = useState("");

  const load = useCallback(async () => {
    if (!supabase) { setError("Supabase não está configurado neste ambiente."); setLoading(false); return; }
    setLoading(true); setError("");
    const {data:{session}} = await supabase.auth.getSession();
    if (!session?.user) { window.location.href = "/"; return; }
    setUserId(session.user.id);
    const {data:leadData,error:leadError} = await supabase.from("public_lead_inquiries")
      .select("id,organization_id,name,company,role,email,city,quantity,term,need,source,status,created_at,assigned_to,follow_up_at,internal_notes,updated_at")
      .order("created_at",{ascending:false}).limit(500);
    if (leadError) setError("Não foi possível carregar os pedidos. Confirme a migration 008 e suas permissões. " + leadError.message);
    else setItems((leadData||[]) as Inquiry[]);
    const {data:orgId} = await supabase.rpc("current_user_organization_id");
    if (orgId) {
      const {data:team} = await supabase.from("organization_members").select("user_id,role").eq("organization_id",orgId);
      setMembers((team||[]) as Member[]);
    }
    setLoading(false);
  },[]);

  useEffect(()=>{ void load(); },[load]);

  const filtered = useMemo(()=>items.filter(item => {
    const matchesStatus = filter==="todos" || item.status===filter;
    const haystack = [item.name,item.company,item.email,item.city,item.quantity,item.need].join(" ").toLowerCase();
    return matchesStatus && haystack.includes(search.toLowerCase());
  }),[items,filter,search]);

  async function update(item: Inquiry, patch: Partial<Inquiry>) {
    if (!supabase) return;
    setSaving(true); setMessage(""); setError("");
    const {data,error:updateError} = await supabase.from("public_lead_inquiries")
      .update({...patch,updated_at:new Date().toISOString()}).eq("id",item.id)
      .select("id,organization_id,name,company,role,email,city,quantity,term,need,source,status,created_at,assigned_to,follow_up_at,internal_notes,updated_at").single();
    if (updateError) setError("Não foi possível salvar. Verifique se a migration 008 foi aplicada e se seu perfil tem permissão. " + updateError.message);
    else {
      setItems(current=>current.map(x=>x.id===item.id?data as Inquiry:x));
      setSelected(data as Inquiry);
      setMessage("Acompanhamento atualizado.");
    }
    setSaving(false);
  }

  const count = (status:string) => items.filter(x=>x.status===status).length;

  return <main className="inbox-shell">
    <style jsx global>{`
      .inbox-shell{min-height:100vh;background:#07111c;color:#edf3f8;padding:32px clamp(16px,4vw,56px);font-family:Arial,sans-serif}
      .inbox-wrap{max-width:1440px;margin:auto}.inbox-top{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:26px}
      .inbox-brand{font-size:12px;letter-spacing:3px;color:#b6f36b;font-weight:800}.inbox-top h1{font-size:clamp(28px,4vw,42px);margin:8px 0}.inbox-muted{color:#91a2b2;font-size:13px}
      .inbox-btn{border:1px solid #304355;background:#102131;color:#edf3f8;border-radius:8px;padding:11px 15px;cursor:pointer;text-decoration:none;font-size:13px}
      .inbox-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:20px}
      .inbox-stat,.inbox-panel{background:#0d1b29;border:1px solid #203447;border-radius:12px;padding:18px}
      .inbox-stat span{display:block;color:#91a2b2;font-size:12px}.inbox-stat strong{display:block;font-size:27px;margin-top:8px}
      .inbox-toolbar{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px}.inbox-toolbar input,.inbox-toolbar select{background:#091622;border:1px solid #304355;color:#edf3f8;border-radius:8px;padding:12px;min-width:190px}
      .inbox-layout{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(280px,.8fr);gap:16px;align-items:start}
      .inbox-list{display:grid;gap:9px}.inbox-row{width:100%;text-align:left;background:#0a1723;color:inherit;border:1px solid #263b4d;border-radius:10px;padding:15px;cursor:pointer}
      .inbox-row.selected{border-color:#b6f36b}.inbox-row-head{display:flex;justify-content:space-between;gap:12px;align-items:start}.inbox-row strong{font-size:15px}.inbox-row p{margin:7px 0 0;color:#91a2b2;font-size:12px;line-height:1.5}
      .inbox-pill{display:inline-block;padding:5px 8px;border-radius:30px;font-size:10px;font-weight:700;background:#1b2b39;color:#c7d5e0;white-space:nowrap}
      .inbox-pill.new{color:#f5d58a}.inbox-pill.active{color:#83c6e8}.inbox-pill.qualified{color:#b6f36b}.inbox-pill.proposal{color:#d5b7ff}.inbox-pill.won{color:#b6f36b}.inbox-pill.lost{color:#f39a9a}
      .inbox-detail h2{font-size:20px;margin:0 0 6px}.inbox-detail label{display:grid;gap:6px;color:#9aabba;font-size:11px;margin-top:15px}
      .inbox-detail input,.inbox-detail select,.inbox-detail textarea{width:100%;background:#091622;border:1px solid #304355;border-radius:7px;color:#edf3f8;padding:10px;font:13px Arial}
      .inbox-detail textarea{min-height:90px;resize:vertical}.inbox-kv{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:18px}.inbox-kv div{min-width:0}.inbox-kv span{display:block;color:#8396a7;font-size:10px;margin-bottom:5px}.inbox-kv strong{font-size:12px;overflow-wrap:anywhere}
      .inbox-alert{background:#2b2417;border:1px solid #6a522a;color:#f5d58a;padding:12px;border-radius:8px;margin:14px 0;font-size:12px}.inbox-empty{padding:36px;text-align:center;color:#91a2b2}
      @media(max-width:850px){.inbox-layout{grid-template-columns:1fr}.inbox-stats{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:480px){.inbox-shell{padding:22px 12px}.inbox-kv{grid-template-columns:1fr}.inbox-top .inbox-btn{width:100%;text-align:center}}
    `}</style>
    <div className="inbox-wrap">
      <div className="inbox-top"><div><div className="inbox-brand">VEYRION / SALES INTELLIGENCE</div><h1>Inbox de solicitações</h1><div className="inbox-muted">Pedidos recebidos pela página de locação. Acesso restrito à equipe autenticada.</div></div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><a className="inbox-btn" href="/">Voltar ao CRM</a><button className="inbox-btn" onClick={()=>void load()}>Atualizar</button></div></div>
      <div className="inbox-stats">
        <div className="inbox-stat"><span>Solicitações recebidas</span><strong>{items.length}</strong></div>
        <div className="inbox-stat"><span>Novas</span><strong>{count("novo")}</strong></div>
        <div className="inbox-stat"><span>Em atendimento</span><strong>{count("em_atendimento")}</strong></div>
        <div className="inbox-stat"><span>Qualificadas / proposta</span><strong>{count("qualificado")+count("proposta")}</strong></div>
      </div>
      {error&&<div className="inbox-alert">{error}</div>}{message&&<div className="inbox-alert">{message}</div>}
      <div className="inbox-toolbar"><input aria-label="Buscar solicitação" placeholder="Buscar empresa, contato ou cidade..." value={search} onChange={e=>setSearch(e.target.value)}/><select aria-label="Filtrar status" value={filter} onChange={e=>setFilter(e.target.value)}><option value="todos">Todos os status</option>{Object.entries(statusLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></div>
      <div className="inbox-layout">
        <section className="inbox-panel"><div className="inbox-list">{loading?<div className="inbox-empty">Carregando solicitações…</div>:filtered.length===0?<div className="inbox-empty">Nenhuma solicitação encontrada.</div>:filtered.map(item=><button key={item.id} className={"inbox-row"+(selected?.id===item.id?" selected":"")} onClick={()=>{setSelected(item);setMessage("");}}><div className="inbox-row-head"><strong>{item.company}</strong><span className={"inbox-pill "+(statusTone[item.status]||"")}>{statusLabels[item.status]||item.status}</span></div><p>{item.name} · {item.city}</p><p>{item.quantity} notebooks · {item.term} · {new Date(item.created_at).toLocaleString("pt-BR")}</p></button>)}</div></section>
        <aside className="inbox-panel inbox-detail">{selected?<><h2>{selected.company}</h2><div className="inbox-muted">{selected.name} · {selected.role||"Cargo não informado"}</div><div className="inbox-kv"><div><span>E-mail</span><strong>{selected.email}</strong></div><div><span>Cidade</span><strong>{selected.city}</strong></div><div><span>Quantidade</span><strong>{selected.quantity}</strong></div><div><span>Prazo</span><strong>{selected.term}</strong></div><div><span>Necessidade</span><strong>{selected.need||"Não informado"}</strong></div><div><span>Recebido em</span><strong>{new Date(selected.created_at).toLocaleString("pt-BR")}</strong></div></div>
          <label>Status comercial<select value={selected.status} disabled={saving} onChange={e=>void update(selected,{status:e.target.value})}>{Object.entries(statusLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
          <label>Responsável<select value={selected.assigned_to||""} disabled={saving} onChange={e=>void update(selected,{assigned_to:e.target.value||null})}><option value="">Sem responsável</option>{members.map(member=><option key={member.user_id} value={member.user_id}>{member.user_id===userId?"Eu":member.user_id.slice(0,8)+"…"} · {member.role}</option>)}</select></label>
          <label>Próximo follow-up<input type="date" value={selected.follow_up_at||""} disabled={saving} onChange={e=>void update(selected,{follow_up_at:e.target.value||null})}/></label>
          <label>Notas internas<textarea defaultValue={selected.internal_notes||""} key={selected.id} onBlur={e=>{if(e.target.value!==selected.internal_notes)void update(selected,{internal_notes:e.target.value})}} disabled={saving} placeholder="Registre o contexto da negociação..."/></label>
          <p className="inbox-muted">Origem: {selected.source} · Atualizado: {selected.updated_at?new Date(selected.updated_at).toLocaleString("pt-BR"):"—"}</p>
        </>:<div className="inbox-empty">Selecione uma solicitação para ver os detalhes e atualizar o acompanhamento.</div>}</aside>
      </div>
    </div>
  </main>;
}
