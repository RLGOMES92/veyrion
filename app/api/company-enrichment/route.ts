import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AnyRecord = Record<string, any>;

function first(...values: any[]) {
  return values.find((value) => value !== undefined && value !== null && String(value).trim() !== "");
}

function buildProspectingAssessment(input: {
  status: string; cnae: string; state: string; openingDate: string;
  website: string; email: string; phones: string[]; branches: unknown;
  employeesRange: unknown; size: string;
}) {
  const statusActive = /^(ATIVA|02)$/i.test(input.status.trim());
  const sectorLabels: Array<[RegExp, string]> = [
    [/tecnologia|software|informática|processamento de dados|desenvolvimento de programas|telecomunica/i, "Tecnologia"],
    [/call.?center|teleatendimento|telemarketing|bpo|serviços combinados de escritório/i, "BPO / Call center"],
    [/consultoria|consultores|gestão empresarial/i, "Consultoria"],
    [/logística|transporte|armazenamento|depósito|carga/i, "Logística"],
    [/saúde|hospital|clínica|médic|odontol|laboratório/i, "Saúde"],
    [/educação|ensino|escola|universidade|treinamento/i, "Educação"],
    [/indústria|fabricação|industrial|metalúrg|máquinas|equipamentos/i, "Indústria"],
    [/serviços financeiros|financeir|banco|crédito|seguros|contabilidade/i, "Serviços financeiros"],
  ];
  const matchedSector = sectorLabels.find(([pattern]) => pattern.test(input.cnae.toLowerCase()))?.[1] || "";
  const inSaoPaulo = input.state.toUpperCase() === "SP";
  const opened = input.openingDate ? new Date(input.openingDate + "T00:00:00Z") : null;
  const yearsActive = opened && !Number.isNaN(opened.getTime())
    ? Math.max(0, Math.floor((Date.now() - opened.getTime()) / 31557600000)) : null;
  const branchCount = Number(input.branches);
  const reasons: string[] = [];
  let score = 0;
  if (statusActive) { score += 20; reasons.push("Cadastro consta como ativo na consulta pública (+20)"); }
  if (matchedSector) { score += 25; reasons.push("Setor compatível com segmentos prioritários: " + matchedSector + " (+25)"); }
  if (inSaoPaulo) { score += 15; reasons.push("Empresa localizada em São Paulo (+15)"); }
  if (yearsActive !== null) { const points = yearsActive >= 5 ? 10 : yearsActive >= 2 ? 6 : 3; score += points; reasons.push("Tempo desde a abertura: " + yearsActive + " ano(s) (+" + points + ")"); }
  if (input.website) { score += 10; reasons.push("Site identificado (+10)"); }
  if (input.email) { score += 5; reasons.push("E-mail cadastral identificado (+5)"); }
  if (input.phones.length) { score += 5; reasons.push("Telefone cadastral identificado (+5)"); }
  if (Number.isFinite(branchCount) && branchCount > 1) { score += 5; reasons.push("Mais de um estabelecimento identificado (+5)"); }
  if (input.employeesRange || input.size) { score += 5; reasons.push("Informação de porte disponível (+5)"); }
  return {
    score, band: score >= 70 ? "A" : score >= 45 ? "B" : "C",
    matched_sector: matchedSector || null, years_active: yearsActive, reasons,
    explanation: "Índice heurístico de aderência comercial para priorizar pesquisa e contato. Não é avaliação de crédito, reputação, solvência ou idoneidade.",
    market_presence: {
      registry_active: statusActive, located_in_sao_paulo: inSaoPaulo,
      website_identified: Boolean(input.website), email_identified: Boolean(input.email),
      phone_identified: input.phones.length > 0,
      multiple_establishments: Number.isFinite(branchCount) && branchCount > 1,
      years_active: yearsActive,
    },
  };
}

