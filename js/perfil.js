// ── Perfil ───────────────────────────────────────────────────

async function renderPerfil() {
  const profile = window.appState.profile;
  const name    = profile?.name  || '—';
  const email   = profile?.email || '—';

  document.getElementById('perfil-name').textContent  = name;
  document.getElementById('perfil-email').textContent = email;

  // Iniciais do avatar
  const initials = name.split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase();
  document.getElementById('perfil-avatar').textContent = initials;
}

// ── Orçamentos por mês ────────────────────────────────────────

let _orcYear = new Date().getFullYear();

async function renderOrcamentos() {
  document.getElementById('orc-year').textContent = _orcYear;

  const profile   = window.appState.profile;
  const defAmount = parseFloat(profile?.default_budget || 0);
  document.getElementById('default-budget-val').textContent = formatCurrency(defAmount);

  const { data: overrides } = await supabase
    .from('monthly_budgets')
    .select('month, amount')
    .eq('user_id', uid())
    .eq('year', _orcYear);

  const overrideMap = {};
  (overrides || []).forEach(b => { overrideMap[b.month] = parseFloat(b.amount); });

  const now         = new Date();
  const currentYear = now.getFullYear();
  const currentMon  = now.getMonth() + 1;

  const html = Array.from({ length: 12 }, (_, i) => {
    const m          = i + 1;
    const isCurrent  = m === currentMon && _orcYear === currentYear;
    const hasOverride = overrideMap[m] !== undefined;
    const amount     = hasOverride ? overrideMap[m] : defAmount;

    return `
      <button class="orc-month-item ${isCurrent ? 'orc-month-current' : ''}"
              data-orc-month="${m}">
        <div class="orc-month-left">
          <span class="orc-month-name">${monthName(m, false)}</span>
          ${isCurrent  ? '<span class="badge-atual">ATUAL</span>'     : ''}
          ${!hasOverride && !isCurrent ? '<span class="badge-default">padrão</span>' : ''}
        </div>
        <div class="orc-month-right">
          ${hasOverride ? '<span class="badge-override">+override</span>' : ''}
          <span class="orc-month-val num">${formatCurrency(amount)}</span>
          <svg width="7" height="12" viewBox="0 0 7 12" fill="none"
               stroke="var(--text-dim)" stroke-width="1.5" stroke-linecap="round">
            <path d="M1 1l5 5-5 5"/>
          </svg>
        </div>
      </button>`;
  }).join('');

  document.getElementById('orc-months-list').innerHTML = html;
}

function navigateOrcYear(delta) {
  _orcYear += delta;
  renderOrcamentos();
}

// ── Modais de edição de orçamento ─────────────────────────────

async function openMonthBudgetModal(month) {
  const budgetData = await getBudgetForMonth(_orcYear, month);
  openBudgetModalWith(
    `${monthName(month)} · ${_orcYear}`,
    budgetData.amount,
    async (amount) => {
      const { error } = await setMonthlyBudget(_orcYear, month, amount);
      if (error) { showToast('Erro: ' + error.message); return; }
      renderOrcamentos();
    }
  );
}

async function editDefaultBudget() {
  const defAmount = parseFloat(window.appState.profile?.default_budget || 0);
  openBudgetModalWith(
    'Orçamento padrão',
    defAmount,
    async (amount) => {
      const { error } = await updateProfile({ default_budget: amount });
      if (error) { showToast('Erro: ' + error.message); return; }
      window.appState.profile.default_budget = amount;
      renderOrcamentos();
    }
  );
}

// Abre o modal reutilizável de orçamento com callback customizado
function openBudgetModalWith(title, currentAmount, onSave) {
  const modal  = document.getElementById('budget-modal');
  document.getElementById('budget-modal-title').textContent = title;
  document.getElementById('budget-modal-input').value =
    currentAmount > 0 ? currentAmount : '';

  // Sobrescreve o handler de salvar
  const saveBtn = document.getElementById('save-budget-btn');
  saveBtn.onclick = async () => {
    const raw    = document.getElementById('budget-modal-input').value.replace(',', '.');
    const amount = parseFloat(raw);
    if (isNaN(amount) || amount < 0) { showToast('Valor inválido'); return; }
    saveBtn.disabled = true;
    await onSave(amount);
    saveBtn.disabled = false;
    modal.hidden = true;
    // Restaura handler padrão (home)
    saveBtn.onclick = saveBudget;
  };

  modal.hidden = false;
  setTimeout(() => document.getElementById('budget-modal-input').focus(), 100);
}
