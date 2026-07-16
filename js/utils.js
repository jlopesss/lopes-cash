// ── Formatação de moeda ──────────────────────────────────────

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(value || 0);
}

// Versão curta, sem "R$", para caber em espaços apertados (ex.: valor escrito
// na vertical dentro das barras do gráfico). 2450 → "2,4k"; 980 → "980".
function compactBRL(value) {
  // Arredonda antes de comparar: 999,60 vira 1000, que deve sair como "1,0k".
  const v = Math.round(Math.abs(value || 0));
  if (v >= 1000) {
    const k = v / 1000;
    // Acima de 10k a casa decimal não cabe e agrega pouco: 12,3k → 12k.
    // O teste usa o valor já arredondado, senão 9990 (k=9,99) cairia no ramo
    // de uma casa e sairia como "10,0k".
    const oneDecimal = Math.round(k * 10) / 10;
    return (oneDecimal >= 10
      ? Math.round(k).toString()
      : oneDecimal.toFixed(1).replace('.', ',')) + 'k';
  }
  return v.toString();
}

// Retorna { integer: '1.234', cents: '56' } para exibição hero
function splitCurrency(value) {
  const abs = Math.abs(value || 0);
  const formatted = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs);
  const parts = formatted.split(',');
  return { integer: parts[0], cents: ',' + (parts[1] || '00') };
}

// ── Formatação de datas ──────────────────────────────────────

const MONTHS_LONG  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                      'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun',
                      'Jul','Ago','Set','Out','Nov','Dez'];

function monthName(month, short = false) {
  return (short ? MONTHS_SHORT : MONTHS_LONG)[month - 1] || '';
}

function todayISO() {
  const d = new Date();
  return isoDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

function isoDate(year, month, day) {
  return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function daysRemainingInMonth() {
  const now  = new Date();
  const last = daysInMonth(now.getFullYear(), now.getMonth() + 1);
  return last - now.getDate();
}

function relativeDate(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const diff = Math.round((today - date) / 86400000);
  if (diff < 0)   return `${d} ${MONTHS_SHORT[m - 1]}`;
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Ontem';
  if (diff < 7)   return `${diff} dias atrás`;
  return `${d} ${MONTHS_SHORT[m - 1]}`;
}

function formatDateLabel(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${d} ${MONTHS_SHORT[m - 1]} · ${y}`;
}

function currentMonthYear() {
  const now = new Date();
  return `${MONTHS_LONG[now.getMonth()]} · ${now.getFullYear()}`;
}

// Mês anterior: { year, month }
function prevMonth(year, month) {
  if (month === 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}

// ── Formatação de hora ───────────────────────────────────────

function formatTime(timeStr) {
  if (!timeStr) return '';
  const parts = timeStr.split(':');
  return `${parts[0]}:${parts[1]}`;
}

// ── Helpers numéricos ────────────────────────────────────────

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function pct(value, total) {
  if (!total) return 0;
  return Math.round((value / total) * 1000) / 10; // 1 decimal
}

// UUID simples para fallback (browsers modernos têm crypto.randomUUID)
function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}
