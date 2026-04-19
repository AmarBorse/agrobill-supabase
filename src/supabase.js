// src/supabase.js
// ─────────────────────────────────────────────────────────────
//  Replace the two values below with YOUR Supabase project's
//  URL and anon key  →  Supabase Dashboard > Settings > API
// ─────────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = 'https://mkxdpimdbalngojqzfeo.supabase.co';
const SUPABASE_ANON = 'sb_publishable_TQYpG-9IyD-qn7z0dWuLMA_gClj5Edy';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