function normalizeCompany(raw: AnyRecord, source: string) {
  const address = raw.endereco || raw.address || raw.estabelecimento || {};
  const status = raw.situacao_cadastral ?? raw.situacao;
  const size = raw.porte;
  const cnae = raw.cnae_principal || raw.atividade_principal || raw.cnae_fiscal || {};
  const phones = Array.isArray(raw.telefones)
    ? raw.telefones.map((phone: AnyRecord) => typeof phone === "string" ? phone : [phone.ddd, phone.numero].filter(Boolean).join(" ")).filter(Boolean)
    : [raw.ddd_telefone_1, raw.ddd_telefone_2, raw.telefone].filter(Boolean);

  const statusText = first(typeof status === "object" ? status.descricao : null, raw.descricao_situacao_cadastral, typeof status === "number" ? ({1:"NULA",2:"ATIVA",3:"SUSPENSA",4:"INAPTA",8:"BAIXADA"} as Record<number,string>)[status] : status, "");
  const name = first(raw.razao_social, raw.nome_empresarial, raw.nome, raw.name, "");
  const cnaeDescription = first(typeof cnae === "object" ? cnae.descricao : null, raw.cnae_fiscal_descricao, typeof raw.cnae_principal === "string" ? raw.cnae_principal : "");
  const cnaeCode = first(typeof cnae === "object" ? cnae.codigo : null, raw.cnae_fiscal, raw.codigo_cnae, "");
  const city = first(address.municipio, address.nome_municipio, raw.municipio, "");
  const state = first(address.uf, raw.uf, "");
  const branches = first(raw.quantidade_estabelecimentos, raw.total_estabelecimentos, raw.estabelecimentos_count, null);
  const sourceDate = first(raw.meta?.data_as_of, raw.data_atualizacao, raw.fonte?.base, raw.base, null);

  const prospecting = buildProspectingAssessment({
    status: String(statusText || ""), cnae: String(cnaeDescription || ""),
    state: String(state || ""),
    openingDate: String(first(raw.data_inicio_atividade, raw.data_abertura, raw.data_abertura_empresa, "") || ""),
    website: String(first(raw.site, raw.website, raw.sitio, "") || ""),
    email: String(first(raw.email, raw.email_estabelecimento, "") || ""),
    phones: phones.map(String), branches,
    employeesRange: first(raw.faixa_funcionarios?.faixa, raw.faixa_funcionarios, raw.funcionarios_faixa, raw.faixa_funcionarios_estimada, null),
    size: String(first(typeof size === "object" ? size.descricao : size, raw.porte_empresa, "") || ""),
  });

  return {
    cnpj: first(raw.cnpj, raw.ni, raw.documento, ""),
    name,
    trade_name: first(raw.nome_fantasia, raw.nomefantasia, raw.fantasia, ""),
    status: statusText,
    opening_date: first(raw.data_inicio_atividade, raw.data_abertura, raw.data_abertura_empresa, ""),
    size: first(typeof size === "object" ? size.descricao : size, raw.porte_empresa, ""),
    capital: first(raw.capital_social, raw.capitalSocial, null),
    cnae: cnaeDescription,
    cnae_code: cnaeCode,
    city,
    state,
    street: [address.logradouro || raw.logradouro, address.numero || raw.numero].filter(Boolean).join(", "),
    district: first(address.bairro, raw.bairro, ""),
    postal_code: first(address.cep, raw.cep, ""),
    email: first(raw.email, raw.email_estabelecimento, ""),
    website: first(raw.site, raw.website, raw.sitio, ""),
    phones,
    employees_range: first(raw.faixa_funcionarios?.faixa, raw.faixa_funcionarios, raw.funcionarios_faixa, raw.faixa_funcionarios_estimada, null),
    revenue_range: first(raw.faixa_faturamento?.faixa, raw.faixa_faturamento, raw.faixa_receita_estimada, null),
    qsa: Array.isArray(raw.qsa) ? raw.qsa : Array.isArray(raw.socios) ? raw.socios : Array.isArray(raw.quadro_societario) ? raw.quadro_societario : [],
    partners_count: Array.isArray(raw.socios) ? raw.socios.length : Array.isArray(raw.qsa) ? raw.qsa.length : null,
    branches_count: branches,
    source,
    source_date: sourceDate,
    source_note: source.includes("Fichário")
      ? "Dados abertos do CNPJ da Receita Federal. A base informa a competência no campo fonte/base; estimativas não equivalem a dados contábeis oficiais."
      : source.includes("CNPJ.IA")
        ? "Cadastro público da Receita Federal com enriquecimentos disponíveis no perfil consultado."
        : "Consulta cadastral pública da BrasilAPI; alguns campos complementares podem não estar disponíveis.",
    raw_status_code: typeof status === "object" ? status.codigo : status,
    special_status: first(raw.situacao_especial, raw.motivo_situacao, ""),
    has_website: Boolean(first(raw.has_website, raw.site, raw.website)),
    has_email: Boolean(first(raw.has_email, raw.email)),
    has_phone: Boolean(first(raw.has_phone, phones.length ? true : false)),
    registration_assessment: String(statusText).toUpperCase() === "ATIVA" || String(statusText) === "02"
      ? "Cadastro ativo na base consultada"
      : "Situação cadastral exige conferência",
    reputation_assessment: "Não certificada. Situação cadastral, porte e presença não comprovam crédito, solvência ou idoneidade.",
    prospecting_score: prospecting.score,
    prospecting_band: prospecting.band,
    prospecting_reasons: prospecting.reasons,
    prospecting_explanation: prospecting.explanation,
    market_presence: prospecting.market_presence,
    matched_priority_sector: prospecting.matched_sector,
    years_active: prospecting.years_active,
    public_data: raw,
  };
}

