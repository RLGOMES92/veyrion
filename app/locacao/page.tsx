import type { Metadata } from "next";
import LeadForm from "./lead-form";
import "./locacao.css";

export const metadata: Metadata = {
  title: "Locação de notebooks para empresas | VEYRION",
  description:
    "Locação e gestão de notebooks corporativos para empresas em expansão. Dimensione sua operação, preserve capital e receba uma proposta sob medida da VEYRION.",
  alternates: { canonical: "/locacao" },
  openGraph: {
    title: "Sua operação precisa de tecnologia. Não de imobilizar capital.",
    description:
      "Notebooks corporativos por locação, com planejamento, gestão e acompanhamento para sua empresa.",
    type: "website",
  },
};

const benefits = [
  { n: "01", title: "Capital preservado", text: "Direcione recursos para o crescimento do negócio em vez de concentrar investimento na compra de equipamentos." },
  { n: "02", title: "Parque sob medida", text: "Dimensione quantidade e configuração conforme o perfil da equipe, projeto ou unidade." },
  { n: "03", title: "Operação acompanhada", text: "Tenha visibilidade de equipamentos, contratos, prazos e necessidades ao longo da locação." },
];

const steps = [
  ["Entendemos a demanda", "Mapeamos quantidade, perfil de uso, localidade e prazo da sua operação."],
  ["Desenhamos a solução", "Estruturamos a configuração e o modelo comercial adequados ao cenário."],
  ["Formalizamos a proposta", "Você recebe escopo, condições e próximos passos com clareza."],
  ["Acompanhamos a jornada", "Apoiamos a gestão da locação e o relacionamento durante o contrato."],
];

