// ── Estado global ────────────────────────────────────────────

window.appState = {
  user:        null,
  profile:     null,
  categories:  [],
  currentView: null,
};

// ── Inicialização ────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {

  // ── Modo demo (sem Supabase configurado) ───────────────────
  if (window.DEMO_MODE) {
    window.appState.user     = { id: 'demo-user', email: 'demo@lopescash.app' };
    window.appState.profile  = { id: 'demo-user', name: 'Jhonatan', email: 'demo@lopescash.app', default_budget: 3000 };
    window.appState.categories = await getCategories();

    document.getElementById('demo-banner').hidden = false;

    initTabBar(); initFAB(); initExpenseModal(); initBudgetModal();
    initHistorico(); initOrcamentos(); initGraficos(); initConfirmModal();
    initOfflineBanner();

    navigate(location.hash.slice(1) || 'home');
    return;
  }

  // ── Fluxo normal (com Supabase) ────────────────────────────
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    window.location.href = '/auth.html';
    return;
  }

  window.appState.user = session.user;

  await ensureProfile(session.user);

  const [profile, categories] = await Promise.all([
    getProfile(),
    getCategories(),
  ]);

  window.appState.profile    = profile;
  window.appState.categories = categories;

  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') window.location.href = '/auth.html';
  });

  initTabBar();
  initFAB();
  initExpenseModal();
  initBudgetModal();
  initHistorico();
  initOrcamentos();
  initGraficos();
  initConfirmModal();
  initOfflineBanner();

  const initialView = location.hash.slice(1) || 'home';
  navigate(initialView);

  // Sincronizar gastos que foram salvos offline
  syncPendingExpenses();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
});

// ── Navegação ─────────────────────────────────────────────────

function navigate(view) {
  const allowed = ['home', 'historico', 'graficos', 'perfil', 'orcamentos'];
  if (!allowed.includes(view)) view = 'home';
  if (location.hash !== '#' + view) {
    location.hash = view;
    return;
  }
  showView(view);
}

window.addEventListener('hashchange', () => {
  const view = location.hash.slice(1) || 'home';
  showView(view);
});

function showView(view) {
  document.querySelectorAll('.view').forEach(v => { v.hidden = true; });
  const target = document.getElementById('view-' + view);
  if (target) target.hidden = false;

  // Tab bar e sidebar: orcamentos herda o active de perfil
  const tabView = view === 'orcamentos' ? 'perfil' : view;
  document.querySelectorAll('.tab, .sidebar-item').forEach(el => {
    el.classList.toggle('active', el.dataset.tab === tabView);
  });

  window.appState.currentView = view;
  if (view === 'home')       renderHome();
  if (view === 'historico')  renderHistorico();
  if (view === 'graficos')   renderGraficos();
  if (view === 'perfil')     renderPerfil();
  if (view === 'orcamentos') renderOrcamentos();
}

// ── Tab Bar ──────────────────────────────────────────────────

function initTabBar() {
  // Tab bar e quaisquer botões com data-tab no app
  document.addEventListener('click', e => {
    const tab = e.target.closest('[data-tab]');
    if (tab) navigate(tab.dataset.tab);
  });
}

// ── FAB ──────────────────────────────────────────────────────

function initFAB() {
  document.getElementById('fab').addEventListener('click', () => openExpenseModal());
  document.getElementById('sidebar-add-btn')?.addEventListener('click', () => openExpenseModal());
}

// ── Expense Modal wiring ──────────────────────────────────────

