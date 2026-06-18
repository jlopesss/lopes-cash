// ── Configuração do Supabase ──────────────────────────────────
// 1. Acesse https://supabase.com e crie um projeto (grátis).
// 2. No dashboard: Settings → API
// 3. Copie a "Project URL" e a "anon public" key abaixo.
// 4. Em Authentication → URL Configuration, adicione o site URL
//    (ex: https://lopes-cash.vercel.app ou http://localhost:5500)
// ─────────────────────────────────────────────────────────────
const SUPABASE_URL      = 'https://stxfrwszsevdqlrfwsxk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0eGZyd3N6c2V2ZHFscmZ3c3hrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3NDMwODAsImV4cCI6MjA5NzMxOTA4MH0.xE5RA_YbOpYCliYxdxd2oUBl_Tb6OmH-TJ1KCFgeE_M';

// Substitui a referência da lib pelo client — evita re-declaração de `supabase`
window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  }
});

// Ativa modo demo quando as credenciais ainda são placeholder
window.DEMO_MODE = SUPABASE_URL.includes('SEU_PROJETO');
