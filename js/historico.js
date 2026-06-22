// ── Estado ───────────────────────────────────────────────────

let _histYear     = new Date().getFullYear();
let _histMonth    = new Date().getMonth() + 1;
let _histFilter   = null;
let _histExpenses = [];

// ── Renderização principal ────────────────────────────────────

async function renderHistorico() {
  updateMonthNavLabel();

  const [expenses, budgetData] = await Promise.all([
    getMonthExpenses(_histYear, _histMonth),
    getBudgetForMonth(_histYear, _histMonth),
  ]);

  _histExpenses = expenses;
  _histFilter   = null;

  renderChips(expenses);
  renderGroupedList(expenses);
  renderHistFooter(expenses, budgetData);
}

function updateMonthNavLabel() {
  document.getElementById('hist-month-label').textContent =
    `${monthName(_histMonth)} · ${_histYear}`;
}

function navigateHistMonth(delta) {
  let m = _histMonth + delta;
  let y = _histYear;
  if (m > 12) { m = 1; y++; }
  if (m < 1)  { m = 12; y--; }
  _histMonth = m;
  _histYear  = y;
  _histFilter = null;
  renderHistorico();
}

// ── Chips de categoria ────────────────────────────────────────

function renderChips(expenses) {
  const container = document.getElementById('hist-chips');
  const catMap = {};
  expenses.forEach(e => { if (e.categories) catMap[e.category_id] = e.categories; });
  const cats = Object.values(catMap);

  const allChip = `<button class="chip ${!_histFilter ? 'chip-active' : ''}"
    data-chip-cat="">Todas</button>`;

  const catChips = cats.map(c =>
    `<button class="chip ${_histFilter === c.id ? 'chip-active' : ''}" data-chip-cat="${c.id}">
      ${c.emoji} ${escHtml(c.name)}
    </button>`
  ).join('');

  container.innerHTML = allChip + catChips;
}

document.addEventListener('click', e => {
  const chip = e.target.closest('[data-chip-cat]');
  if (!chip) return;
  _histFilter = chip.dataset.chipCat || null;
  const filtered = _histFilter
    ? _histExpenses.filter(ex => ex.category_id === _histFilter)
    : _histExpenses;
  renderChips(_histExpenses);
  renderGroupedList(filtered);
});

// ── Lista agrupada por dia ─────────────────────────────────────

