import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

export function getUserClient(request: NextRequest): { client: SupabaseClient; userId: string } | null {
  const authorization = request.headers.get("authorization");
  const token = authorization?.replace(/^Bearer\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !key) return null;
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  return { client, userId: "" };
}

export async function requireUser(request: NextRequest) {
  const context = getUserClient(request);
  if (!context) return null;
  const token = request.headers.get("authorization")!.replace(/^Bearer\s+/i, "");
  const { data, error } = await context.client.auth.getUser(token);
  if (error || !data.user) return null;
  return { client: context.client, user: data.user };
}

export function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Supabase server credentials are not configured.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}
