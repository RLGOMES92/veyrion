export function requiredZohoEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Configuração ausente: ${name}`);
  return value.replace(/\/$/, "");
}

export async function getZohoAccessToken(): Promise<string> {
  const accountsUrl = requiredZohoEnv("ZOHO_ACCOUNTS_URL");
  const body = new URLSearchParams({
    refresh_token: requiredZohoEnv("ZOHO_REFRESH_TOKEN"),
    client_id: requiredZohoEnv("ZOHO_CLIENT_ID"),
    client_secret: requiredZohoEnv("ZOHO_CLIENT_SECRET"),
    grant_type: "refresh_token",
  });

  const response = await fetch(`${accountsUrl}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const result = await response.json().catch(() => ({}));

  if (!response.ok || !result.access_token) {
    // Do not expose provider payloads: they can contain sensitive diagnostics.
    throw new Error("Não foi possível renovar a autorização do Zoho. Confira as credenciais e a região.");
  }

  return String(result.access_token);
}

export async function zohoV2Request(
  path: string,
  accessToken: string,
  init: RequestInit = {},
): Promise<{ response: Response; result: any }> {
  const apiDomain = requiredZohoEnv("ZOHO_API_DOMAIN");
  const response = await fetch(`${apiDomain}/crm/v2/${path.replace(/^\//, "")}`, {
    ...init,
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
  });
  const result = await response.json().catch(() => ({}));
  return { response, result };
}
