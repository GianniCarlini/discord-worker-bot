export type CheapestItem = {
  departureDate: string;
  returnDate?: string;
  price: { total: string; currency: string };
};

export async function getAmadeusToken(env: any): Promise<string> {
  const url = `${env.AMADEUS_BASE_URL}/v1/security/oauth2/token`;
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: env.AMADEUS_CLIENT_ID,
    client_secret: env.AMADEUS_CLIENT_SECRET
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!res.ok) throw new Error(`Amadeus token ${res.status}`);
  const data = await res.json();
  return data.access_token as string;
}


export async function getCheapestDates(
  env: any,
  token: string,
  origin: string,
  dest: string,
  currencyCode: string
): Promise<CheapestItem[]> {

  const u = new URL(`${env.AMADEUS_BASE_URL}/v1/shopping/flight-dates`);
  u.searchParams.set('origin', origin);
  u.searchParams.set('destination', dest);
  u.searchParams.set('currencyCode', currencyCode);

  const r = await fetch(u.toString(), {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!r.ok) throw new Error(`Amadeus flight-dates ${r.status}`);
  const j = await r.json();
  return (j.data ?? []) as CheapestItem[];
}

export function pickTop10(items: CheapestItem[]): CheapestItem[] {
  return items
    .filter(x => x?.price?.total)
    .sort((a, b) => Number(a.price.total) - Number(b.price.total))
    .slice(0, 10);
}
