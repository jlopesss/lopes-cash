// ── Estado do modal ──────────────────────────────────────────

let _selectedCat    = null;
let _selectedSubcat = null;
let _installments   = 1;
let _editId         = null;
let _numpadRaw      = '';

// ── Abrir / Fechar ───────────────────────────────────────────

function openExpenseModal(expenseId = null) {
  _editId         = expenseId;
  _selectedCat    = null;
  _selectedSubcat = null;
  _installments   = 1;

  const modal = document.getElementById('expense-modal');
  modal.hidden = false;

  // Data/hora atual no header
  const now = new Date();
  document.getElementById('expense-datetime').textContent =
    `${now.getDate()} ${monthName(now.getMonth() + 1, true)} · ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

  // Reset campos
  document.getElementById('expense-amount').value = '';
  if (!expenseId) setTimeout(openNumpad, 120);
  document.getElementById('cat-value').textContent    = 'Selecionar';
  document.getElementById('cat-value').classList.add('placeholder');
  document.getElementById('subcat-value').textContent = '—';
  document.getElementById('subcat-btn').disabled = true;
  setDateField(todayISO());
  document.getElementById('expense-desc').value   = '';
  document.getElementById('installment-check').checked = false;
  document.getElementById('installment-detail').hidden = true;
  document.getElementById('inst-badge').hidden = true;
  document.getElementById('inst-count').textContent = '2';
  _installments = 1;

  document.getElementById('expense-modal-title').textContent =
    expenseId ? 'Editar gasto' : 'Novo gasto';

  if (expenseId) loadExpenseForEdit(expenseId);
}

function closeExpenseModal() {
  document.getElementById('expense-modal').hidden = true;
}

// ── Pré-carrega para edição ──────────────────────────────────

async function loadExpenseForEdit(id) {
  const { data } = await supabase
    .from('expenses')
    .select('*, categories(id,name,emoji,color), subcategories(id,name)')
    .eq('id', id)
    .single();
  if (!data) return;

  document.getElementById('expense-amount').value =
    String(data.amount).replace('.', ',');

  setDateField(data.date);
  document.getElementById('expense-desc').value = data.description || '';

  if (data.categories) {
    selectCategory(data.categories.id, data.categories, false);
  }
  if (data.subcategories) {
    selectSubcategory(data.subcategories.id, data.subcategories);
  }
  if (data.installment_total > 1) {
    _installments = data.installment_total;
    document.getElementById('installment-check').checked = true;
    document.getElementById('inst-count').textContent = _installments;
    document.getElementById('installment-detail').hidden = false;
    document.getElementById('inst-badge').hidden = false;
    updateInstBadge();
    updateInstPreview();
  }
}

// ── Numpad ───────────────────────────────────────────────────

function openNumpad() {
  _numpadRaw = document.getElementById('expense-amount').value.trim() || '';
  _syncNumpadDisplay();
  document.getElementById('numpad-modal').hidden = false;
}

function _syncNumpadDisplay() {
  const el = document.getElementById('numpad-value');
  el.textContent = _numpadRaw || '0';
  el.classList.toggle('numpad-empty', !_numpadRaw);
}

function numpadPress(key) {
  if (key === '⌫') {
    _numpadRaw = _numpadRaw.slice(0, -1);
  } else if (key === ',') {
    if (!_numpadRaw.includes(',')) _numpadRaw = (_numpadRaw || '0') + ',';
  } else {
    const parts = _numpadRaw.split(',');
    if (parts.length > 1 && parts[1].length >= 2) return;
    if (_numpadRaw.length < 12) _numpadRaw += key;
  }
  _syncNumpadDisplay();
}

function numpadOk() {
  const val = _numpadRaw.replace(/,$/, '');
  document.getElementById('expense-amount').value = val;
  document.getElementById('numpad-modal').hidden = true;
  if (_installments > 1) { updateInstBadge(); updateInstPreview(); }
}

// ── Campo de data ────────────────────────────────────────────

function setDateField(isoStr) {
  const [y, m, d] = isoStr.split('-').map(Number);
  const label = `${d} ${monthName(m, true)} · ${y}`;
  document.getElementById('date-value').textContent = label;
  document.getElementById('expense-date').value = isoStr;

  const isToday = isoStr === todayISO();
  document.getElementById('badge-today').hidden = !isToday;
}

// ── Seleção de categoria ─────────────────────────────────────

function openCategoryPicker() {
  const cats = window.appState.categories;
  const list = document.getElementById('picker-list');

  list.innerHTML = cats.map(cat => `
    <div class="picker-item-row">
      <button class="picker-item" data-cat-id="${cat.id}" onclick="selectCategory('${cat.id}')">
        <span class="picker-item-emoji">${cat.emoji}</span>
        <span class="picker-item-name">${escHtml(cat.name)}</span>
        ${_selectedCat?.id === cat.id
          ? `<svg class="picker-item-check" viewBox="0 0 16 16" fill="none">
               <path d="M3 8l4 4 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
             </svg>` : ''}
      </button>
      <button class="picker-edit-btn" onclick="openCatEditModal('${cat.id}')" aria-label="Editar categoria">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor"
             stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11.5 2.5l2 2L5 13H3v-2L11.5 2.5z"/>
        </svg>
      </button>
    </div>
  `).join('');

  document.getElementById('picker-title').textContent = 'Categoria';
  document.getElementById('picker-add-cat-btn').hidden = false;
  document.getElementById('cat-picker').hidden = false;
}

function selectCategory(catId, catObj = null, closePicker = true) {
  const cat = catObj || window.appState.categories.find(c => c.id === catId);
  if (!cat) return;

  _selectedCat = cat;
  _selectedSubcat = null;

  const valEl = document.getElementById('cat-value');
  valEl.textContent = `${cat.emoji} ${cat.name}`;
  valEl.classList.remove('placeholder');

  document.getElementById('subcat-value').textContent = '—';
  const subcatBtn = document.getElementById('subcat-btn');
  subcatBtn.disabled = !cat.subcategories || cat.subcategories.length === 0;

  if (closePicker) document.getElementById('cat-picker').hidden = true;
}

// ── Seleção de subcategoria ──────────────────────────────────

function openSubcategoryPicker() {
  if (!_selectedCat || !_selectedCat.subcategories?.length) return;

  const list = document.getElementById('picker-list');
  list.innerHTML = _selectedCat.subcategories.map(sub => `
    <button class="picker-item" onclick="selectSubcategory('${sub.id}')">
      <span class="picker-item-name">${escHtml(sub.name)}</span>
      ${_selectedSubcat?.id === sub.id
        ? `<svg class="picker-item-check" viewBox="0 0 16 16" fill="none">
             <path d="M3 8l4 4 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
           </svg>` : ''}
    </button>
  `).join('');

  document.getElementById('picker-title').textContent = 'Subcategoria';
  document.getElementById('picker-add-cat-btn').hidden = true;
  document.getElementById('cat-picker').hidden = false;
}

function selectSubcategory(subId, subObj = null) {
  const subs = _selectedCat?.subcategories || [];
  const sub  = subObj || subs.find(s => s.id === subId);
  if (!sub) return;

  _selectedSubcat = sub;
  document.getElementById('subcat-value').textContent = sub.name;
  document.getElementById('cat-picker').hidden = true;
}

// ── Parcelas ─────────────────────────────────────────────────

function toggleInstallments(checked) {
  document.getElementById('installment-detail').hidden = !checked;
  document.getElementById('inst-badge').hidden = !checked;
  if (checked) {
    _installments = 2;
    document.getElementById('inst-count').textContent = 2;
    updateInstBadge();
    updateInstPreview();
  } else {
    _installments = 1;
  }
}

function changeInstallments(delta) {
  _installments = clamp(_installments + delta, 2, 24);
  document.getElementById('inst-count').textContent = _installments;
  updateInstBadge();
  updateInstPreview();
}

function updateInstBadge() {
  const amount = parseAmount();
  const badge  = document.getElementById('inst-badge');
  if (amount > 0 && _installments > 1) {
    badge.textContent = `${_installments}x de ${formatCurrency(amount / _installments)}`;
    badge.hidden = false;
  } else {
    badge.hidden = true;
  }
}

function updateInstPreview() {
  const amount   = parseAmount();
  const dateVal  = document.getElementById('expense-date').value || todayISO();
  const [y, m, d] = dateVal.split('-').map(Number);
  const today = todayISO();

  const partBase = _installments > 1
    ? Math.floor((amount / _installments) * 100) / 100
    : amount;
  const lastPart = amount > 0
    ? Math.round((amount - partBase * (_installments - 1)) * 100) / 100
    : 0;

  const header = document.getElementById('inst-preview-header');
  header.textContent = 'VER PARCELAS';

  const items = [];
  for (let i = 0; i < _installments; i++) {
    const target  = new Date(y, m - 1 + i, d);
    const mo      = target.getMonth() + 1;
    const yr      = target.getFullYear();
    const isoStr  = isoDate(yr, mo, target.getDate());
    const isCurrent = isoStr.slice(0,7) >= today.slice(0,7);
    const isFirst   = i === 0;
    const partAmt   = i < _installments - 1 ? partBase : lastPart;

    items.push(`
      <div class="inst-preview-item ${isFirst ? 'current' : ''}">
        <div class="inst-num-box num">${i + 1}</div>
        <div class="inst-preview-month">${monthName(mo, true)} · ${yr}</div>
        ${isFirst ? '<span class="badge-atual">atual</span>' : ''}
        <div class="inst-preview-amount num">${amount > 0 ? formatCurrency(partAmt) : '—'}</div>
      </div>
    `);
  }

  document.getElementById('installment-preview').innerHTML = items.join('');
}

// ── Salvar / Editar ──────────────────────────────────────────

function parseAmount() {
  const raw = document.getElementById('expense-amount').value
    .replace(/\./g, '').replace(',', '.');
  return parseFloat(raw) || 0;
}

function buildExpenseFields() {
  return {
    amount:         parseAmount(),
    category_id:    _selectedCat?.id || null,
    subcategory_id: _selectedSubcat?.id || null,
    date:           document.getElementById('expense-date').value || todayISO(),
    description:    document.getElementById('expense-desc').value.trim() || null,
  };
}

async function saveExpense() {
  const fields = buildExpenseFields();
  if (fields.amount <= 0) {
    showToast('Informe um valor válido');
    document.getElementById('expense-amount').focus();
    return;
  }
  if (!fields.category_id) {
    showToast('Selecione uma categoria');
    return;
  }

  const btn = document.getElementById('save-expense-btn');
  btn.disabled = true;

  if (_editId) {
    const existing = await getExpenseInstallmentInfo(_editId);
    btn.disabled = false;

    if (existing?.installment_total > 1 && existing?.installment_group_id) {
      showConfirm(
        'Esta é uma compra parcelada.',
        'Editar só esta parcela',
        'Editar todas as parcelas',
        () => doEditSave(fields, 'single'),
        () => doEditSave(fields, 'all')
      );
    } else {
      doEditSave(fields, 'single');
    }
    return;
  }

  // Novo gasto — aceita offline via IndexedDB queue
  const installments = document.getElementById('installment-check').checked ? _installments : 1;
  const expData = { ...fields, installments };

  if (!navigator.onLine) {
    await queueExpense(expData);
    btn.disabled = false;
    closeExpenseModal();
    showToast('Salvo localmente — sincronizará quando voltar online.', 'success');
    return;
  }

  const { error } = await addExpense(expData);
  btn.disabled = false;

  if (error) { showToast('Erro ao salvar: ' + error.message); return; }
  closeExpenseModal();
  showToast('Gasto salvo!', 'success');
  afterExpenseSave();
}

async function doEditSave(fields, mode) {
  const { error } = await updateExpense(_editId, fields, mode);
  if (error) { showToast('Erro ao salvar: ' + error.message); return; }
  closeExpenseModal();
  showToast('Gasto atualizado!', 'success');
  afterExpenseSave();
}

function afterExpenseSave() {
  const view = window.appState.currentView;
  if (view === 'home')      renderHome();
  if (view === 'historico') renderHistorico();
}
