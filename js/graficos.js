// ── Estado ───────────────────────────────────────────────────

let _grafYear  = new Date().getFullYear();
let _grafMonth = new Date().getMonth() + 1;

const CIRC = 87.96; // 2π × 14 (donut r=14)

// ── Renderização principal ────────────────────────────────────

async function renderGraficos() {
  updateGrafFilters();

  const [{ breakdown, total, count }, subcatData, yearlyData] = await Promise.all([
    getCategoryBreakdown(_grafYear, _grafMonth),
    getSubcategoryBreakdown(_grafYear, _grafMonth),
    getYearlyData(_grafYear),
  ]);

  renderDonutChart(breakdown, total, count);
  renderSubcatChart(subcatData.breakdown, subcatData.total, subcatData.count);
  renderBarChart(yearlyData);
}

function updateGrafFilters() {
  const periodLabel = `${monthName(_grafMonth, true)} · ${_grafYear}`;
  document.getElementById('graf-month-val').textContent = monthName(_grafMonth, false);
  document.getElementById('graf-year-val').textContent  = _grafYear;
  document.getElementById('donut-period').textContent   = periodLabel;
  document.getElementById('subcat-period').textContent  = periodLabel;
  document.getElementById('bar-title').textContent      = `Por mês · ${_grafYear}`;
}

// ── Seletor de mês (reutiliza cat-picker) ─────────────────────

function openGrafMonthPicker() {
  const list = document.getElementById('picker-list');
  list.innerHTML = MONTHS_LONG.map((name, i) => {
    const m = i + 1;
    return `
      <button class="picker-item" data-graf-month="${m}">
        <span class="picker-item-name">${name}</span>
        ${_grafMonth === m
          ? `<svg class="picker-item-check" viewBox="0 0 16 16" fill="none">
               <path d="M3 8l4 4 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
             </svg>` : ''}
      </button>`;
  }).join('');
  // Este picker é o mesmo #cat-picker das categorias: esconde os controles que
  // só fazem sentido lá, senão "Nova" criaria uma categoria a partir daqui.
  document.getElementById('picker-title').textContent   = 'Selecionar mês';
  document.getElementById('picker-add-cat-btn').hidden  = true;
  document.getElementById('picker-back').hidden         = true;
  document.getElementById('cat-picker').hidden = false;
  _modalOpen();

  // Listener temporário para itens de mês do gráfico
  list.addEventListener('click', function handler(e) {
    const btn = e.target.closest('[data-graf-month]');
    if (!btn) return;
    list.removeEventListener('click', handler);
    _grafMonth = parseInt(btn.dataset.grafMonth);
    document.getElementById('cat-picker').hidden = true;
    _modalClose();
    renderGraficos();
  });
}

function changeGrafYear(delta) {
  _grafYear += delta;
  renderGraficos();
}

function changeGrafMonth(delta) {
  let m = _grafMonth + delta;
  if (m > 12) { m = 1;  _grafYear++; }
  if (m < 1)  { m = 12; _grafYear--; }
  _grafMonth = m;
  renderGraficos();
}

// ── Donut chart ───────────────────────────────────────────────

