// ── Controle de aba (Login / Criar conta) ────────────────────

let _mode = 'login'; // 'login' | 'signup'
let _signupEmail = '';

document.addEventListener('DOMContentLoaded', async () => {
  // Recuperação de senha via link do e-mail
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') {
      document.getElementById('auth-form-wrap').hidden    = true;
      document.getElementById('auth-recovery').hidden     = false;
    }
  });

  // Redireciona se já logado (e não estamos em recovery)
  const { data: { session } } = await supabase.auth.getSession();
  if (session && !window.location.hash.includes('recovery')) {
    window.location.href = '/index.html';
    return;
  }

  document.getElementById('tab-login').addEventListener('click',  () => setMode('login'));
  document.getElementById('tab-signup').addEventListener('click', () => setMode('signup'));
  document.getElementById('auth-form').addEventListener('submit', handleSubmit);
  document.getElementById('forgot-pw-btn').addEventListener('click', handleForgotPassword);
  document.getElementById('resend-email-btn').addEventListener('click', handleResend);
  document.getElementById('reset-pw-form').addEventListener('submit', handlePasswordReset);

  document.getElementById('toggle-pw').addEventListener('click', () => {
    const input = document.getElementById('input-password');
    const show  = input.type === 'password';
    input.type  = show ? 'text' : 'password';
    document.getElementById('eye-show').hidden = show;
    document.getElementById('eye-hide').hidden = !show;
  });
});

function setMode(mode) {
  _mode = mode;
  document.getElementById('tab-login').classList.toggle('active',  mode === 'login');
  document.getElementById('tab-signup').classList.toggle('active', mode === 'signup');
  document.getElementById('field-name').hidden      = mode !== 'signup';
  document.getElementById('forgot-pw-wrap').hidden  = mode !== 'login';
  document.getElementById('submit-btn').textContent = mode === 'login' ? 'Entrar' : 'Criar conta';
  document.getElementById('auth-error').textContent = '';
}

async function handleSubmit(e) {
  e.preventDefault();
  const btn     = document.getElementById('submit-btn');
  const errorEl = document.getElementById('auth-error');
  const email    = document.getElementById('input-email').value.trim();
  const password = document.getElementById('input-password').value;

  errorEl.textContent = '';
  btn.disabled = true;
  btn.textContent = _mode === 'login' ? 'Entrando…' : 'Criando conta…';

  if (_mode === 'signup') {
    const name = document.getElementById('input-name').value.trim();
    if (!name) {
      errorEl.textContent = 'Informe seu nome.';
      resetBtn(btn);
      return;
    }
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error) {
      errorEl.textContent = translateError(error.message);
      resetBtn(btn);
      return;
    }
    // Mostra tela de sucesso (pode já estar logado se email confirm estiver desligado)
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      window.location.href = '/index.html';
    } else {
      showSuccess(email);
    }
  } else {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      errorEl.textContent = translateError(error.message);
      resetBtn(btn);
      return;
    }
    window.location.href = '/index.html';
  }
}

function resetBtn(btn) {
  btn.disabled = false;
  btn.textContent = _mode === 'login' ? 'Entrar' : 'Criar conta';
}

function showSuccess(email) {
  _signupEmail = email;
  document.getElementById('auth-form-wrap').hidden = true;
  document.getElementById('auth-success').hidden   = false;
  document.getElementById('success-email').textContent = email;
}

async function handleForgotPassword() {
  const email   = document.getElementById('input-email').value.trim();
  const errorEl = document.getElementById('auth-error');
  if (!email) { errorEl.textContent = 'Informe seu e-mail acima.'; return; }

  const btn = document.getElementById('forgot-pw-btn');
  btn.disabled = true;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.href.split('#')[0],
  });

  btn.disabled = false;

  if (error) { errorEl.textContent = translateError(error.message); return; }

  document.getElementById('auth-form-wrap').hidden       = true;
  document.getElementById('auth-forgot-success').hidden  = false;
  document.getElementById('forgot-success-email').textContent = email;
}

async function handleResend() {
  const btn  = document.getElementById('resend-email-btn');
  const prev = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Reenviando…';

  const { error } = await supabase.auth.resend({ type: 'signup', email: _signupEmail });

  btn.disabled = false;
  btn.textContent = error ? 'Erro ao reenviar' : 'Reenviado! ✓';
  setTimeout(() => { btn.textContent = prev; }, 3000);
}

async function handlePasswordReset(e) {
  e.preventDefault();
  const password = document.getElementById('input-new-password').value;
  const errorEl  = document.getElementById('recovery-error');
  const btn      = document.getElementById('reset-pw-btn');

  if (password.length < 6) {
    errorEl.textContent = 'A senha deve ter pelo menos 6 caracteres.';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Salvando…';

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    errorEl.textContent = translateError(error.message);
    btn.disabled = false;
    btn.textContent = 'Salvar nova senha';
    return;
  }

  window.location.href = '/index.html';
}

function translateError(msg) {
  if (msg.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (msg.includes('Email not confirmed'))       return 'Confirme seu e-mail antes de entrar.';
  if (msg.includes('User already registered'))   return 'E-mail já cadastrado. Faça login.';
  if (msg.includes('Password should be'))        return 'A senha deve ter pelo menos 6 caracteres.';
  return msg;
}
