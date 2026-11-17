// Brain's server side. It holds the Anthropic key, checks that the caller is a signed-in coach,
// and sends one Claude request per call. The tools themselves run in the coach's browser,
// through the same portal functions a coach uses, so every change is logged and can be undone.
import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-opus-5-5';
const MAX_BODY = 1_500_000; // a long Brain conversation, well under Claude's context window
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export default async req => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  if (!process.env.ANTHROPIC_API_KEY) return json({ error: 'not_configured' }, 503);

  // Only a signed-in coach of this portal may use the key.
  const url = process.env.VITE_SUPABASE_URL, anon = process.env.VITE_SUPABASE_ANON_KEY;
  const auth = req.headers.get('authorization') || '';
  if (!url || !anon || !/^Bearer .+/.test(auth)) return json({ error: 'not_signed_in' }, 401);
  const who = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anon, Authorization: auth } }).catch(() => null);
  if (!who || !who.ok) return json({ error: 'not_signed_in' }, 401);

  const raw = await req.text();
  if (raw.length > MAX_BODY) return json({ error: 'prompt_too_large' }, 413);
  let body;
  try { body = JSON.parse(raw); } catch { return json({ error: 'bad_request' }, 400); }
  const { system, tools, messages } = body || {};
  if (typeof system !== 'string' || !Array.isArray(tools) || !Array.isArray(messages) || !messages.length) return json({ error: 'bad_request' }, 400);

  const client = new Anthropic();
  try {
    const msg = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 8000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default', // if Claude declines a request on safety grounds, the API retries it on a suitable model
      output_config: { effort: 'medium' },
      // Frozen for the whole Brain conversation by the browser, so the cache keeps hitting.
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      tools,
      messages,
    });
    return json({ content: msg.content, stop_reason: msg.stop_reason, usage: msg.usage });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) return json({ error: 'bad_key' }, 502);
    if (err instanceof Anthropic.RateLimitError) return json({ error: 'rate_limited' }, 429);
    if (err instanceof Anthropic.BadRequestError) return json({ error: 'bad_request', detail: err.message }, 400);
    if (err instanceof Anthropic.APIConnectionError) return json({ error: 'unreachable' }, 502);
    if (err instanceof Anthropic.APIError) return json({ error: 'api', status: err.status, detail: err.message }, 502);
    throw err;
  }
};

export const config = { path: '/api/brain' };