function renderDonutChart(breakdown, total, count) {
  const svg    = document.getElementById('donut-svg');
  const legend = document.getElementById('donut-legend');
  const layout = document.getElementById('donut-layout');
  const empty  = document.getElementById('donut-empty');

  document.getElementById('donut-amount').textContent =
    total > 0 ? formatCurrency(total) : 'R$ 0,00';
  document.getElementById('donut-count').textContent =
    `${count} gasto${count !== 1 ? 's' : ''}`;

  if (breakdown.length === 0) {
    svg.innerHTML = `
      <circle r="14" cx="18" cy="18" fill="none" stroke="#0B1220" stroke-width="5"/>
      <circle r="14" cx="18" cy="18" fill="none" stroke="#1A2638" stroke-width="5"
        stroke-dasharray="${CIRC}" transform="rotate(-90 18 18)"/>`;
    legend.innerHTML = '';
    layout.hidden = false;
    empty.hidden  = true;
    return;
  }

  layout.hidden = false;
  empty.hidden  = true;

  // Calcula offsets de cada fatia
  let cumOffset = 0;
  const slices = breakdown.slice(0, 8).map((cat, i) => {
    const len    = (cat.total / total) * CIRC;
    const offset = CIRC - cumOffset;
    cumOffset += len;
    return { ...cat, len, offset, delay: i * 80 };
  });

  // Anel de fundo
  const bg = `<circle r="14" cx="18" cy="18" fill="none" stroke="#0B1220" stroke-width="5"/>`;

  // Fatias (começam com dasharray=0 para animar depois)
  const fatias = slices.map((s, i) => `
    <circle class="donut-slice" r="14" cx="18" cy="18" fill="none"
      stroke="${s.color}" stroke-width="5"
      stroke-dasharray="0 ${CIRC}"
      stroke-dashoffset="${s.offset}"
      transform="rotate(-90 18 18)"
      data-len="${s.len.toFixed(4)}"
      data-delay="${s.delay}"/>`
  ).join('');

  svg.innerHTML = bg + fatias;

  // Anima cada fatia após render
  const els = svg.querySelectorAll('.donut-slice');
  els.forEach(el => {
    const len   = parseFloat(el.dataset.len);
    const delay = parseInt(el.dataset.delay);
    setTimeout(() => {
      el.style.transition = 'stroke-dasharray 700ms ease-out';
      el.style.strokeDasharray = `${len} ${CIRC - len}`;
    }, delay + 50);
  });

  // Legenda
  legend.innerHTML = slices.map(s => `
    <div class="legend-item">
      <span class="legend-dot" style="background:${s.color}"></span>
      <span class="legend-name">${escHtml(s.name)}</span>
      <span class="legend-val num">${formatCurrency(s.total)}</span>
      <span class="legend-pct">${s.percentage.toFixed(0)}%</span>
    </div>
  `).join('');
}

// ── Subcat chart ──────────────────────────────────────────────

function renderSubcatChart(breakdown, total, count) {
  const svg    = document.getElementById('subcat-svg');
  const legend = document.getElementById('subcat-legend');
  const layout = document.getElementById('subcat-layout');
  const empty  = document.getElementById('subcat-empty');

  document.getElementById('subcat-amount').textContent =
    total > 0 ? formatCurrency(total) : 'R$ 0,00';
  document.getElementById('subcat-count').textContent =
    `${count} gasto${count !== 1 ? 's' : ''}`;

  if (breakdown.length === 0) {
    svg.innerHTML = `
      <circle r="14" cx="18" cy="18" fill="none" stroke="#0B1220" stroke-width="5"/>
      <circle r="14" cx="18" cy="18" fill="none" stroke="#1A2638" stroke-width="5"
        stroke-dasharray="${CIRC}" transform="rotate(-90 18 18)"/>`;
    legend.innerHTML = '';
    layout.hidden = true;
    empty.hidden  = false;
    return;
  }

  layout.hidden = false;
  empty.hidden  = true;

  let cumOffset = 0;
  const slices = breakdown.slice(0, 8).map((item, i) => {
    const len    = (item.total / total) * CIRC;
    const offset = CIRC - cumOffset;
    cumOffset += len;
    return { ...item, len, offset, delay: i * 80 };
  });

  const bg = `<circle r="14" cx="18" cy="18" fill="none" stroke="#0B1220" stroke-width="5"/>`;

  const fatias = slices.map(s => `
    <circle class="donut-slice" r="14" cx="18" cy="18" fill="none"
      stroke="${s.color}" stroke-width="5"
      stroke-dasharray="0 ${CIRC}"
      stroke-dashoffset="${s.offset}"
      transform="rotate(-90 18 18)"
      data-len="${s.len.toFixed(4)}"
      data-delay="${s.delay}"/>`
  ).join('');

  svg.innerHTML = bg + fatias;

  svg.querySelectorAll('.donut-slice').forEach(el => {
    const len   = parseFloat(el.dataset.len);
    const delay = parseInt(el.dataset.delay);
    setTimeout(() => {
      el.style.transition = 'stroke-dasharray 700ms ease-out';
      el.style.strokeDasharray = `${len} ${CIRC - len}`;
    }, delay + 50);
  });

  legend.innerHTML = slices.map(s => `
    <div class="legend-item">
      <span class="legend-dot" style="background:${s.color}"></span>
      <span class="legend-name">${escHtml(s.name)}</span>
      <span class="legend-val num">${formatCurrency(s.total)}</span>
      <span class="legend-pct">${s.percentage.toFixed(0)}%</span>
    </div>
  `).join('');
}

