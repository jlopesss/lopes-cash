// ── Configuração do Supabase ──────────────────────────────────
// 1. Acesse https://supabase.com e crie um projeto (grátis).
// 2. No dashboard: Settings → API
// 3. Copie a "Project URL" e a "anon public" key abaixo.
// 4. Em Authentication → URL Configuration, adicione o site URL
//    (ex: https://lopes-cash.vercel.app ou http://localhost:5500)
// ─────────────────────────────────────────────────────────────
const SUPABASE_URL      = 'https://SEU_PROJETO.supabase.co';
const SUPABASE_ANON_KEY = 'SUA_ANON_KEY_AQUI';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  }
});
