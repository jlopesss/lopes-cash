// ── Estado do modal ──────────────────────────────────────────

let _selectedCat     = null;
let _selectedSubcat  = null;
let _installments    = 1;
let _editId          = null;
let _numpadRaw       = '';
let _numpadOpenTimer = null;
// 'cat' | 'sub' — o mesmo #cat-picker serve as duas listas; o botão "Nova" precisa
// saber qual delas está na tela para criar a coisa certa.
let _pickerMode      = 'cat';

// ── Abrir / Fechar ───────────────────────────────────────────

function openExpenseModal(expenseId = null) {
  _editId         = expenseId;
  _selectedCat    = null;
  _selectedSubcat = null;
  _installments   = 1;

  const modal = document.getElementById('expense-modal');
  modal.hidden = false;
  _modalOpen();

  // Data/hora atual no header
  const now = new Date();
  document.getElementById('expense-datetime').textContent =
    `${now.getDate()} ${monthName(now.getMonth() + 1, true)} · ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

  // Reset campos
  document.getElementById('expense-amount').value = '';
  if (!expenseId) _numpadOpenTimer = setTimeout(openNumpad, 120);
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
  clearTimeout(_numpadOpenTimer);
  document.getElementById('expense-modal').hidden = true;
  _modalClose();
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
  if (document.getElementById('expense-modal').hidden) return;
  _numpadRaw = document.getElementById('expense-amount').value.trim() || '';
  _syncNumpadDisplay();
  document.getElementById('numpad-modal').hidden = false;
  _modalOpen();
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
  _modalClose();
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

// ── Calendário customizado ───────────────────────────────────

let _calYear, _calMonth, _calSelected;

function openDatePicker() {
  const current = document.getElementById('expense-date').value || todayISO();
  _calSelected = current;
  [_calYear, _calMonth] = current.split('-').map(Number);

  renderCalendar();
  document.getElementById('date-picker-modal').hidden = false;
  _modalOpen();
}

function closeDatePicker() {
  document.getElementById('date-picker-modal').hidden = true;
  _modalClose();
}

function changeCalMonth(delta) {
  _calMonth += delta;
  if (_calMonth < 1)  { _calMonth = 12; _calYear--; }
  if (_calMonth > 12) { _calMonth = 1;  _calYear++; }
  renderCalendar();
}

function selectCalDay(day) {
  _calSelected = isoDate(_calYear, _calMonth, day);
  renderCalendar();
}

function confirmCalDate() {
  setDateField(_calSelected);
  closeDatePicker();
}

function renderCalendar() {
  document.getElementById('date-cal-label').textContent =
    `${monthName(_calMonth)} · ${_calYear}`;

  const today      = todayISO();
  const total      = daysInMonth(_calYear, _calMonth);
  const firstDow   = new Date(_calYear, _calMonth - 1, 1).getDay();

  const cells = [];
  for (let i = 0; i < firstDow; i++) {
    cells.push('<span class="date-cal-day date-cal-empty"></span>');
  }
  for (let day = 1; day <= total; day++) {
    const iso = isoDate(_calYear, _calMonth, day);
    const cls = ['date-cal-day'];
    if (iso === today) cls.push('date-cal-today');
    if (iso === _calSelected) cls.push('date-cal-selected');
    cells.push(`<button class="${cls.join(' ')}" data-day="${day}">${day}</button>`);
  }

  document.getElementById('date-cal-grid').innerHTML = cells.join('');
}

// ── Seleção de categoria ─────────────────────────────────────

function openCategoryPicker() {
  const cats    = window.appState.categories;
  const list    = document.getElementById('picker-list');
  const picker  = document.getElementById('cat-picker');
  const wasHidden = picker.hidden;

  document.getElementById('picker-back').hidden = true;

  list.innerHTML = cats.map(cat => `
    <div class="picker-item-row" data-cat-row="${cat.id}">
      <span class="drag-handle" data-drag-handle aria-label="Reordenar">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor"
             stroke-width="1.6" stroke-linecap="round">
          <path d="M1 3h10M1 6h10M1 9h10"/>
        </svg>
      </span>
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

  _pickerMode = 'cat';
  document.getElementById('picker-title').textContent = 'Categoria';
  document.getElementById('picker-add-cat-btn').hidden = false;
  document.getElementById('picker-add-cat-btn').setAttribute('aria-label', 'Nova categoria');
  picker.hidden = false;
  if (wasHidden) _modalOpen();

  initReorder(list, '[data-cat-row]', async orderedIds => {
    window.appState.categories = orderedIds
      .map(id => cats.find(c => c.id === id))
      .filter(Boolean);
    await persistCategoryOrder(window.appState.categories);
  });
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
  const hasSubcats = !!(cat.subcategories && cat.subcategories.length);
  // Sempre habilitado: mesmo sem subcategorias, o picker permite criar a primeira.
  document.getElementById('subcat-btn').disabled = false;

  if (closePicker) {
    if (hasSubcats) {
      openSubcategoryPicker();
    } else {
      document.getElementById('cat-picker').hidden = true;
      _modalClose();
    }
  }
}