async function providerFetch(url: string, apiKey?: string) {
  const response = await fetch(url, {
    headers: apiKey ? { Authorization: `Bearer ${apiKey}`, Accept: "application/json" } : { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = body?.message || body?.error || `Serviço externo respondeu HTTP ${response.status}.`;
    throw new Error(String(message));
  }
  return body;
}

function extractResults(body: AnyRecord): AnyRecord[] {
  const candidates = [body?.data, body?.results, body?.resultados, body?.empresas, body?.items, body?.resultado];
  for (const value of candidates) {
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.results)) return value.results;
    if (Array.isArray(value?.empresas)) return value.empresas;
  }
  return Array.isArray(body) ? body : body?.cnpj || body?.ni ? [body] : [];
}

async function lookupByNameFree(q: string) {
  const url = new URL("https://cnpj.genesisinnovation.io/api/v1/busca");
  url.searchParams.set("q", q);
  return providerFetch(url.toString());
}

async function lookupCnpjFree(cnpj: string) {
  const body = await providerFetch(`https://cnpj.genesisinnovation.io/api/v1/cnpj/${encodeURIComponent(cnpj)}`);
  return body?.data || body;
}

export async function GET(request: NextRequest) {
  const q = String(request.nextUrl.searchParams.get("q") || "").trim();
  const details = request.nextUrl.searchParams.get("details") === "true";
  if (q.length < 3) return NextResponse.json({ error: "Informe ao menos 3 caracteres ou um CNPJ completo." }, { status: 400 });

  const apiKey = process.env.CNPJIA_KEY;
  const digits = q.replace(/\D/g, "");
  const looksLikeCnpj = digits.length === 14;

  try {
    if (looksLikeCnpj) {
      if (apiKey) {
        const profile = details ? "full" : "basic";
        const body = await providerFetch(`https://api.cnpj.ia.br/v1/cnpjs/${encodeURIComponent(q)}?profile=${profile}`, apiKey);
        const raw = body?.data || body;
        return NextResponse.json({
          results: [normalizeCompany({ ...raw, meta: body?.meta }, "Receita Federal via CNPJ.IA")],
          meta: body?.meta || null,
          mode: "cnpj",
        });
      }
      try {
        const body = details ? await lookupCnpjFree(digits) : await providerFetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
        return NextResponse.json({
          results: [normalizeCompany(body, details ? "Fichário / dados abertos do CNPJ" : "BrasilAPI / dados públicos de CNPJ")],
          meta: { data_as_of: body?.fonte?.base || null, credits_charged: 0 },
          mode: "cnpj",
        });
      } catch {
        const body = await providerFetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
        return NextResponse.json({
          results: [normalizeCompany(body, "BrasilAPI / dados públicos de CNPJ")],
          meta: { data_as_of: null, credits_charged: 0 },
          mode: "cnpj",
        });
      }
    }

    if (apiKey) {
      const url = new URL("https://api.cnpj.ia.br/v1/cnpjs");
      url.searchParams.set("nome", q);
      url.searchParams.set("situacao", "ATIVA");
      const body = await providerFetch(url.toString(), apiKey);
      const results = extractResults(body).map((item) => normalizeCompany({ ...item, meta: body?.meta }, "Receita Federal via CNPJ.IA"));
      return NextResponse.json({ results, meta: body?.meta || null, mode: "name" });
    }

    const body = await lookupByNameFree(q);
    const results = extractResults(body).map((item) => normalizeCompany({ ...item, fonte: item.fonte || body?.fonte }, "Fichário / dados abertos do CNPJ"));
    return NextResponse.json({
      results,
      meta: { data_as_of: body?.fonte?.base || body?.base || null, credits_charged: 0, provider: "Fichário" },
      mode: "name",
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Não foi possível consultar a base empresarial agora.",
      setup_required: false,
    }, { status: 502 });
  }
}
