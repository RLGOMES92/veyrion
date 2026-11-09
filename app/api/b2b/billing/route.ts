import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/b2b-server";

// Tombstone explícito: pagamentos, cobranças, split e repasses são externos à VEYRION.
export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  }

  return NextResponse.json(
    {
      error: "Pagamentos, cobranças, split e repasses são realizados fora da VEYRION. Este endpoint está desativado.",
      code: "EXTERNAL_PAYMENT_ONLY",
    },
    { status: 410 },
  );
}
