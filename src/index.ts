import { verifyKey, InteractionType, InteractionResponseType } from 'discord-interactions';

/* =========================
   Zona horaria Chile + utilidades
   ========================= */
const TZ = 'America/Santiago';
const fmtDateYMD = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const fmtHM = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function nowInChile() {
  const now = new Date();
  const parts = fmtDateYMD.formatToParts(now);
  const y = parts.find(p => p.type === 'year')!.value;
  const m = parts.find(p => p.type === 'month')!.value;
  const d = parts.find(p => p.type === 'day')!.value;
  const hm = fmtHM.format(now); // "HH:MM"
  const [H, M] = hm.split(':').map(Number);
  return { ymd: `${y}-${m}-${d}`, H, M };
}

function formatCL(amount: number, currency = 'CLP') {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

/* =========================
   Tipos/Helpers Amadeus
   ========================= */
type CheapestItem = {
  departureDate: string;
  returnDate?: string;
  price: { total: string; currency: string };
};
type AmadeusTokenResponse = { access_token: string };
type AmadeusCheapestDatesResponse = { data?: CheapestItem[] };

async function getAmadeusToken(env: any): Promise<string> {
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

async function getCheapestDates(
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

function pickTop10(items: CheapestItem[]): CheapestItem[] {
  return items
    .filter(x => x?.price?.total)
    .sort((a, b) => Number(a.price.total) - Number(b.price.total))
    .slice(0, 10);
}

function renderList(title: string, top: CheapestItem[]) {
  const lines = top.map((x, i) => {
    const ida = x.departureDate;
    const vuelta = x.returnDate ? ` → ${x.returnDate}` : '';
    const precio = formatCL(Number(x.price.total), x.price.currency || 'CLP');
    return `${i + 1}. ${ida}${vuelta} — ${precio}`;
  });
  return [`✈️ **${title}**`, '_(fuente: Amadeus)_', '', ...(lines.length ? lines : ['Sin datos hoy'])].join('\n');
}

/* =========================
   Discord REST (enviar mensaje)
   ========================= */
async function discordPost(env: any, content: string) {
  const url = `https://discord.com/api/v10/channels/${env.DISCORD_CHANNEL_ID}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${env.DISCORD_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord POST ${res.status}: ${text}`);
  }
}

/* =========================
   Job diario (12:30 Chile)
   ========================= */
async function runDailyJob(env: any) {
  const origin = env.AM_ORIGIN || 'SCL';
  const currency = env.AM_CURRENCY || 'CLP';
  const destTokyo = env.AM_DEST_TOKYO || 'TYO';
  const destOsaka = env.AM_DEST_OSAKA || 'OSA';

  const token = await getAmadeusToken(env);

  const listTYO = await getCheapestDates(env, token, origin, destTokyo, currency);
  const topTYO = pickTop10(listTYO);
  const msgTYO = renderList(`Top 10 pasajes más baratos ${origin} ⇄ Tokio (${destTokyo})`, topTYO);

  const listOSA = await getCheapestDates(env, token, origin, destOsaka, currency);
  const topOSA = pickTop10(listOSA);
  const msgOSA = renderList(`Top 10 pasajes más baratos ${origin} ⇄ Osaka (${destOsaka})`, topOSA);

  await discordPost(env, msgTYO);
  await discordPost(env, msgOSA);
}

/* =========================
   Handler HTTP /interactions (con ECHO_VERIFY)
   ========================= */
export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname !== '/interactions') {
      if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') {
        return new Response('ok', { status: 200 });
      }
      return new Response('ok', { status: 200 });
    }

    if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') {
      return new Response('ok', { status: 200 });
    }
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const PUBLIC_KEY = env.DISCORD_PUBLIC_KEY as string | undefined;
    if (!PUBLIC_KEY) return new Response('server misconfigured', { status: 500 });

    const sig = request.headers.get('x-signature-ed25519');
    const ts  = request.headers.get('x-signature-timestamp');
    const raw = await request.arrayBuffer();

    const ok = !!sig && !!ts && verifyKey(new Uint8Array(raw), sig, ts, PUBLIC_KEY);

    if (!ok) {
      if (env.ECHO_VERIFY === 'true') {
        return new Response(raw, { status: 401, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response('bad signature', { status: 401 });
    }

    if (env.ECHO_VERIFY === 'true') {
      return new Response(raw, { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    let body: any;
    try { body = JSON.parse(new TextDecoder().decode(raw)); }
    catch { return new Response('bad request', { status: 400 }); }

    if (body?.type === InteractionType.PING) {
      return new Response(JSON.stringify({ type: InteractionResponseType.PONG }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('', { status: 200 });
  },

  /* =========================
     Cron cada 5 min (UTC)
     Ejecuta 12:30–12:34 Chile y evita duplicados con KV STATE
     ========================= */
  async scheduled(_controller: ScheduledController, env: any, _ctx: ExecutionContext) {
    const { ymd, H, M } = nowInChile();
    const inWindow = H === 12 && M >= 30 && M < 35;
    if (!inWindow) return;

    const state = env.STATE as KVNamespace | undefined;
    const key = 'last_run_cl';

    if (state) {
      const last = await state.get(key);
      if (last === ymd) return;
    }

    try {
      await runDailyJob(env);
    } finally {
      if (state) {
        await state.put(key, ymd, { expirationTtl: 60 * 60 * 48 }); // 48h
      }
    }
  },
} as ExportedHandler;
