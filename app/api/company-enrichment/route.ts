import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AnyRecord = Record<string, any>;

function first(...values: any[]) {
  return values.find((value) => value !== undefined && value !== null && String(value).trim() !== "");
}

function normalizeCompany(raw: AnyRecord, source: string) {
  const address = raw.endereco || raw.address || {};
  const status = raw.situacao_cadastral;
  const size = raw.porte;
  const cnae = raw.cnae_principal || raw.atividade_principal || {};
  const phones = Array.isArray(raw.telefones)
    ? raw.telefones.map((phone: AnyRecord) => [phone.ddd, phone.numero].filter(Boolean).join(" ")).filter(Boolean)
    : [raw.ddd_telefone_1, raw.ddd_telefone_2].filter(Boolean);

  return {
    cnpj: first(raw.cnpj, raw.ni, ""),
    name: first(raw.razao_social, raw.nome_empresarial, raw.name, ""),
    trade_name: first(raw.nome_fantasia, raw.nomefantasia, ""),
    status: first(typeof status === "object" ? status.descricao : null, raw.descricao_situacao_cadastral, typeof status === "number" ? ({1:"NULA",2:"ATIVA",3:"SUSPENSA",4:"INAPTA",8:"BAIXADA"} as Record<number,string>)[status] : status, ""),
    opening_date: first(raw.data_inicio_atividade, raw.data_abertura, ""),
    size: first(typeof size === "object" ? size.descricao : size, raw.porte, ""),
    capital: first(raw.capital_social, raw.capitalSocial, null),
    cnae: first(cnae.descricao, raw.cnae_fiscal_descricao, ""),
    cnae_code: first(cnae.codigo, raw.cnae_fiscal, ""),
    city: first(address.municipio, raw.municipio, ""),
    state: first(address.uf, raw.uf, ""),
    street: [address.logradouro || raw.logradouro, address.numero || raw.numero].filter(Boolean).join(", "),
    district: first(address.bairro, raw.bairro, ""),
    postal_code: first(address.cep, raw.cep, ""),
    email: first(raw.email, ""),
    website: first(raw.site, raw.website, raw.sitio, ""),
    phones,
    employees_range: first(raw.faixa_funcionarios?.faixa, raw.faixa_funcionarios, raw.funcionarios_faixa, null),
    revenue_range: first(raw.faixa_faturamento?.faixa, raw.faixa_faturamento, null),
    partners_count: Array.isArray(raw.socios) ? raw.socios.length : null,
    branches_count: first(raw.quantidade_estabelecimentos, raw.total_estabelecimentos, null),
    source,
    source_date: first(raw.meta?.data_as_of, raw.data_atualizacao, null),
    source_note: source === "Receita Federal via CNPJ.IA"
      ? "Cadastro público da Receita Federal com enriquecimentos disponíveis no perfil consultado."
      : "Consulta cadastral pública da BrasilAPI; alguns campos complementares podem não estar disponíveis.",
    raw_status_code: typeof status === "object" ? status.codigo : raw.situacao_cadastral,
    special_status: first(raw.situacao_especial, ""),
    has_website: Boolean(first(raw.has_website, raw.site, raw.website)),
    has_email: Boolean(first(raw.has_email, raw.email)),
    has_phone: Boolean(first(raw.has_phone, phones.length ? true : false)),
    registration_assessment: first(typeof status === "object" ? status.descricao : null, raw.descricao_situacao_cadastral, "") === "ATIVA" ? "Cadastro ativo na base consultada" : "Situação cadastral exige conferência",
    reputation_assessment: "Não consultada. Exige análise adicional em fontes públicas, reclamações e bases de crédito autorizadas.",
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
      const body = await providerFetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
      return NextResponse.json({
        results: [normalizeCompany(body, "BrasilAPI / dados públicos de CNPJ")],
        meta: { data_as_of: null, credits_charged: 0 },
        mode: "cnpj",
      });
    }

    if (!apiKey) {
      return NextResponse.json({
        error: "A busca por nome exige configurar CNPJIA_KEY no ambiente da Vercel. A consulta direta por CNPJ continua disponível pela BrasilAPI.",
        setup_required: true,
      }, { status: 503 });
    }
    const url = new URL("https://api.cnpj.ia.br/v1/cnpjs");
    url.searchParams.set("nome", q);
    url.searchParams.set("situacao", "ATIVA");
    const body = await providerFetch(url.toString(), apiKey);
    const results = Array.isArray(body?.data)
      ? body.data.map((item: AnyRecord) => normalizeCompany({ ...item, meta: body?.meta }, "Receita Federal via CNPJ.IA"))
      : [];
    return NextResponse.json({ results, meta: body?.meta || null, mode: "name" });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Não foi possível consultar a base empresarial agora.",
    }, { status: 502 });
  }
}
