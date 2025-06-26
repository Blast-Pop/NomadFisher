// supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rihjknasguirrqwjporm.supabase.co'; // remplace par ton URL
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpaGprbmFzZ3VpcnJxd2pwb3JtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA5NjA1NjcsImV4cCI6MjA2NjUzNjU2N30.swk6vo2GCU1N1ZhRSEKrZZ9dnYUJU-B88PLMOPStPbY'; // remplace par ta clé anonyme

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
