import { verifyKey, InteractionType, InteractionResponseType } from 'discord-interactions';
import type { ExportedHandler, Request as CfRequest } from '@cloudflare/workers-types';

const PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY!;

async function readBody(request: CfRequest): Promise<ArrayBuffer> {
  return await request.arrayBuffer();
}

export default {
  async fetch(request: CfRequest): Promise<Response> {
    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

    const signature = request.headers.get('x-signature-ed25519');
    const timestamp = request.headers.get('x-signature-timestamp');
    const body = await readBody(request);

    const isValid = signature && timestamp && verifyKey(
      new Uint8Array(body),
      signature,
      timestamp,
      PUBLIC_KEY
    );

    if (!isValid) return new Response('bad signature', { status: 401 });

    const json = JSON.parse(new TextDecoder().decode(body));


    if (json.type === InteractionType.PING) {
      return Response.json({ type: InteractionResponseType.PONG });
    }

    if (json.data?.name === 'ping') {
      return Response.json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: 'Pong! 🏓 (from Cloudflare Workers)' }
      });
    }

    return new Response('', { status: 200 });
  }
} satisfies ExportedHandler<Env>;
