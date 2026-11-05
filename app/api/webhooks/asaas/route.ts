import { NextRequest, NextResponse } from "next/server";

// Payments are handled outside VEYRION. Keep this route as an explicit
// tombstone so old clients cannot accidentally create provider-side charges.
export async function POST(_request: NextRequest) {
  return NextResponse.json({
    error: "Operações de pagamento são realizadas fora da VEYRION. Este endpoint está desativado.",
    code: "EXTERNAL_PAYMENT_ONLY",
  }, { status: 410 });
}
