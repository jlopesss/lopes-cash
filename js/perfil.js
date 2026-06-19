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

// ── Editar nome ───────────────────────────────────────────────

function initEditName() {
  document.getElementById('edit-name-btn').addEventListener('click', () => {
    document.getElementById('name-edit-input').value = window.appState.profile?.name || '';
    document.getElementById('name-edit-modal').hidden = false;
    setTimeout(() => document.getElementById('name-edit-input').focus(), 80);
  });

  document.getElementById('name-edit-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) e.currentTarget.hidden = true;
  });

  document.getElementById('save-name-btn').addEventListener('click', async () => {
    const name = document.getElementById('name-edit-input').value.trim();
    if (!name) { showToast('Informe seu nome.'); return; }
    const { error } = await updateProfile({ name });
    if (error) { showToast('Erro ao salvar.'); return; }
    window.appState.profile.name = name;
    document.getElementById('name-edit-modal').hidden = true;
    renderPerfil();
    showToast('Nome atualizado!', 'success');
  });
}

// ── Categorias ────────────────────────────────────────────────

const _CAT_COLORS = [
  '#5B8CFF','#A78BFA','#3DB8FF','#F472B6','#39E0A0',
  '#FF9F40','#7BA3FF','#FFB84D','#FF7C99','#8B5CF6',
  '#C77DFF','#6B7A92','#FF5470','#22D3EE','#F59E0B',
];

let _editCatId    = null;
let _editCatColor = _CAT_COLORS[0];

async function renderCategorias() {
  const cats = await getCategories();
  window.appState.categories = cats;

  const html = cats.map(cat => `
    <button class="cat-manage-item" data-cat-id="${cat.id}">
      <div class="cat-manage-icon" style="background:${cat.color}22">
        <span>${cat.emoji}</span>
      </div>
      <div class="cat-manage-info">
        <div class="cat-manage-name">${cat.name}</div>
        ${cat.subcategories?.length
          ? `<div class="cat-manage-sub">${cat.subcategories.length} subcategoria${cat.subcategories.length > 1 ? 's' : ''}</div>`
          : ''}
      </div>
      <svg width="7" height="12" viewBox="0 0 7 12" fill="none"
           stroke="var(--text-dim)" stroke-width="1.5" stroke-linecap="round">
        <path d="M1 1l5 5-5 5"/>
      </svg>
    </button>
  `).join('');

  document.getElementById('cat-manage-list').innerHTML = html;
}

function _renderCatColorGrid() {
  document.getElementById('cat-color-grid').innerHTML = _CAT_COLORS.map(c => `
    <button class="cat-color-swatch ${c === _editCatColor ? 'active' : ''}"
            style="background:${c}" data-color="${c}" aria-label="${c}"></button>
  `).join('');
}

function openCatEditModal(catId = null) {
  const cat     = catId ? window.appState.categories.find(c => c.id === catId) : null;
  _editCatId    = catId;
  _editCatColor = cat?.color || _CAT_COLORS[0];

  document.getElementById('cat-edit-title').textContent       = cat ? 'Editar categoria' : 'Nova categoria';
  document.getElementById('cat-edit-emoji-input').value       = cat?.emoji || '';
  document.getElementById('cat-edit-name-input').value        = cat?.name  || '';
  document.getElementById('cat-edit-preview').textContent     = cat?.emoji || '🏷️';
  document.getElementById('cat-edit-delete-btn').hidden       = !cat;

  _renderCatColorGrid();
  document.getElementById('cat-edit-modal').hidden = false;
  setTimeout(() => document.getElementById('cat-edit-name-input').focus(), 80);
}

async function saveCatEdit() {
  const emoji = document.getElementById('cat-edit-emoji-input').value.trim();
  const name  = document.getElementById('cat-edit-name-input').value.trim();
  if (!name)  { showToast('Informe o nome.');  return; }
  if (!emoji) { showToast('Informe um emoji.'); return; }

  const btn = document.getElementById('cat-edit-save-btn');
  btn.disabled = true;

  const fn = _editCatId
    ? updateCategory(_editCatId, { name, emoji, color: _editCatColor })
    : insertCategory({ name, emoji, color: _editCatColor });

  const { error } = await fn;
  btn.disabled = false;

  if (error) { showToast('Erro: ' + error.message); return; }

  document.getElementById('cat-edit-modal').hidden = true;
  window.appState.categories = await getCategories();
  renderCategorias();
  showToast(_editCatId ? 'Categoria atualizada!' : 'Categoria criada!', 'success');
}

async function deleteCatEdit() {
  if (!confirm('Excluir esta categoria? Gastos vinculados ficam sem categoria.')) return;

  const { error } = await deleteCategory(_editCatId);
  if (error) {
    showToast('Não foi possível excluir.');
    return;
  }
  document.getElementById('cat-edit-modal').hidden = true;
  window.appState.categories = await getCategories();
  renderCategorias();
  showToast('Categoria excluída.', 'success');
}

function initCategorias() {
  document.getElementById('cat-manage-list').addEventListener('click', e => {
    const item = e.target.closest('[data-cat-id]');
    if (item) openCatEditModal(item.dataset.catId);
  });

  document.getElementById('add-cat-btn').addEventListener('click', () => openCatEditModal());

  const modal = document.getElementById('cat-edit-modal');
  modal.addEventListener('click', e => { if (e.target === modal) modal.hidden = true; });
  document.getElementById('cat-edit-close-btn').addEventListener('click', () => { modal.hidden = true; });

  document.getElementById('cat-edit-emoji-input').addEventListener('input', e => {
    document.getElementById('cat-edit-preview').textContent = e.target.value || '🏷️';
  });

  document.getElementById('cat-color-grid').addEventListener('click', e => {
    const sw = e.target.closest('[data-color]');
    if (!sw) return;
    _editCatColor = sw.dataset.color;
    _renderCatColorGrid();
  });

  document.getElementById('cat-edit-save-btn').addEventListener('click', saveCatEdit);
  document.getElementById('cat-edit-delete-btn').addEventListener('click', deleteCatEdit);
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
