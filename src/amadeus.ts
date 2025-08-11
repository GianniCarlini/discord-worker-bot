export type CheapestItem = {
  departureDate: string;
  returnDate?: string;
  price: { total: string; currency: string };
};

type AmadeusTokenResponse = { access_token: string };
type AmadeusCheapestDatesResponse = { data?: CheapestItem[] };

export async function getAmadeusToken(env: any): Promise<string> {
  const base = env.AMADEUS_BASE_URL || 'https://api.amadeus.com';
  const res = await fetch(`${base}/v1/security/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: env.AMADEUS_CLIENT_ID,
      client_secret: env.AMADEUS_CLIENT_SECRET,
    }),
  });
  if (!res.ok) throw new Error(`Amadeus token ${res.status}`);
  const data = (await res.json()) as AmadeusTokenResponse;
  return data.access_token;
}

export async function getCheapestDates(
  env: any,
  token: string,
  origin: string,
  destination: string,
  currencyCode: string
): Promise<CheapestItem[]> {
  const base = env.AMADEUS_BASE_URL || 'https://api.amadeus.com';
  const u = new URL(`${base}/v1/shopping/flight-dates`);
  u.searchParams.set('origin', origin);
  u.searchParams.set('destination', destination);
  u.searchParams.set('currencyCode', currencyCode);

  const r = await fetch(u.toString(), { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`Amadeus flight-dates ${r.status}`);
  const j = (await r.json()) as AmadeusCheapestDatesResponse;
  return j.data ?? [];
}

export function pickTop10(items: CheapestItem[]): CheapestItem[] {
  return items
    .filter(x => x?.price?.total)
    .sort((a, b) => Number(a.price.total) - Number(b.price.total))
    .slice(0, 10);
}