function renderGroupedList(expenses) {
  const container = document.getElementById('hist-expenses-list');

  if (expenses.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding:32px 0 16px">
        <div class="empty-emoji">📭</div>
        <div class="empty-title">Nenhum gasto${_histFilter ? ' nessa categoria' : ''}</div>
        <div class="empty-sub">neste mês.</div>
      </div>`;
    return;
  }

  const groups = {};
  expenses.forEach(e => {
    if (!groups[e.date]) groups[e.date] = [];
    groups[e.date].push(e);
  });

  const today = todayISO();
  const d     = new Date(); d.setDate(d.getDate() - 1);
  const yest  = isoDate(d.getFullYear(), d.getMonth() + 1, d.getDate());

  const html = Object.keys(groups)
    .sort((a, b) => b.localeCompare(a))
    .map(date => {
      const [, m, day] = date.split('-').map(Number);
      let dayLabel;
      if (date === today)     dayLabel = `HOJE · ${day} ${MONTHS_SHORT[m-1].toUpperCase()}`;
      else if (date === yest) dayLabel = `ONTEM · ${day} ${MONTHS_SHORT[m-1].toUpperCase()}`;
      else                    dayLabel = `${day} ${MONTHS_SHORT[m-1].toUpperCase()}`;
      return `
        <div class="day-group">
          <div class="day-group-label label-sm">${dayLabel}</div>
          ${groups[date].map(buildSwipeItem).join('')}
        </div>`;
    }).join('');

  container.innerHTML = html;
  initSwipe(container);
}

function buildSwipeItem(e) {
  const cat   = e.categories;
  const color = cat?.color || '#6B7A92';
  const emoji = cat?.emoji || '📦';
  const name  = e.description || cat?.name || 'Gasto';
  const sub   = e.subcategories?.name
    ? `${escHtml(e.subcategories.name)} · `
    : (cat?.name && e.description ? `${escHtml(cat.name)} · ` : '');
  const time     = formatTime(e.time);
  const isInst   = e.installment_total > 1;
  const instTag  = isInst
    ? `<span class="installment-tag">${e.installment_number}/${e.installment_total}</span>` : '';

  return `
    <div class="swipe-wrap" data-id="${e.id}" data-inst="${isInst}">
      <div class="swipe-inner">
        <div class="expense-icon" style="background:${color}22">${emoji}</div>
        <div class="expense-info">
          <div class="expense-name">${escHtml(name)} ${instTag}</div>
          <div class="expense-sub">${sub}${time || relativeDate(e.date)}</div>
        </div>
        <div class="expense-amount num">-${formatCurrency(e.amount)}</div>
        <button class="hist-del-btn" data-action="delete" data-id="${e.id}" data-inst="${isInst}" aria-label="Excluir">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
            <path d="M3 5h10M6 5V3h4v2M6 8v5M10 8v5M4 5l1 9h6l1-9"/>
          </svg>
        </button>
      </div>
    </div>`;
}

// ── Swipe gesture ─────────────────────────────────────────────

function initSwipe(container) {
  container.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (btn) {
      e.stopPropagation();
      const id   = btn.dataset.id;
      const inst = btn.dataset.inst === 'true';
      if (btn.dataset.action === 'delete') handleHistDelete(id, inst);
      return;
    }
    const wrap = e.target.closest('.swipe-wrap');
    if (wrap) handleHistEdit(wrap.dataset.id, wrap.dataset.inst === 'true');
  });
}

// ── Editar / Excluir ──────────────────────────────────────────

function handleHistEdit(id, isInst) {
  openExpenseModal(id);
}

function handleHistDelete(id, isInst) {
  if (isInst) {
    showConfirm(
      'Esta é uma compra parcelada.',
      'Excluir só esta parcela',
      'Excluir todas as parcelas',
      () => doHistDelete(id, 'single'),
      () => doHistDelete(id, 'all')
    );
  } else {
    showConfirm(
      'Excluir este lançamento?',
      'Sim, excluir',
      null,
      () => doHistDelete(id, 'single'),
      null
    );
  }
}

async function doHistDelete(id, mode) {
  const { error } = await deleteExpense(id, mode);
  if (error) { showToast('Erro ao excluir: ' + error.message); return; }
  showToast('Gasto excluído', 'success');
  renderHistorico();
  if (window.appState.currentView === 'home') renderHome();
}

// ── Footer Saldo ──────────────────────────────────────────────

function renderHistFooter(expenses, budgetData) {
  const footer = document.getElementById('hist-footer');
  if (expenses.length === 0) { footer.hidden = true; return; }

  const total   = expenses.reduce((s, e) => s + parseFloat(e.amount), 0);
  const budget  = budgetData.amount;
  const saldo   = budget - total;
  const pctVal  = budget > 0 ? clamp((saldo / budget) * 100, 0, 100) : 0;
  const isPos   = saldo >= 0;

  footer.hidden = false;
  document.getElementById('hist-footer-label').textContent =
    `SALDO · ${monthName(_histMonth, true).toUpperCase()}`;
  document.getElementById('hist-footer-val').textContent = formatCurrency(saldo);
  document.getElementById('hist-footer-val').style.color = isPos ? 'var(--primary-soft)' : 'var(--danger)';
  document.getElementById('hist-footer-pct').textContent = `${pctVal.toFixed(0)}% do orçamento`;

  const bar = document.getElementById('hist-footer-bar');
  bar.style.width      = pctVal + '%';
  bar.style.background = isPos ? 'var(--primary)' : 'var(--danger)';
}
