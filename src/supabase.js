import { createClient } from '@supabase/supabase-js';

export const db = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);

// One shared login; this device remembers who is using it, for the change log.
const WHO_KEY = 'ttl-who';
export const getWho = () => { try { return localStorage.getItem(WHO_KEY) || ''; } catch { return ''; } };
export const setWho = w => { try { localStorage.setItem(WHO_KEY, w); } catch {} };
