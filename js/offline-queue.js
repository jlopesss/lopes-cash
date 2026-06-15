// ── IndexedDB offline queue para gastos pendentes ────────────

const _OQ_DB_NAME    = 'lopes-cash-offline';
const _OQ_DB_VERSION = 1;
const _OQ_STORE      = 'pending-expenses';

let _oqDb = null;

async function _openOfflineDB() {
  if (_oqDb) return _oqDb;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(_OQ_DB_NAME, _OQ_DB_VERSION);
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore(_OQ_STORE, { autoIncrement: true });
    };
    req.onsuccess = e => { _oqDb = e.target.result; resolve(_oqDb); };
    req.onerror   = () => reject(req.error);
  });
}

// ── Adicionar à fila ──────────────────────────────────────────

async function queueExpense(data) {
  const db = await _openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(_OQ_STORE, 'readwrite');
    const req = tx.objectStore(_OQ_STORE).add({
      ...data,
      _user_id: window.appState?.user?.id,
      _queued:  Date.now(),
    });
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

// ── Leitura interna com cursors (retorna chave + valor) ───────

async function _getPendingExpenses() {
  const db = await _openOfflineDB();
  return new Promise((resolve, reject) => {
    const items = [];
    const tx    = db.transaction(_OQ_STORE, 'readonly');
    const req   = tx.objectStore(_OQ_STORE).openCursor();
    req.onsuccess = e => {
      const cursor = e.target.result;
      if (cursor) {
        items.push({ _key: cursor.key, ...cursor.value });
        cursor.continue();
      } else {
        resolve(items);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

async function _removeQueuedExpense(key) {
  const db = await _openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(_OQ_STORE, 'readwrite');
    const req = tx.objectStore(_OQ_STORE).delete(key);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

// ── Contagem pública (usada pelo banner) ──────────────────────

async function getPendingCount() {
  const db = await _openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(_OQ_STORE, 'readonly');
    const req = tx.objectStore(_OQ_STORE).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

// ── Sincronizar ao voltar online ──────────────────────────────

async function syncPendingExpenses() {
  if (!navigator.onLine) return;

  const pending = await _getPendingExpenses();
  if (pending.length === 0) return;

  let synced = 0;
  for (const item of pending) {
    const { _key, _user_id, _queued, ...expenseData } = item;
    const { error } = await addExpense(expenseData);
    if (!error) {
      await _removeQueuedExpense(_key);
      synced++;
    }
  }

  if (synced > 0) {
    const pl = synced > 1;
    showToast(
      `${synced} gasto${pl ? 's' : ''} sincronizado${pl ? 's' : ''}!`,
      'success'
    );
    const view = window.appState?.currentView;
    if (view === 'home')      renderHome();
    if (view === 'historico') renderHistorico();
  }
}
