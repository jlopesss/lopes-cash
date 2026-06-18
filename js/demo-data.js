// ── Modo demo — dados fictícios (ativo quando SUPABASE_URL é placeholder) ────

if (window.DEMO_MODE) {

// Categorias com subcategorias
const _CATS = [
  { id:'c01', name:'Alimentação', emoji:'🍔', color:'#5B8CFF', position:0,
    subcategories:[
      {id:'s01',category_id:'c01',name:'Mercado',position:0},
      {id:'s02',category_id:'c01',name:'iFood',position:1},
      {id:'s03',category_id:'c01',name:'Restaurante',position:2},
      {id:'s04',category_id:'c01',name:'Padaria',position:3},
    ]},
  { id:'c02', name:'Transporte', emoji:'🚗', color:'#A78BFA', position:1,
    subcategories:[
      {id:'s05',category_id:'c02',name:'Uber',position:0},
      {id:'s06',category_id:'c02',name:'Combustível',position:1},
      {id:'s07',category_id:'c02',name:'Ônibus/Metrô',position:2},
    ]},
  { id:'c03', name:'Casa', emoji:'🏠', color:'#3DB8FF', position:2,
    subcategories:[
      {id:'s08',category_id:'c03',name:'Aluguel',position:0},
      {id:'s09',category_id:'c03',name:'Contas',position:1},
      {id:'s10',category_id:'c03',name:'Móveis & Utensílios',position:2},
    ]},
  { id:'c04', name:'Saúde', emoji:'💊', color:'#F472B6', position:3,
    subcategories:[
      {id:'s11',category_id:'c04',name:'Plano',position:0},
      {id:'s12',category_id:'c04',name:'Farmácia',position:1},
    ]},
  { id:'c05', name:'Lazer', emoji:'🎉', color:'#39E0A0', position:4,
    subcategories:[
      {id:'s13',category_id:'c05',name:'Cinema',position:0},
      {id:'s14',category_id:'c05',name:'Bares',position:1},
    ]},
  { id:'c06', name:'Viagem',      emoji:'✈️', color:'#FF9F40', position:5,  subcategories:[] },
  { id:'c07', name:'Educação',    emoji:'📚', color:'#7BA3FF', position:6,  subcategories:[] },
  { id:'c08', name:'Vestuário',   emoji:'👕', color:'#FFB84D', position:7,  subcategories:[] },
  { id:'c09', name:'Presentes',   emoji:'🎁', color:'#FF7C99', position:8,  subcategories:[] },
  { id:'c10', name:'Suplementos', emoji:'💪', color:'#8B5CF6', position:9,  subcategories:[] },
  { id:'c11', name:'Bebida',      emoji:'🍷', color:'#C77DFF', position:10, subcategories:[] },
  { id:'c12', name:'Outros',      emoji:'📦', color:'#6B7A92', position:11, subcategories:[] },
];

// Gastos do mês atual (junho 2026) — Total: R$ 2.009,40
const _EXP = [
  { id:'e01', date:'2026-06-15', amount:156.00, description:'Pedido no app',
    category_id:'c01', categories:{id:'c01',name:'Alimentação',emoji:'🍔',color:'#5B8CFF'},
    subcategory_id:'s02', subcategories:{id:'s02',name:'iFood'}, installment_total:1 },
  { id:'e02', date:'2026-06-14', amount:80.00, description:null,
    category_id:'c02', categories:{id:'c02',name:'Transporte',emoji:'🚗',color:'#A78BFA'},
    subcategory_id:'s05', subcategories:{id:'s05',name:'Uber'}, installment_total:1 },
  { id:'e03', date:'2026-06-13', amount:42.50, description:'Pão e café',
    category_id:'c01', categories:{id:'c01',name:'Alimentação',emoji:'🍔',color:'#5B8CFF'},
    subcategory_id:'s04', subcategories:{id:'s04',name:'Padaria'}, installment_total:1 },
  { id:'e04', date:'2026-06-12', amount:35.00, description:null,
    category_id:'c05', categories:{id:'c05',name:'Lazer',emoji:'🎉',color:'#39E0A0'},
    subcategory_id:'s13', subcategories:{id:'s13',name:'Cinema'}, installment_total:1 },
  { id:'e05', date:'2026-06-10', amount:120.00, description:null,
    category_id:'c04', categories:{id:'c04',name:'Saúde',emoji:'💊',color:'#F472B6'},
    subcategory_id:'s11', subcategories:{id:'s11',name:'Plano'}, installment_total:1 },
  { id:'e06', date:'2026-06-08', amount:50.00, description:'Gasolina',
    category_id:'c02', categories:{id:'c02',name:'Transporte',emoji:'🚗',color:'#A78BFA'},
    subcategory_id:'s06', subcategories:{id:'s06',name:'Combustível'}, installment_total:1 },
  { id:'e07', date:'2026-06-05', amount:280.00, description:'Feira da semana',
    category_id:'c01', categories:{id:'c01',name:'Alimentação',emoji:'🍔',color:'#5B8CFF'},
    subcategory_id:'s01', subcategories:{id:'s01',name:'Mercado'}, installment_total:1 },
  { id:'e08', date:'2026-06-03', amount:45.90, description:'Água e luz',
    category_id:'c03', categories:{id:'c03',name:'Casa',emoji:'🏠',color:'#3DB8FF'},
    subcategory_id:'s09', subcategories:{id:'s09',name:'Contas'},
    installment_total:3, installment_number:1, installment_group_id:'g01' },
  { id:'e09', date:'2026-06-01', amount:1200.00, description:null,
    category_id:'c03', categories:{id:'c03',name:'Casa',emoji:'🏠',color:'#3DB8FF'},
    subcategory_id:'s08', subcategories:{id:'s08',name:'Aluguel'}, installment_total:1 },
];

const _TOTAL_JUN = _EXP.reduce((s, e) => s + e.amount, 0); // 2009.40

// Histórico de meses anteriores
const _PAST = { '2026-05': 2340, '2026-04': 2780, '2026-03': 1920, '2026-02': 2100, '2026-01': 2550 };

// ── Overrides das funções do db.js ────────────────────────────

window.getProfile = async () => window.appState.profile;

window.updateProfile = async (fields) => {
  Object.assign(window.appState.profile, fields);
  return { error: null };
};

window.ensureProfile = async () => {};

window.getCategories = async () => _CATS;

window.getBudgetForMonth = async () => ({ amount: 3000, isDefault: true });

window.setMonthlyBudget = async () => ({ error: null });

window.getMonthTotal = async (year, month) => {
  const key = `${year}-${String(month).padStart(2,'0')}`;
  if (key === '2026-06') return _TOTAL_JUN;
  return _PAST[key] || 0;
};

window.getDailyCumulative = async (year, month) => {
  if (year !== 2026 || month !== 6) return [];
  const dayMap = {};
  _EXP.forEach(e => {
    const d = parseInt(e.date.split('-')[2]);
    dayMap[d] = (dayMap[d] || 0) + e.amount;
  });
  let cum = 0;
  return Object.keys(dayMap).map(Number).sort((a, b) => a - b).map(day => {
    cum += dayMap[day];
    return { day, cumulative: cum };
  });
};

window.getLastExpenses = async (limit = 5) => _EXP.slice(0, limit);

window.getMonthExpenses = async (year, month) => {
  const key = `${year}-${String(month).padStart(2,'0')}`;
  return key === '2026-06' ? [..._EXP] : [];
};

window.addExpense    = async () => ({ error: null });
window.updateExpense = async () => ({ error: null });
window.deleteExpense = async () => ({ error: null });

window.getCategoryBreakdown = async (year, month) => {
  if (year !== 2026 || month !== 6) return { breakdown: [], total: 0, count: 0 };
  const catMap = {};
  _EXP.forEach(e => {
    const k = e.category_id;
    if (!catMap[k]) catMap[k] = { ...e.categories, total: 0, count: 0 };
    catMap[k].total += e.amount;
    catMap[k].count++;
  });
  const breakdown = Object.values(catMap)
    .sort((a, b) => b.total - a.total)
    .map(c => ({ ...c, percentage: (c.total / _TOTAL_JUN) * 100 }));
  return { breakdown, total: _TOTAL_JUN, count: _EXP.length };
};

window.getYearlyData = async (year) => {
  if (year !== 2026) return Array.from({ length: 12 }, (_, i) => ({ month: i+1, total: 0, budget: 3000 }));
  const totals = [2550, 2100, 1920, 2780, 2340, _TOTAL_JUN, 0, 0, 0, 0, 0, 0];
  return totals.map((total, i) => ({ month: i+1, total, budget: 3000 }));
};

// Carrega um gasto no formulário de edição (sem chamar Supabase)
window.loadExpenseForEdit = async function(id) {
  const exp = _EXP.find(e => e.id === id);
  if (!exp) return;

  document.getElementById('expense-amount').value = String(exp.amount).replace('.', ',');
  setDateField(exp.date);
  document.getElementById('expense-desc').value = exp.description || '';

  if (exp.categories) selectCategory(exp.categories.id, exp.categories, false);
  if (exp.subcategories?.id) selectSubcategory(exp.subcategories.id, exp.subcategories);

  if (exp.installment_total > 1) {
    _installments = exp.installment_total;
    document.getElementById('installment-check').checked = true;
    document.getElementById('inst-count').textContent    = _installments;
    document.getElementById('installment-detail').hidden = false;
    document.getElementById('inst-badge').hidden         = false;
    updateInstBadge();
    updateInstPreview();
  }
};

// Retorna info de parcelamento sem Supabase
window.getExpenseInstallmentInfo = async function(id) {
  const exp = _EXP.find(e => e.id === id);
  return exp
    ? { installment_total: exp.installment_total || 1, installment_group_id: exp.installment_group_id || null }
    : null;
};

} // end DEMO_MODE
