"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import "./leads.css";

type Lead = {
  id: string; name: string; company: string; role: string; email: string; city: string;
  quantity: string; term: string; need: string; source: string; status: string; created_at: string;
};

export default function LeadsInboxPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  async function loadLeads() {
    setLoading(true);
    setError("");
    try {
      if (!supabase) throw new Error("Supabase não está configurado neste ambiente.");
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw new Error("Não foi possível validar sua sessão.");
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Entre no VEYRION OS para acessar os leads recebidos.");
      const response = await fetch("/api/public-leads", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Falha ao carregar os leads.");
      setLeads(Array.isArray(result.leads) ? result.leads : []);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar os leads.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadLeads(); }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    if (!term) return leads;
    return leads.filter((lead) => [lead.name, lead.company, lead.email, lead.city, lead.role, lead.quantity, lead.term, lead.need]
      .some((value) => String(value || "").toLocaleLowerCase("pt-BR").includes(term)));
  }, [leads, query]);

  const formatDate = (value: string) => new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short", timeStyle: "short",
  });

  return (
    <div className="lead-inbox-shell">
      <header className="lead-inbox-top">
        <a className="lead-inbox-brand" href="/">VEYRION <span>OS</span></a>
        <a href="/" className="lead-inbox-back">← Voltar ao CRM</a>
      </header>
      <main className="lead-inbox-main">
        <div className="lead-inbox-heading">
          <div>
            <p className="lead-inbox-eyebrow">CAPTAÇÃO COMERCIAL / SITE</p>
            <h1>Leads recebidos</h1>
            <p className="lead-inbox-sub">Solicitações enviadas pelo formulário de locação corporativa.</p>
          </div>
          <button className="lead-inbox-refresh" onClick={() => void loadLeads()} disabled={loading}>
            {loading ? "Atualizando…" : "↻ Atualizar"}
          </button>
        </div>
        <div className="lead-inbox-stats">
          <article><span>Total carregado</span><strong>{loading ? "—" : leads.length}</strong></article>
          <article><span>Novos</span><strong>{loading ? "—" : leads.filter(l => l.status === "novo").length}</strong></article>
          <article><span>Com prazo imediato / 30 dias</span><strong>{loading ? "—" : leads.filter(l => /imediatamente|30 dias/i.test(l.term)).length}</strong></article>
        </div>
        <div className="lead-inbox-toolbar">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por empresa, nome, cidade ou e-mail…" aria-label="Buscar leads" />
          <span>{filtered.length} {filtered.length === 1 ? "resultado" : "resultados"}{lastUpdated ? ` · Atualizado ${lastUpdated.toLocaleTimeString("pt-BR", {hour:"2-digit",minute:"2-digit"})}` : ""}</span>
        </div>
        {error && <div className="lead-inbox-error" role="alert">{error}<a href="/"> Acessar login / CRM</a></div>}
        {loading && <div className="lead-inbox-empty">Carregando solicitações…</div>}
        {!loading && !error && filtered.length === 0 && <div className="lead-inbox-empty">{leads.length ? "Nenhum lead corresponde à busca." : "Ainda não recebemos solicitações pelo site."}</div>}
        {!loading && !error && filtered.length > 0 && <div className="lead-inbox-list">
          {filtered.map((lead) => (
            <article className="lead-inbox-card" key={lead.id}>
              <div className="lead-inbox-card-top">
                <div><h2>{lead.company}</h2><p>{lead.name}{lead.role ? ` · ${lead.role}` : ""}</p></div>
                <span className={lead.status === "novo" ? "lead-status new" : "lead-status"}>{lead.status || "novo"}</span>
              </div>
              <div className="lead-inbox-details">
                <span>📍 {lead.city || "Local não informado"}</span>
                <span>💻 {lead.quantity || "Volume não informado"}</span>
                <span>⏱ {lead.term || "Prazo não informado"}</span>
              </div>
              {lead.need && <p className="lead-inbox-need">{lead.need}</p>}
              <div className="lead-inbox-card-footer">
                <a href={`mailto:${encodeURIComponent(lead.email)}?subject=${encodeURIComponent("Locação corporativa de notebooks — VEYRION")}`}>✉ {lead.email}</a>
                <time dateTime={lead.created_at}>{formatDate(lead.created_at)}</time>
              </div>
            </article>
          ))}
        </div>}
        <p className="lead-inbox-privacy">A caixa exibe apenas leads da organização VEYRION e está disponível para perfis comerciais autorizados. Esta tela não altera nem exporta os dados.</p>
      </main>
    </div>
  );
}
