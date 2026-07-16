// ── Estado global ────────────────────────────────────────────

window.appState = {
  user:        null,
  profile:     null,
  categories:  [],
  currentView: null,
};

// ── Gerenciamento de histórico para modais (botão voltar) ─────

let _modalSessionActive = false;
let _historySkipNext    = false;

function _findTopmostModal() {
  const order = [
    'numpad-modal', 'date-picker-modal', 'cat-edit-modal', 'cat-picker',
    'confirm-modal', 'budget-modal', 'name-edit-modal', 'expense-modal',
  ];
  for (const id of order) {
    const el = document.getElementById(id);
    if (el && !el.hidden) return el;
  }
  return null;
}

function _modalOpen() {
  if (!_modalSessionActive) {
    _modalSessionActive = true;
    history.pushState({ lc_modal: true }, '', location.href);
  }
}

function _modalClose() {
  if (_modalSessionActive && !_findTopmostModal()) {
    _modalSessionActive = false;
    _historySkipNext = true;
    history.back();
  }
}

window.addEventListener('popstate', () => {
  if (_historySkipNext) {
    _historySkipNext = false;
    return;
  }
  const top = _findTopmostModal();
  if (top) {
    top.hidden = true;
    if (_findTopmostModal()) {
      // Ainda há modais — re-empurra estado para o próximo voltar funcionar
      history.pushState({ lc_modal: true }, '', location.href);
    } else {
      _modalSessionActive = false;
    }
  } else {
    _modalSessionActive = false;
  }
});

// ── Inicialização ────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {

  // ── Modo demo (sem Supabase configurado) ───────────────────
  if (window.DEMO_MODE) {
    window.appState.user     = { id: 'demo-user', email: 'demo@lopescash.app' };
    window.appState.profile  = { id: 'demo-user', name: 'Jhonatan', email: 'demo@lopescash.app', default_budget: 3000 };
    window.appState.categories = await getCategories();

    document.getElementById('demo-banner').hidden = false;

    initTabBar(); initFAB(); initHome(); initExpenseModal(); initBudgetModal();
    initHistorico(); initOrcamentos(); initGraficos(); initConfirmModal();
    initOfflineBanner(); initEditName(); initCatEditModal(); initPullToRefresh();

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
  initHome();
  initExpenseModal();
  initBudgetModal();
  initHistorico();
  initOrcamentos();
  initGraficos();
  initConfirmModal();
  initOfflineBanner();
  initEditName();
  initCatEditModal();
  initPullToRefresh();

  const initialView = location.hash.slice(1) || 'home';
  navigate(initialView);

  // Sincronizar gastos que foram salvos offline
  syncPendingExpenses();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => {
        // Verifica atualização imediatamente ao abrir o app (não só no visibilitychange)
        reg.update();
        document.addEventListener('visibilitychange', () => {
          if (!document.hidden) reg.update();
        });
      })
      .catch(() => {});

    // Quando o novo SW assume o controle, recarrega para pegar os assets novos
    let swReloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (swReloading) return;
      swReloading = true;
      location.reload();
    });
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

  document.body.classList.toggle('hist-active', view === 'historico');
  document.body.dataset.view = view;

  window.appState.currentView = view;
  if (view === 'home')        renderHome();
  if (view === 'historico')   renderHistorico();
  if (view === 'graficos')    renderGraficos();
  if (view === 'perfil')      renderPerfil();
  if (view === 'orcamentos')  renderOrcamentos();
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

  document.getElementById('expense-amount').addEventListener('click', openNumpad);
  document.getElementById('numpad-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) {
      document.getElementById('numpad-modal').hidden = true;
      _modalClose();
    }
  });

  document.getElementById('cat-btn').addEventListener('click', openCategoryPicker);
  document.getElementById('subcat-btn').addEventListener('click', openSubcategoryPicker);

  // Date field
  document.getElementById('date-trigger').addEventListener('click', openDatePicker);
  document.getElementById('date-picker-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeDatePicker();
  });
  document.getElementById('date-cal-close').addEventListener('click', closeDatePicker);
  document.getElementById('date-cal-cancel').addEventListener('click', closeDatePicker);
  document.getElementById('date-cal-ok').addEventListener('click', confirmCalDate);
  document.getElementById('date-cal-prev').addEventListener('click', () => changeCalMonth(-1));
  document.getElementById('date-cal-next').addEventListener('click', () => changeCalMonth(1));
  document.getElementById('date-cal-grid').addEventListener('click', e => {
    const btn = e.target.closest('[data-day]');
    if (btn) selectCalDay(parseInt(btn.dataset.day, 10));
  });

  // Installments
  document.getElementById('installment-check').addEventListener('change', e => toggleInstallments(e.target.checked));
  document.getElementById('inst-minus').addEventListener('click', () => changeInstallments(-1));
  document.getElementById('inst-plus').addEventListener('click',  () => changeInstallments(1));
  document.getElementById('expense-amount').addEventListener('input', () => {
    if (_installments > 1) { updateInstBadge(); updateInstPreview(); }
  });

  // Save
  document.getElementById('save-expense-btn').addEventListener('click', saveExpense);

  // Category picker close + add
  document.getElementById('cat-picker').addEventListener('click', e => {
    if (e.target === e.currentTarget) {
      document.getElementById('cat-picker').hidden = true;
      _modalClose();
    }
  });
  document.getElementById('picker-close').addEventListener('click', () => {
    document.getElementById('cat-picker').hidden = true;
    _modalClose();
  });
  document.getElementById('picker-add-cat-btn').addEventListener('click', () => {
    if (_pickerMode === 'sub') openSubcatEditModal(null);
    else                      openCatEditModal(null);
  });
  document.getElementById('picker-back').addEventListener('click', openCategoryPicker);

  const subcatEditModal = document.getElementById('subcat-edit-modal');
  subcatEditModal.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeSubcatEditModal();
  });
  document.getElementById('save-subcat-edit-btn').addEventListener('click', saveSubcatEdit);
  document.getElementById('subcat-edit-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); saveSubcatEdit(); }
  });
}