// ── Seleção de subcategoria ──────────────────────────────────

function openSubcategoryPicker() {
  if (!_selectedCat) return;

  const picker  = document.getElementById('cat-picker');
  const wasHidden = picker.hidden;

  document.getElementById('picker-back').hidden = false;

  const subs = _selectedCat.subcategories || [];
  const list = document.getElementById('picker-list');

  list.innerHTML = subs.length === 0
    ? '<div class="picker-empty">Nenhuma subcategoria ainda.<br>Toque em “Nova” para criar.</div>'
    : subs.map(sub => `
        <div class="picker-item-row" data-sub-id="${sub.id}">
          <span class="drag-handle" data-drag-handle aria-label="Reordenar">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor"
                 stroke-width="1.6" stroke-linecap="round">
              <path d="M1 3h10M1 6h10M1 9h10"/>
            </svg>
          </span>
          <button class="picker-item" onclick="selectSubcategory('${sub.id}')">
            <span class="picker-item-name">${escHtml(sub.name)}</span>
            ${_selectedSubcat?.id === sub.id
              ? `<svg class="picker-item-check" viewBox="0 0 16 16" fill="none">
                   <path d="M3 8l4 4 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                 </svg>` : ''}
          </button>
          <button class="picker-edit-btn" onclick="openSubcatEditModal('${sub.id}')"
                  aria-label="Editar subcategoria">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor"
                 stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11.5 2.5l2 2L5 13H3v-2L11.5 2.5z"/>
            </svg>
          </button>
        </div>
      `).join('');

  _pickerMode = 'sub';
  document.getElementById('picker-title').textContent = 'Subcategoria';
  document.getElementById('picker-add-cat-btn').hidden = false;
  document.getElementById('picker-add-cat-btn').setAttribute('aria-label', 'Nova subcategoria');
  picker.hidden = false;
  if (wasHidden) _modalOpen();

  initReorder(list, '[data-sub-id]', async orderedIds => {
    _selectedCat.subcategories = orderedIds
      .map(id => subs.find(s => s.id === id))
      .filter(Boolean);
    await persistSubcategoryOrder(_selectedCat.subcategories);
  });
}

// ── Nova / editar subcategoria (a partir do picker) ──────────
// Mesmo modal para os dois casos, espelhando openCatEditModal:
// null cria, um id renomeia.

let _editSubId = null;

function openSubcatEditModal(subId = null) {
  if (!_selectedCat) return;
  const sub = subId ? (_selectedCat.subcategories || []).find(s => s.id === subId) : null;
  _editSubId = subId;

  document.getElementById('subcat-edit-header').textContent =
    sub ? 'Editar subcategoria' : `Nova subcategoria em ${_selectedCat.name}`;
  document.getElementById('subcat-edit-input').value = sub?.name || '';
  document.getElementById('subcat-edit-delete-btn').hidden = !sub;
  document.getElementById('subcat-edit-modal').hidden = false;
  _modalOpen();
  setTimeout(() => document.getElementById('subcat-edit-input').focus(), 80);
}

async function deleteSubcatEdit() {
  if (!_editSubId || !_selectedCat) return;
  const subId = _editSubId;
  const sub   = (_selectedCat.subcategories || []).find(s => s.id === subId);

  showConfirm(
    `Excluir "${sub?.name || 'esta subcategoria'}"?`,
    'Sim, excluir',
    null,
    async () => {
      if (!await deleteSubcategoryGuarded(subId)) return;

      const stateCat = window.appState.categories.find(c => c.id === _selectedCat.id);
      [_selectedCat, stateCat]
        .filter((c, i, arr) => c && arr.indexOf(c) === i)
        .forEach(c => {
          c.subcategories = (c.subcategories || []).filter(s => s.id !== subId);
        });

      // O gasto em edição pode estar apontando para a subcategoria excluída.
      if (_selectedSubcat?.id === subId) {
        _selectedSubcat = null;
        document.getElementById('subcat-value').textContent = '—';
      }

      closeSubcatEditModal();
      openSubcategoryPicker();
      showToast('Subcategoria excluída.', 'success');
    },
    null
  );
}

function closeSubcatEditModal() {
  document.getElementById('subcat-edit-modal').hidden = true;
  _editSubId = null;
  // O picker continua aberto atrás; não liberar o scroll do body ainda.
  if (document.getElementById('cat-picker').hidden) _modalClose();
}

async function saveSubcatEdit() {
  const name = document.getElementById('subcat-edit-input').value.trim();
  if (!name) { showToast('Informe o nome da subcategoria.'); return; }
  if (!_selectedCat) return;

  const btn = document.getElementById('save-subcat-edit-btn');
  btn.disabled = true;

  // A mesma categoria pode estar em dois objetos (o selecionado e o do
  // appState); atualiza os dois para não precisar refazer o fetch.
  const stateCat = window.appState.categories.find(c => c.id === _selectedCat.id);
  const catsToSync = [_selectedCat, stateCat].filter((c, i, arr) => c && arr.indexOf(c) === i);

  if (_editSubId) {
    const { error } = await updateSubcategory(_editSubId, { name });
    btn.disabled = false;
    if (error) { showToast('Erro ao salvar: ' + error.message); return; }

    catsToSync.forEach(c => {
      const s = (c.subcategories || []).find(s => s.id === _editSubId);
      if (s) s.name = name;
    });
    if (_selectedSubcat?.id === _editSubId) {
      _selectedSubcat.name = name;
      document.getElementById('subcat-value').textContent = name;
    }
    closeSubcatEditModal();
    openSubcategoryPicker();
    showToast('Subcategoria atualizada!', 'success');
    return;
  }

  const { data, error } = await insertSubcategory(_selectedCat.id, name);
  btn.disabled = false;
  if (error) { showToast('Erro ao criar: ' + error.message); return; }

  catsToSync.forEach(c => {
    c.subcategories = c.subcategories || [];
    c.subcategories.push({ id: data.id, name });
  });

  closeSubcatEditModal();
  document.getElementById('subcat-btn').disabled = false;
  openSubcategoryPicker();
  showToast('Subcategoria criada!', 'success');
}

function selectSubcategory(subId, subObj = null) {
  const subs = _selectedCat?.subcategories || [];
  const sub  = subObj || subs.find(s => s.id === subId);
  if (!sub) return;

  _selectedSubcat = sub;
  document.getElementById('subcat-value').textContent = sub.name;
  document.getElementById('cat-picker').hidden = true;
  _modalClose();
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
