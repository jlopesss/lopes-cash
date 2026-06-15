// ── Renderização da Home ─────────────────────────────────────

async function renderHome() {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth() + 1;

  // Atualiza saudação e mês
  const profile = window.appState.profile;
  document.querySelector('.greeting').textContent    = `Olá, ${profile?.name || 'você'}`;
  document.querySelector('.month-label').textContent = currentMonthYear();

  // Mostra skeletons nos valores enquanto carrega
  applySkeletons(true);

  // Busca dados em paralelo
  const prev = prevMonth(year, month);
  const [budgetData, spent, lastExpenses, daily, prevSpent] = await Promise.all([
    getBudgetForMonth(year, month),
    getMonthTotal(year, month),
    getLastExpenses(5),
    getDailyCumulative(year, month),
    getMonthTotal(prev.year, prev.month),
  ]);

  applySkeletons(false);

  const budget   = budgetData.amount;
  const balance  = budget - spent;
  const daysLeft = daysRemainingInMonth();
  const totalDays = daysInMonth(year, month);

  renderHeroCard({ budget, spent, balance, daysLeft, totalDays, prevSpent });
  renderTrendChart(daily, budget, totalDays, now.getDate());
  renderLastExpenses(lastExpenses);
}

// ── Hero Card ────────────────────────────────────────────────

function renderHeroCard({ budget, spent, balance, daysLeft, totalDays, prevSpent }) {
  // Saldo grande
  const { integer, cents } = splitCurrency(balance);
  document.getElementById('hero-amount').textContent = integer;
  document.getElementById('hero-cents').textContent  = cents;
  document.getElementById('hero-amount').style.color =
    balance < 0 ? 'var(--danger)' : 'var(--text-primary)';

  // Barra de progresso
  const usedPct = budget > 0 ? clamp((spent / budget) * 100, 0, 100) : 0;
  const fill    = document.getElementById('progress-fill');
  fill.style.width = usedPct + '%';
  fill.classList.toggle('danger', spent > budget);

  document.getElementById('progress-used').textContent =
    `${usedPct.toFixed(1).replace('.', ',')}% usado`;
  document.getElementById('progress-days').textContent =
    `${daysLeft} dia${daysLeft !== 1 ? 's' : ''} restante${daysLeft !== 1 ? 's' : ''}`;

  // Grid 3 colunas
  document.getElementById('budget-val').textContent = formatCurrency(budget);
  const spentEl   = document.getElementById('spent-val');
  spentEl.textContent   = formatCurrency(spent);

  const saldoEl   = document.getElementById('saldo-val');
  saldoEl.textContent   = formatCurrency(Math.abs(balance));
  saldoEl.className     = 'hero-grid-val num ' + (balance < 0 ? 'danger' : 'success');

  // Delta pill (só mostra se tem dado do mês anterior)
  const deltaPill = document.getElementById('delta-pill');
  if (prevSpent > 0 && budget > 0) {
    const diffPct = pct(prevSpent - spent, prevSpent);
    const isBelow = spent <= prevSpent;
    deltaPill.className = 'delta-pill' + (isBelow ? '' : ' danger');
    document.getElementById('delta-icon').textContent = isBelow ? '↑' : '↓';
    const now2 = new Date();
    const pm   = prevMonth(now2.getFullYear(), now2.getMonth() + 1);
    document.getElementById('delta-text').textContent =
      `${Math.abs(diffPct).toFixed(0)}% ${isBelow ? 'abaixo' : 'acima'} de ${monthName(pm.month, true)}`;
    const dailyLeft = daysLeft > 0 ? balance / daysLeft : 0;
    document.getElementById('delta-daily').textContent = `${formatCurrency(Math.max(dailyLeft, 0))}/dia`;
    deltaPill.hidden = false;
  } else {
    deltaPill.hidden = true;
  }
}

// ── Trend Chart ──────────────────────────────────────────────

