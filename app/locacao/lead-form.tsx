"use client";

import { FormEvent, useState } from "react";

export default function LeadForm() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const whatsapp = (process.env.NEXT_PUBLIC_VEYRION_WHATSAPP || "").replace(/\D/g, "");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget);
    const fields = [
      "Olá! Quero avaliar uma solução de locação corporativa com a VEYRION.",
      "",
      `Nome: ${data.get("name")}`,
      `Empresa: ${data.get("company")}`,
      `Cargo: ${data.get("role") || "Não informado"}`,
      `E-mail: ${data.get("email")}`,
      `Cidade/UF: ${data.get("city")}`,
      `Quantidade estimada: ${data.get("quantity")}`,
      `Prazo: ${data.get("term")}`,
      `Necessidade: ${data.get("need") || "A avaliar"}`,
    ].join("\n");
    if (!whatsapp) {
      setError("O canal de WhatsApp comercial ainda precisa ser configurado. Envie os dados após a configuração de NEXT_PUBLIC_VEYRION_WHATSAPP na Vercel.");
      return;
    }
    setSent(true);
    window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(fields)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <form className="vyr-lead-form" onSubmit={submit}>
      <div className="vyr-form-title"><span>DIAGNÓSTICO COMERCIAL</span><small>LEVA MENOS DE 2 MINUTOS</small></div>
      <div className="vyr-form-grid">
        <label>Seu nome<input name="name" autoComplete="name" placeholder="Como podemos chamar você?" required /></label>
        <label>Empresa<input name="company" autoComplete="organization" placeholder="Nome da empresa" required /></label>
        <label>Cargo<input name="role" placeholder="Ex.: TI, Compras, Operações" /></label>
        <label>E-mail corporativo<input name="email" type="email" autoComplete="email" placeholder="voce@empresa.com.br" required /></label>
        <label>Cidade / Estado<input name="city" placeholder="Ex.: São Paulo / SP" required /></label>
        <label>Quantidade de notebooks<select name="quantity" defaultValue="" required><option value="" disabled>Selecione uma faixa</option><option>1 a 10</option><option>11 a 30</option><option>31 a 50</option><option>51 a 100</option><option>Mais de 100</option><option>Ainda preciso dimensionar</option></select></label>
        <label>Quando precisa?<select name="term" defaultValue="" required><option value="" disabled>Selecione o prazo</option><option>Imediatamente</option><option>Em até 30 dias</option><option>Em 1 a 3 meses</option><option>Em mais de 3 meses</option><option>Planejamento futuro</option></select></label>
        <label>O que sua operação precisa?<select name="need" defaultValue="Locação de notebooks"><option>Locação de notebooks</option><option>Expansão ou renovação do parque</option><option>Equipamentos para projeto temporário</option><option>Padronização de equipamentos</option><option>Quero orientação para dimensionar</option></select></label>
      </div>
      <button className="vyr-button primary vyr-submit" type="submit">Enviar solicitação <span>↗</span></button>
      {error && <p className="vyr-form-error" role="alert">{error}</p>}
      {sent && <p className="vyr-form-success" role="status">Solicitação preparada. Conclua o envio na conversa do WhatsApp que foi aberta.</p>}
      <small className="vyr-privacy">Ao enviar, você autoriza o contato da VEYRION para tratar desta solicitação comercial.</small>
    </form>
  );
}
