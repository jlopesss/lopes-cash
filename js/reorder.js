// ── Reordenar listas arrastando ───────────────────────────────
//
// Arrasto por alça (`[data-drag-handle]`), não pelo item inteiro: o toque no
// corpo do item continua sendo seleção normal.
//
// initReorder(container, itemSelector, onReorder)
//   container    — elemento que contém os itens
//   itemSelector — seletor dos itens arrastáveis, cada um com data-* de id
//   onReorder    — recebe o array de ids na nova ordem; só é chamado se mudou
//
// Reaplicar em um container já inicializado é seguro: o listener antigo é
// removido antes (os pickers re-renderizam o innerHTML a cada abertura).

const _reorderCleanups = new WeakMap();

function _itemId(el) {
  return el.dataset.catRow || el.dataset.subId || el.dataset.id;
}

function initReorder(container, itemSelector, onReorder) {
  const prev = _reorderCleanups.get(container);
  if (prev) prev();

  const onStart = e => {
    const handle = e.target.closest('[data-drag-handle]');
    if (!handle) return;
    const item = handle.closest(itemSelector);
    if (!item) return;
    e.preventDefault();
    _startDrag({ container, itemSelector, item, onReorder, startEvent: e });
  };

  container.addEventListener('pointerdown', onStart);
  _reorderCleanups.set(container, () => container.removeEventListener('pointerdown', onStart));
}

function _startDrag({ container, itemSelector, item, onReorder, startEvent }) {
  const items = Array.from(container.querySelectorAll(itemSelector));
  if (items.length < 2) return;

  const idsBefore = items.map(_itemId);
  const startY    = startEvent.clientY;

  // Alturas fixas medidas antes de qualquer transformação, para calcular os
  // deslocamentos sem depender do layout durante o arrasto.
  const rects  = items.map(el => el.getBoundingClientRect());
  const height = rects[0].height;
  const gap    = rects.length > 1 ? Math.max(rects[1].top - rects[0].bottom, 0) : 0;
  const stride = height + gap;

  let fromIndex = items.indexOf(item);
  let toIndex   = fromIndex;

  item.classList.add('dragging');
  document.body.classList.add('reordering');

  const onMove = ev => {
    const delta = ev.clientY - startY;
    item.style.transform = `translateY(${delta}px)`;

    const shift    = Math.round(delta / stride);
    const newIndex = Math.max(0, Math.min(items.length - 1, fromIndex + shift));
    if (newIndex === toIndex) return;
    toIndex = newIndex;

    // Desloca visualmente os itens entre a origem e o destino.
    items.forEach((el, i) => {
      if (el === item) return;
      let offset = 0;
      if (fromIndex < toIndex && i > fromIndex && i <= toIndex) offset = -stride;
      if (fromIndex > toIndex && i < fromIndex && i >= toIndex) offset = stride;
      el.style.transform  = offset ? `translateY(${offset}px)` : '';
      el.style.transition = 'transform 160ms ease';
    });
  };

  const onEnd = async () => {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onEnd);
    document.removeEventListener('pointercancel', onEnd);

    items.forEach(el => { el.style.transform = ''; el.style.transition = ''; });
    item.classList.remove('dragging');
    document.body.classList.remove('reordering');

    if (toIndex === fromIndex) return;

    // Reordena o DOM na hora para não piscar enquanto o banco responde.
    const reordered = items.slice();
    reordered.splice(toIndex, 0, reordered.splice(fromIndex, 1)[0]);
    reordered.forEach(el => container.appendChild(el));

    const idsAfter = reordered.map(_itemId);
    if (idsAfter.join() === idsBefore.join()) return;

    try {
      await onReorder(idsAfter);
    } catch (err) {
      showToast('Não foi possível salvar a nova ordem.');
    }
  };

  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onEnd);
  document.addEventListener('pointercancel', onEnd);
}