// ── Budget Modal wiring ───────────────────────────────────────

function initBudgetModal() {
  document.getElementById('budget-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) {
      document.getElementById('budget-modal').hidden = true;
      _modalClose();
    }
  });
  document.getElementById('save-budget-btn').addEventListener('click', saveBudget);
  document.getElementById('edit-budget-btn').addEventListener('click', openBudgetModal);
}

// ── Gráficos wiring ──────────────────────────────────────────

function initGraficos() {
  document.getElementById('graf-month-val').addEventListener('click', openGrafMonthPicker);
  document.getElementById('graf-prev-month').addEventListener('click', () => changeGrafMonth(-1));
  document.getElementById('graf-next-month').addEventListener('click', () => changeGrafMonth(1));
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
  document.getElementById('confirm-all').textContent    = labelAll || '';
  document.getElementById('confirm-all').hidden         = !labelAll;
  _confirmCbs = { onSingle, onAll };
  document.getElementById('confirm-modal').hidden = false;
  _modalOpen();
}

function initConfirmModal() {
  const modal = document.getElementById('confirm-modal');
  modal.addEventListener('click', e => { if (e.target === modal) { modal.hidden = true; _modalClose(); } });
  document.getElementById('confirm-single').addEventListener('click', () => {
    modal.hidden = true; _modalClose(); _confirmCbs.onSingle?.();
  });
  document.getElementById('confirm-all').addEventListener('click', () => {
    modal.hidden = true; _modalClose(); _confirmCbs.onAll?.();
  });
  document.getElementById('confirm-cancel').addEventListener('click', () => {
    modal.hidden = true; _modalClose();
  });
}

// ── Pull to refresh ──────────────────────────────────────────
// Totalmente passivo: não chama preventDefault, coexiste com o PTR nativo do Android.
// Mostra indicador visual e recarrega quando o usuário puxa o suficiente.

function initPullToRefresh() {
  const indicator = document.getElementById('pull-indicator');
  const label     = document.getElementById('pull-label');
  const THRESHOLD = 80;
  let startY = 0;
  let active = false;
  let dist   = 0;

  document.addEventListener('touchstart', e => {
    if (e.target.closest('.modal-overlay, .chips-scroll')) return;
    const view = e.target.closest('.view');
    if (!view || view.scrollTop > 2) return;
    startY = e.touches[0].clientY;
    active = true;
    dist   = 0;
    indicator.classList.remove('pull-releasing', 'pull-ready');
  }, { passive: true });

  document.addEventListener('touchmove', e => {
    if (!active) return;
    const view = e.target.closest('.view');
    if (!view || view.scrollTop > 2) { active = false; return; }

    dist = e.touches[0].clientY - startY;
    if (dist <= 0) return;

    const travel = Math.min(dist * 0.45, 44);
    indicator.style.transform = `translateX(-50%) translateY(${travel - 60}px)`;
    indicator.classList.toggle('pull-ready', dist >= THRESHOLD);
    label.textContent = dist >= THRESHOLD ? 'Soltar para atualizar' : 'Puxar para atualizar';
  }, { passive: true });

  document.addEventListener('touchend', () => {
    if (!active) return;
    active = false;

    if (dist >= THRESHOLD) {
      label.textContent = 'Atualizando…';
      indicator.style.transform = 'translateX(-50%) translateY(0)';
      setTimeout(() => location.reload(), 350);
    } else {
      indicator.classList.add('pull-releasing');
      indicator.style.transform = 'translateX(-50%) translateY(-60px)';
      indicator.classList.remove('pull-ready');
    }
    startY = 0;
    dist   = 0;
  }, { passive: true });
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