export default function LocacaoPage() {
  return (
    <main className="vyr-site">
      <header className="vyr-nav">
        <a className="vyr-brand" href="/locacao" aria-label="VEYRION início">
          <span className="vyr-mark">V</span><span>VEYRION</span><small>TECHNOLOGY & ASSET SOLUTIONS</small>
        </a>
        <nav aria-label="Navegação principal">
          <a href="#solucao">A solução</a><a href="#segmentos">Para quem</a><a href="#processo">Como funciona</a>
        </nav>
        <a className="vyr-nav-cta" href="#diagnostico">Solicitar diagnóstico <span>↗</span></a>
      </header>

      <section className="vyr-hero">
        <div className="vyr-hero-copy">
          <div className="vyr-eyebrow"><i /> LOCAÇÃO CORPORATIVA DE NOTEBOOKS</div>
          <h1>Sua empresa cresce.<br/><em>Sua tecnologia acompanha.</em></h1>
          <p className="vyr-hero-lead">Equipamentos de TI para equipes e operações que precisam avançar — sem transformar cada expansão em um grande investimento de compra.</p>
          <div className="vyr-hero-actions">
            <a className="vyr-button primary" href="#diagnostico">Planejar minha locação <span>↗</span></a>
            <a className="vyr-text-link" href="#processo">Entenda como funciona <span>↓</span></a>
          </div>
          <div className="vyr-proof"><span className="vyr-proof-line" /><span>UMA ABORDAGEM CONSULTIVA PARA SUA OPERAÇÃO</span></div>
        </div>
        <div className="vyr-hero-visual" aria-label="Composição visual de notebooks corporativos">
          <div className="vyr-orbit orbit-one" /><div className="vyr-orbit orbit-two" />
          <div className="vyr-glow" />
          <div className="vyr-device-back"><div className="vyr-device-logo">V</div></div>
          <div className="vyr-device-base"><div className="vyr-keyboard" /></div>
          <div className="vyr-float-card"><span className="vyr-live-dot" /> VISÃO DE OPERAÇÃO <strong>Mais controle.<br/>Mais mobilidade.</strong><small>TECNOLOGIA ALINHADA AO NEGÓCIO</small></div>
          <div className="vyr-visual-caption">VEYRION <span>/</span> BUSINESS IT RENTAL</div>
        </div>
        <div className="vyr-hero-index"><span>01</span><span className="vyr-index-rule" /><span>TECNOLOGIA PARA ESCALAR</span></div>
      </section>

      <section className="vyr-strip">
        <span>LOCAR COM ESTRATÉGIA</span><b>✳</b><span>ESCALAR COM INTELIGÊNCIA</span><b>✳</b><span>GERIR COM VISIBILIDADE</span><b>✳</b><span>EVOLUIR COM CONTROLE</span>
      </section>

      <section className="vyr-section vyr-solution" id="solucao">
        <div className="vyr-section-intro">
          <div className="vyr-eyebrow">01 / A SOLUÇÃO</div>
          <h2>O equipamento é só o começo.<br/><em>A operação é o que importa.</em></h2>
        </div>
        <div className="vyr-solution-body">
          <p className="vyr-big-copy">Locação corporativa pensada para dar flexibilidade à infraestrutura de TI e previsibilidade ao crescimento da sua empresa.</p>
          <div className="vyr-benefits">{benefits.map((b) => <article className="vyr-benefit" key={b.n}><span>{b.n}</span><div><h3>{b.title}</h3><p>{b.text}</p></div><b>↗</b></article>)}</div>
        </div>
      </section>

      <section className="vyr-segments" id="segmentos">
        <div className="vyr-segments-head"><div><div className="vyr-eyebrow">02 / PARA QUEM</div><h2>Quando a operação<br/><em>não pode parar.</em></h2></div><p>Atendemos demandas corporativas que exigem escala, agilidade e padronização de equipamentos.</p></div>
        <div className="vyr-segment-grid">
          <article className="vyr-segment seg-wide"><span>01 — OPERAÇÕES EM ESCALA</span><h3>BPO &<br/>Contact centers</h3><p>Estruture estações de trabalho para equipes, campanhas e novas operações.</p><b>↗</b></article>
          <article className="vyr-segment seg-tech"><span>02 — CRESCIMENTO CONTÍNUO</span><h3>Tecnologia &<br/>consultoria</h3><p>Equipe projetos, squads e novas contratações com agilidade.</p><b>↗</b></article>
          <article className="vyr-segment seg-log"><span>03 — OPERAÇÃO DISTRIBUÍDA</span><h3>Logística &<br/>serviços</h3><p>Atenda unidades, equipes externas e estruturas em expansão.</p><b>↗</b></article>
          <article className="vyr-segment seg-health"><span>04 — AMBIENTES ESPECIALIZADOS</span><h3>Saúde &<br/>educação</h3><p>Planeje equipamentos para equipes, salas, laboratórios e unidades.</p><b>↗</b></article>
        </div>
      </section>

      <section className="vyr-process" id="processo">
        <div className="vyr-process-heading"><div className="vyr-eyebrow">03 / COMO FUNCIONA</div><h2>Da necessidade à solução.<br/><em>Sem complicar.</em></h2><p>Um processo consultivo, transparente e orientado ao que sua empresa realmente precisa.</p></div>
        <div className="vyr-steps">{steps.map((s, i) => <article className="vyr-step" key={s[0]}><span>0{i+1}</span><div><h3>{s[0]}</h3><p>{s[1]}</p></div><b>↗</b></article>)}</div>
      </section>

      <section className="vyr-diagnostic" id="diagnostico">
        <div className="vyr-diagnostic-copy"><div className="vyr-eyebrow"><i /> 04 / PRÓXIMO PASSO</div><h2>Vamos dimensionar<br/><em>o que sua empresa precisa?</em></h2><p>Conte um pouco sobre sua operação. Nossa equipe poderá entender o cenário e preparar o próximo passo comercial.</p><div className="vyr-diagnostic-note"><span>✓</span> Sem compromisso. Uma conversa objetiva sobre sua necessidade.</div></div>
        <LeadForm />
      </section>

      <footer className="vyr-footer"><a className="vyr-brand" href="#top"><span className="vyr-mark">V</span><span>VEYRION</span><small>TECHNOLOGY & ASSET SOLUTIONS</small></a><p>Locação corporativa. Gestão inteligente. Crescimento sustentável.</p><span>© {new Date().getFullYear()} VEYRION. TODOS OS DIREITOS RESERVADOS.</span></footer>
    </main>
  );
}
