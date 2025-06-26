// supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'SUPABASE URL'; // remplace par ton URL
const SUPABASE_ANON_KEY = 'ANON KEY'; // remplace par ta clé anonyme

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