function renderTrendChart(daily, budget, totalDays, today) {
  const svg = document.getElementById('trend-chart');
  const W = 260, H = 70, pX = 2, pY = 4;
  const chartW = W - pX * 2;
  const budgetY = pY + 1;
  const zeroY   = H - pY;

  const xOf = day => pX + ((day - 0.5) / totalDays) * chartW;
  const yOf = val => {
    if (budget <= 0) return zeroY;
    return zeroY - clamp(val / budget, 0, 1.1) * (zeroY - budgetY);
  };

  // Monta pontos acumulados por dia
  const points = [];
  if (daily.length > 0) {
    let cursor = 0;
    let cum = 0;
    for (let day = 1; day <= today; day++) {
      if (cursor < daily.length && daily[cursor].day === day) {
        cum = daily[cursor].cumulative;
        cursor++;
      }
      if (cum > 0 || points.length > 0) {
        points.push({ x: xOf(day), y: yOf(cum) });
      }
    }
  }

  const lineStr = points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaPath = points.length > 1
    ? `M${points[0].x},${zeroY} L${lineStr} L${points[points.length-1].x},${zeroY}Z`
    : '';

  const dot = points.length > 0 ? points[points.length - 1] : null;

  svg.innerHTML = `
    <defs>
      <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="rgba(91,140,255,0.45)"/>
        <stop offset="100%" stop-color="rgba(91,140,255,0)"/>
      </linearGradient>
    </defs>
    ${budget > 0 ? `<line x1="${pX}" y1="${budgetY}" x2="${W-pX}" y2="${budgetY}"
      stroke="#39E0A0" stroke-width="1" stroke-dasharray="3 3" opacity="0.4"/>` : ''}
    ${areaPath ? `<path d="${areaPath}" fill="url(#area-grad)"/>` : ''}
    ${points.length > 1 ? `<polyline points="${lineStr}" fill="none"
      stroke="#5B8CFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>` : ''}
    ${dot ? `<circle cx="${dot.x.toFixed(1)}" cy="${dot.y.toFixed(1)}"
      r="3" fill="#5B8CFF" stroke="#0B1220" stroke-width="2"/>` : ''}
  `;

  // Labels eixo X
  const xaxis = document.getElementById('trend-xaxis');
  const todayLabel = today <= totalDays ? `<span class="today-label">hoje</span>` : '';
  xaxis.innerHTML = `<span>1</span><span>10</span>${todayLabel}<span>${totalDays}</span>`;
}

// ── Lista de Últimos Gastos ──────────────────────────────────

function renderLastExpenses(expenses) {
  const list   = document.getElementById('expenses-list');
  const empty  = document.getElementById('empty-state');

  if (expenses.length === 0) {
    list.innerHTML = '';
    empty.hidden   = false;
    return;
  }

  empty.hidden   = true;
  list.innerHTML = expenses.map(e => buildExpenseItem(e)).join('');
}

function buildExpenseItem(e) {
  const cat    = e.categories;
  const color  = cat?.color || '#6B7A92';
  const emoji  = cat?.emoji || '📦';
  const name   = e.description || cat?.name || 'Gasto';
  const subcat = e.subcategories?.name ? `${e.subcategories.name} · ` : (cat?.name ? `${cat.name} · ` : '');
  const rel    = relativeDate(e.date);
  const time   = formatTime(e.time);
  const instTag = e.installment_total > 1
    ? `<span class="installment-tag">${e.installment_number}/${e.installment_total}</span>` : '';

  return `
    <div class="expense-item" data-id="${e.id}">
      <div class="expense-icon" style="background:${color}22">
        <span>${emoji}</span>
      </div>
      <div class="expense-info">
        <div class="expense-name">${escHtml(name)} ${instTag}</div>
        <div class="expense-sub">${escHtml(subcat)}${rel}${time ? ' · ' + time : ''}</div>
      </div>
      <div class="expense-amount num">-${formatCurrency(e.amount)}</div>
    </div>
  `;
}

function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Skeletons ────────────────────────────────────────────────

function applySkeletons(on) {
  const els = ['hero-amount','hero-cents','budget-val','spent-val','saldo-val',
                'progress-used','progress-days'];
  els.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('skeleton', on);
  });
}

// ── Quick Edit Budget ────────────────────────────────────────

async function openBudgetModal() {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth() + 1;
  const { amount } = await getBudgetForMonth(year, month);

  const modal = document.getElementById('budget-modal');
  document.getElementById('budget-modal-title').textContent =
    `Orçamento de ${monthName(month)}`;
  document.getElementById('budget-modal-input').value = amount > 0 ? amount : '';
  modal.hidden = false;
  setTimeout(() => document.getElementById('budget-modal-input').focus(), 100);
}

async function saveBudget() {
  const input  = document.getElementById('budget-modal-input');
  const amount = parseFloat(input.value.replace(',', '.'));
  if (isNaN(amount) || amount < 0) {
    showToast('Valor inválido');
    return;
  }
  const btn = document.getElementById('save-budget-btn');
  btn.disabled = true;

  const now  = new Date();
  const { error } = await setMonthlyBudget(now.getFullYear(), now.getMonth() + 1, amount);

  btn.disabled = false;
  if (error) { showToast('Erro ao salvar: ' + error.message); return; }

  document.getElementById('budget-modal').hidden = true;
  renderHome();
}