// ── Bar chart ─────────────────────────────────────────────────

function renderBarChart(yearlyData) {
  const svg = document.getElementById('bar-svg');

  // Dimensões
  const W = 260, H = 105;
  const baselineY  = 82;   // y do chão das barras
  const maxBarH    = 68;   // altura máxima de barra
  const labelY     = 97;   // y dos labels de mês

  const barW  = 14;
  const step  = 20;        // passo por barra (20 * 12 = 240, + 20px restante p/ label)
  const startX = 4;

  const now          = new Date();
  const currentYear  = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const prevMon      = _grafYear === currentYear ? currentMonth - 1 : 0;

  // A escala precisa acomodar o maior gasto E a maior meta do ano, senão a
  // linha da meta (que agora varia mês a mês) sairia do topo do gráfico.
  const maxTotal  = Math.max(...yearlyData.map(m => m.total));
  const maxBudget = Math.max(...yearlyData.map(m => m.budget));
  const maxRef    = Math.max(maxTotal, maxBudget, 1);

  // Cor de cada barra
  function barColor(month) {
    if (_grafYear === currentYear) {
      if (month === currentMonth) return '#5B8CFF';
      if (month === prevMon)      return '#A78BFA';
      if (month > currentMonth)   return '#1A2638';
    }
    return '#2A3A52';
  }

  // Calcula alvos para animação
  const targets = yearlyData.map((m, i) => {
    const barH   = m.total > 0 ? Math.max((m.total / maxRef) * maxBarH, 3) : 3;
    const future = _grafYear === currentYear && m.month > currentMonth;
    return {
      x:      startX + i * step,
      finalH: future ? 3 : barH,
      finalY: future ? baselineY - 3 : baselineY - barH,
      color:  barColor(m.month),
      month:  m.month,
      total:  m.total,
      future,
    };
  });

  // Delta badge (vs mês anterior no ano do gráfico)
  const badge = document.getElementById('bar-delta-badge');
  if (_grafYear === currentYear && prevMon >= 1) {
    const cur  = yearlyData[currentMonth - 1].total;
    const prev = yearlyData[prevMon - 1].total;
    if (prev > 0) {
      const diff   = ((cur - prev) / prev) * 100;
      const isDown = diff <= 0;
      badge.textContent  = `${isDown ? '↓' : '↑'} ${Math.abs(diff).toFixed(0)}% vs ${monthName(prevMon, true)}`;
      badge.className    = 'bar-delta ' + (isDown ? 'bar-delta-down' : 'bar-delta-up');
      badge.hidden       = false;
    } else {
      badge.hidden = true;
    }
  } else {
    badge.hidden = true;
  }

  // Totais do rodapé
  const yearlytotal   = yearlyData.reduce((s, m) => s + m.total, 0);
  const monthsWithVal = yearlyData.filter(m => m.total > 0).length || 1;
  document.getElementById('bar-avg').textContent   = formatCurrency(yearlytotal / monthsWithVal);
  document.getElementById('bar-total').textContent = formatCurrency(yearlytotal);

  // Monta SVG (barras com h=0 para animação)
  // ── Linha da meta: um patamar por mês, com degraus quando muda ──
  // A meta de março vale março inteiro; ligar os meses por diagonal sugeriria
  // uma meta que muda no meio do mês, o que não existe.
  const yOfBudget = b => baselineY - (b / maxRef) * maxBarH;
  const cellLeft  = i => startX + i * step - (step - barW) / 2;

  let budgetLine = '';
  if (maxBudget > 0) {
    const segs = yearlyData.map((m, i) => ({
      y:  yOfBudget(m.budget),
      x1: cellLeft(i),
      x2: cellLeft(i) + step,
    }));

    let d = `M${segs[0].x1.toFixed(1)},${segs[0].y.toFixed(1)}`;
    segs.forEach((s, i) => {
      if (i > 0 && s.y !== segs[i - 1].y) d += ` V${s.y.toFixed(1)}`;
      d += ` H${s.x2.toFixed(1)}`;
    });

    const lastSeg = segs[segs.length - 1];
    budgetLine = `
      <path d="${d}" fill="none" stroke="#39E0A0" stroke-width="0.8"
        stroke-dasharray="3 3" opacity="0.6" stroke-linejoin="round"/>
      <text x="${(lastSeg.x2 + 2).toFixed(1)}" y="${(lastSeg.y + 2).toFixed(1)}"
        font-size="5.5" fill="#39E0A0" opacity="0.85"
        font-family="Manrope, sans-serif">meta</text>`;
  }

  const bars = targets.map((t, i) => `
    <rect class="chart-bar" x="${t.x}" y="${baselineY}" width="${barW}" height="0"
      rx="3" fill="${t.color}" data-i="${i}"/>
  `).join('');

  // ── Valor de cada mês, escrito na vertical ──
  // Cabe dentro da barra quando ela é alta o bastante; nas barras curtas o
  // número invadiria a área abaixo da linha de base, então sobe para fora.
  const valueLabels = targets.map(t => {
    if (t.future || t.total <= 0) return '';

    const txt    = compactBRL(t.total);
    const needed = txt.length * 3.4 + 6; // altura aproximada do texto rotacionado
    const inside = t.finalH >= needed;
    const cx     = t.x + barW / 2;
    const cy     = inside ? baselineY - 4 : t.finalY - 3;

    return `
      <text class="chart-bar-label" x="${cx}" y="${cy.toFixed(1)}"
        transform="rotate(-90 ${cx} ${cy.toFixed(1)})"
        text-anchor="start" dominant-baseline="middle"
        font-size="5.5" font-weight="700"
        fill="${inside ? 'rgba(255,255,255,.95)' : '#8B9AB2'}"
        font-family="Space Grotesk, monospace">${txt}</text>`;
  }).join('');

  const labels = targets.map((t, i) => {
    const isCurrentM = _grafYear === currentYear && t.month === currentMonth;
    return `<text x="${t.x + barW / 2}" y="${labelY}"
      text-anchor="middle" font-size="7"
      fill="${isCurrentM ? '#5B8CFF' : '#6B7A92'}"
      font-weight="${isCurrentM ? '700' : '400'}"
      font-family="Manrope, sans-serif">
      ${MONTHS_SHORT[i].toLowerCase()}
    </text>`;
  }).join('');

  svg.innerHTML = budgetLine + bars + valueLabels + labels;

  // Anima barras de baixo pra cima com stagger
  const barEls = svg.querySelectorAll('.chart-bar');
  function animateBars() {
    const duration = 550;
    const stagger  = 45;
    const startTs  = performance.now();

    function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

    function tick(now) {
      let allDone = true;
      barEls.forEach((el, i) => {
        const t      = (now - startTs - i * stagger) / duration;
        if (t <= 0) { allDone = false; return; }
        const prog   = Math.min(t, 1);
        const ease   = easeOut(prog);
        const target = targets[i];
        const h      = target.finalH * ease;
        el.setAttribute('height', h.toFixed(2));
        el.setAttribute('y', (baselineY - h).toFixed(2));
        if (prog < 1) allDone = false;
      });
      if (!allDone) requestAnimationFrame(tick);
      // Os valores só entram quando as barras já cresceram, senão ficariam
      // flutuando sobre o fundo durante a animação.
      else svg.querySelectorAll('.chart-bar-label').forEach(el => el.classList.add('visible'));
    }
    requestAnimationFrame(tick);
  }

  // Pequeno delay para o SVG estar no DOM
  setTimeout(animateBars, 50);
}