function initExpenseModal() {
  // Fechar ao clicar no overlay
  document.getElementById('expense-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeExpenseModal();
  });

  document.getElementById('cat-btn').addEventListener('click', openCategoryPicker);
  document.getElementById('subcat-btn').addEventListener('click', openSubcategoryPicker);

  // Date field
  const dateInput = document.getElementById('expense-date');
  document.getElementById('date-trigger').addEventListener('click', () => dateInput.showPicker?.() || dateInput.click());
  dateInput.addEventListener('change', () => setDateField(dateInput.value));

  // Installments
  document.getElementById('installment-check').addEventListener('change', e => toggleInstallments(e.target.checked));
  document.getElementById('inst-minus').addEventListener('click', () => changeInstallments(-1));
  document.getElementById('inst-plus').addEventListener('click',  () => changeInstallments(1));
  document.getElementById('expense-amount').addEventListener('input', () => {
    if (_installments > 1) { updateInstBadge(); updateInstPreview(); }
  });

  // Save
  document.getElementById('save-expense-btn').addEventListener('click', saveExpense);

  // Category picker close
  document.getElementById('cat-picker').addEventListener('click', e => {
    if (e.target === e.currentTarget) document.getElementById('cat-picker').hidden = true;
  });
  document.getElementById('picker-close').addEventListener('click', () => {
    document.getElementById('cat-picker').hidden = true;
  });
}

// ── Budget Modal wiring ───────────────────────────────────────

function initBudgetModal() {
  document.getElementById('budget-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) document.getElementById('budget-modal').hidden = true;
  });
  document.getElementById('save-budget-btn').addEventListener('click', saveBudget);
  document.getElementById('edit-budget-btn').addEventListener('click', openBudgetModal);
}

// ── Gráficos wiring ──────────────────────────────────────────

function initGraficos() {
  document.getElementById('graf-month-btn').addEventListener('click', openGrafMonthPicker);
  document.getElementById('graf-prev-year').addEventListener('click', () => changeGrafYear(-1));
  document.getElementById('graf-next-year').addEventListener('click', () => changeGrafYear(1));
}

// ── Offline banner ────────────────────────────────────────────

function initOfflineBanner() {
  const banner = document.getElementById('offline-banner');
  const update = () => { banner.hidden = navigator.onLine; };
  window.addEventListener('online',  () => { update(); syncPendingExpenses(); });
  window.addEventListener('offline', update);
  update();
}

// ── Histórico wiring ─────────────────────────────────────────

function initHistorico() {
  document.getElementById('hist-prev').addEventListener('click', () => navigateHistMonth(-1));
  document.getElementById('hist-next').addEventListener('click', () => navigateHistMonth(1));
}

// ── Orçamentos wiring ─────────────────────────────────────────

function initOrcamentos() {
  document.getElementById('orc-prev-year').addEventListener('click', () => navigateOrcYear(-1));
  document.getElementById('orc-next-year').addEventListener('click', () => navigateOrcYear(1));

  // Delegação para itens de mês (renderizados por JS)
  document.getElementById('orc-months-list').addEventListener('click', e => {
    const btn = e.target.closest('[data-orc-month]');
    if (btn) openMonthBudgetModal(parseInt(btn.dataset.orcMonth));
  });
}

// ── Confirm Modal ─────────────────────────────────────────────

let _confirmCbs = { onSingle: null, onAll: null };

function showConfirm(title, labelSingle, labelAll, onSingle, onAll) {
  document.getElementById('confirm-title').textContent  = title;
  document.getElementById('confirm-single').textContent = labelSingle;
  document.getElementById('confirm-all').textContent    = labelAll;
  _confirmCbs = { onSingle, onAll };
  document.getElementById('confirm-modal').hidden = false;
}

function initConfirmModal() {
  const modal = document.getElementById('confirm-modal');
  modal.addEventListener('click', e => { if (e.target === modal) modal.hidden = true; });
  document.getElementById('confirm-single').addEventListener('click', () => {
    modal.hidden = true; _confirmCbs.onSingle?.();
  });
  document.getElementById('confirm-all').addEventListener('click', () => {
    modal.hidden = true; _confirmCbs.onAll?.();
  });
  document.getElementById('confirm-cancel').addEventListener('click', () => {
    modal.hidden = true;
  });
}

// ── Logout ────────────────────────────────────────────────────

async function logout() {
  await supabase.auth.signOut();
}

// ── Toast ─────────────────────────────────────────────────────

let _toastTimer = null;

function showToast(message, type = 'error') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className   = 'toast' + (type === 'success' ? ' success' : '');
  toast.hidden      = false;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { toast.hidden = true; }, 3000);
}
