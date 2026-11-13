// Daily check-in with Supabase so the free project never counts as inactive (it pauses after 7 idle days).
// Reads one row through the public API with the browser key already set in Netlify; nothing is changed.
export default async () => {
  const url = process.env.VITE_SUPABASE_URL, key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return new Response('Supabase settings missing', { status: 500 });
  const res = await fetch(`${url}/rest/v1/settings?select=key&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  console.log('keep-awake', res.status);
  return new Response(`Supabase answered ${res.status}`, { status: res.ok ? 200 : 502 });
};

export const config = { schedule: '@daily' };
