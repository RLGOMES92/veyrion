import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireUser } from "@/lib/b2b-server";

export const runtime = "nodejs";

const organizationId = "415757ac-3b33-4cf2-8a7a-6daa9d49d725";

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth) return NextResponse.json({ error: "Sessão inválida ou expirada." }, { status: 401 });

  const { data: currentOrganization, error: organizationError } = await auth.client.rpc("current_user_organization_id");
  if (organizationError || currentOrganization !== organizationId) {
    return NextResponse.json({ error: "Organização não autorizada." }, { status: 403 });
  }

  const { data: membership, error: membershipError } = await auth.client
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (membershipError || !membership || !["owner", "admin", "manager", "sales"].includes(membership.role)) {
    return NextResponse.json({ error: "Seu perfil não tem acesso à caixa de leads." }, { status: 403 });
  }

  const { data, error } = await auth.client
    .from("public_lead_inquiries")
    .select("id,name,company,role,email,city,quantity,term,need,source,status,created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("VEYRION public lead inbox query failed:", error.code);
    return NextResponse.json({ error: "Não foi possível carregar os leads agora." }, { status: 503 });
  }

  return NextResponse.json({ leads: data || [], count: data?.length || 0 });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Honeypot: silently accept bot submissions without storing them.
    if (clean(body.website, 180)) {
      return NextResponse.json({ ok: true });
    }

    const lead = {
      name: clean(body.name, 120),
      company: clean(body.company, 180),
      role: clean(body.role, 120),
      email: clean(body.email, 254).toLowerCase(),
      city: clean(body.city, 140),
      quantity: clean(body.quantity, 80),
      term: clean(body.term, 80),
      need: clean(body.need, 180),
    };

    if (lead.name.length < 2 || lead.company.length < 2 || lead.city.length < 2 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email) ||
        !lead.quantity || !lead.term) {
      return NextResponse.json({ error: "Confira os campos obrigatórios e tente novamente." }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      return NextResponse.json({ error: "Recebimento temporariamente indisponível. Tente pelo WhatsApp." }, { status: 503 });
    }

    const supabase = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { error } = await supabase.from("public_lead_inquiries").insert({
      organization_id: organizationId,
      ...lead,
      source: "site_locacao",
      status: "novo"
    });

    if (error) {
      console.error("VEYRION public lead insert failed:", error.code);
      return NextResponse.json({ error: "Não foi possível registrar agora. Tente pelo WhatsApp." }, { status: 503 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Solicitação inválida. Revise os dados e tente novamente." }, { status: 400 });
  }
}
