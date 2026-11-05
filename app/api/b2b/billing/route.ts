import { NextRequest } from "next/server";
import { jsonError, requireUser } from "@/lib/b2b-server";

// Retired endpoint: all new billing requests must use the contract-scoped,
// organization-authorized, Preview/Sandbox-only endpoint.
export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth) return jsonError("Sessão inválida.", 401);
  return jsonError("Endpoint financeiro legado desativado. Use a cobrança vinculada ao contrato ativo.", 410);
}
