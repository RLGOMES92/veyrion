"use client";

import { FormEvent, useState } from "react";

export default function LeadForm() {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const whatsapp = (process.env.NEXT_PUBLIC_VEYRION_WHATSAPP || "").replace(/\D/g, "");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    setSending(true);
    setError("");
    const form = event.currentTarget;
    const data = new FormData(form);
    const lead = {
      name: String(data.get("name") || ""),
      company: String(data.get("company") || ""),
      role: String(data.get("role") || ""),
      email: String(data.get("email") || ""),
      city: String(data.get("city") || ""),
      quantity: String(data.get("quantity") || ""),
      term: String(data.get("term") || ""),
      need: String(data.get("need") || ""),
      website: String(data.get("website") || ""),
    };

    try {
      const response = await fetch("/api/public-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lead),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível registrar sua solicitação.");

      setSent(true);
      const message = [
        "Olá! Acabei de enviar uma solicitação pelo site da VEYRION.",
        "",
        `Nome: \${lead.name}`,
        `Empresa: \${lead.company}`,
        `Cargo: \${lead.role || "Não informado"}`,
        `E-mail: \${lead.email}`,
        `Cidade/UF: \${lead.city}`,
        `Quantidade estimada: \${lead.quantity}`,
        `Prazo: \${lead.term}`,
        `Necessidade: \${lead.need || "A avaliar"}`,
      ].join("\n");
      if (whatsapp) {
        window.open(`https://wa.me/\${whatsapp}?text=\${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
      }
      form.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar. Tente novamente ou fale pelo WhatsApp.");
    } finally {
      setSending(false);
    }
  }

  return (
    <form className="vyr-lead-form" onSubmit={submit}>
      <div className="vyr-form-title"><span>DIAGNÓSTICO COMERCIAL</span><small>LEVA MENOS DE 2 MINUTOS</small></div>
      <div className="vyr-form-grid">
        <label>Seu nome<input name="name" autoComplete="name" placeholder="Como podemos chamar você?" required maxLength={120} /></label>
        <label>Empresa<input name="company" autoComplete="organization" placeholder="Nome da empresa" required maxLength={180} /></label>
        <label>Cargo<input name="role" placeholder="Ex.: TI, Compras, Operações" maxLength={120} /></label>
        <label>E-mail corporativo<input name="email" type="email" autoComplete="email" placeholder="voce@empresa.com.br" required maxLength={254} /></label>
        <label>Cidade / Estado<input name="city" placeholder="Ex.: São Paulo / SP" required maxLength={140} /></label>
        <label>Quantidade de notebooks<select name="quantity" defaultValue="" required><option value="" disabled>Selecione uma faixa</option><option>1 a 10</option><option>11 a 30</option><option>31 a 50</option><option>51 a 100</option><option>Mais de 100</option><option>Ainda preciso dimensionar</option></select></label>
        <label>Quando precisa?<select name="term" defaultValue="" required><option value="" disabled>Selecione o prazo</option><option>Imediatamente</option><option>Em até 30 dias</option><option>Em 1 a 3 meses</option><option>Em mais de 3 meses</option><option>Planejamento futuro</option></select></label>
        <label>O que sua operação precisa?<select name="need" defaultValue="Locação de notebooks"><option>Locação de notebooks</option><option>Expansão ou renovação do parque</option><option>Equipamentos para projeto temporário</option><option>Padronização de equipamentos</option><option>Quero orientação para dimensionar</option></select></label>
      </div>
      <label className="vyr-honeypot" aria-hidden="true">Não preencher<input name="website" tabIndex={-1} autoComplete="off" /></label>
      <button className="vyr-button primary vyr-submit" type="submit" disabled={sending}>{sending ? "Enviando..." : sent ? "Enviar outra solicitação" : "Enviar solicitação"} <span>↗</span></button>
      {error && <p className="vyr-form-error" role="alert">{error}</p>}
      {sent && <p className="vyr-form-success" role="status">Solicitação registrada! Nossa equipe poderá dar continuidade pelo WhatsApp. Se a conversa não abriu, fale conosco pelo botão de contato.</p>}
      <small className="vyr-privacy">Ao enviar, você autoriza o contato da VEYRION para tratar desta solicitação comercial.</small>
    </form>
  );
}
