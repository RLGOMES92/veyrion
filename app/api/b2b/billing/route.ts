import { NextResponse } from "next/server";

// Pagamentos, cobranças e repasses são tratados diretamente entre as partes.
// Este endpoint legado permanece apenas como tombstone para clientes antigos.
export async function POST() {
  return NextResponse.json({
    error: "Pagamentos e repasses são realizados fora da VEYRION. Este endpoint está desativado.",
    code: "EXTERNAL_PAYMENT_ONLY",
  }, { status: 410 });
}
