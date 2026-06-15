// ── Helpers internos ─────────────────────────────────────────

function uid() { return window.appState?.user?.id; }

function monthRange(year, month) {
  const last = daysInMonth(year, month);
  return {
    start: isoDate(year, month, 1),
    end:   isoDate(year, month, last),
  };
}

// ── Perfil ───────────────────────────────────────────────────

async function getProfile() {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', uid())
    .single();
  return data;
}

async function updateProfile(fields) {
  const { error } = await supabase
    .from('profiles')
    .update(fields)
    .eq('id', uid());
  return { error };
}

// Garante que o perfil existe e as categorias estão seedadas
async function ensureProfile(user) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) {
    await supabase.from('profiles').insert({
      id:    user.id,
      name:  user.user_metadata?.name || user.email.split('@')[0],
      email: user.email,
    });
  }

  // Verifica se já tem categorias (só seeda uma vez)
  const { count } = await supabase
    .from('categories')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);

  if (count === 0) await seedCategories(user.id);
}

// ── Categorias ───────────────────────────────────────────────

const DEFAULT_CATEGORIES = [
  { name: 'Alimentação', emoji: '🍔', color: '#5B8CFF',
    subs: ['Mercado', 'iFood', 'Restaurante', 'Feira/Casa Pedro', 'Padaria'] },
  { name: 'Transporte',  emoji: '🚗', color: '#A78BFA',
    subs: ['Uber', 'Combustível', 'Veículo', 'Ônibus/Metrô'] },
  { name: 'Casa',        emoji: '🏠', color: '#3DB8FF',
    subs: ['Aluguel', 'Contas', 'Móveis & Utensílios'] },
  { name: 'Saúde',       emoji: '💊', color: '#F472B6',
    subs: ['Profissionais', 'Farmácia', 'Plano'] },
  { name: 'Lazer',       emoji: '🎉', color: '#39E0A0',
    subs: ['Cinema', 'Bares', 'Eventos'] },
  { name: 'Viagem',      emoji: '✈️', color: '#FF9F40', subs: [] },
  { name: 'Educação',    emoji: '📚', color: '#7BA3FF', subs: [] },
  { name: 'Vestuário',   emoji: '👕', color: '#FFB84D', subs: [] },
  { name: 'Presentes',   emoji: '🎁', color: '#FF7C99', subs: [] },
  { name: 'Suplementos', emoji: '💪', color: '#8B5CF6', subs: [] },
  { name: 'Bebida',      emoji: '🍷', color: '#C77DFF', subs: [] },
  { name: 'Outros',      emoji: '📦', color: '#6B7A92', subs: [] },
];

async function seedCategories(userId) {
  for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
    const cat = DEFAULT_CATEGORIES[i];
    const { data: catRow, error } = await supabase
      .from('categories')
      .insert({ user_id: userId, name: cat.name, emoji: cat.emoji, color: cat.color, position: i })
      .select('id')
      .single();
    if (error || !catRow) continue;
    if (cat.subs.length === 0) continue;
    await supabase.from('subcategories').insert(
      cat.subs.map((name, j) => ({
        category_id: catRow.id,
        user_id: userId,
        name,
        position: j,
      }))
    );
  }
}

async function getCategories() {
  const { data } = await supabase
    .from('categories')
    .select('*, subcategories(*)')
    .eq('user_id', uid())
    .order('position');
  return data || [];
}

// ── Orçamento ────────────────────────────────────────────────

async function getBudgetForMonth(year, month) {
  const { data: monthly } = await supabase
    .from('monthly_budgets')
    .select('amount')
    .eq('user_id', uid())
    .eq('year', year)
    .eq('month', month)
    .maybeSingle();

  if (monthly) return { amount: parseFloat(monthly.amount), isDefault: false };

  const profile = await getProfile();
  return { amount: parseFloat(profile?.default_budget || 0), isDefault: true };
}

async function setMonthlyBudget(year, month, amount) {
  const { error } = await supabase
    .from('monthly_budgets')
    .upsert(
      { user_id: uid(), year, month, amount, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,year,month' }
    );
  return { error };
}

// ── Gastos ───────────────────────────────────────────────────

async function getMonthTotal(year, month) {
  const { start, end } = monthRange(year, month);
  const { data } = await supabase
    .from('expenses')
    .select('amount')
    .eq('user_id', uid())
    .gte('date', start)
    .lte('date', end);
  return (data || []).reduce((s, e) => s + parseFloat(e.amount), 0);
}

async function getDailyCumulative(year, month) {
  const { start, end } = monthRange(year, month);
  const { data } = await supabase
    .from('expenses')
    .select('date, amount')
    .eq('user_id', uid())
    .gte('date', start)
    .lte('date', end)
    .order('date');

  if (!data || data.length === 0) return [];

  const dayMap = {};
  data.forEach(e => {
    const day = parseInt(e.date.split('-')[2]);
    dayMap[day] = (dayMap[day] || 0) + parseFloat(e.amount);
  });

  const result = [];
  let cumulative = 0;
  for (const day of Object.keys(dayMap).map(Number).sort((a, b) => a - b)) {
    cumulative += dayMap[day];
    result.push({ day, cumulative });
  }
  return result;
}

async function getLastExpenses(limit = 5) {
  const { data } = await supabase
    .from('expenses')
    .select('*, categories(id,name,emoji,color), subcategories(id,name)')
    .eq('user_id', uid())
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  return data || [];
}

async function getMonthExpenses(year, month) {
  const { start, end } = monthRange(year, month);
  const { data } = await supabase
    .from('expenses')
    .select('*, categories(id,name,emoji,color), subcategories(id,name)')
    .eq('user_id', uid())
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });
  return data || [];
}

async function addExpense({ amount, category_id, subcategory_id, date, description, installments }) {
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:00`;

  if (installments > 1) {
    const groupId = uuid();
    const records = [];
    const partBase  = Math.floor((amount / installments) * 100) / 100;
    const lastPart  = Math.round((amount - partBase * (installments - 1)) * 100) / 100;
    const [y, m, d] = date.split('-').map(Number);

    for (let i = 0; i < installments; i++) {
      const target = new Date(y, m - 1 + i, d);
      records.push({
        user_id:              uid(),
        category_id:          category_id || null,
        subcategory_id:       subcategory_id || null,
        amount:               i < installments - 1 ? partBase : lastPart,
        date:                 isoDate(target.getFullYear(), target.getMonth() + 1, target.getDate()),
        time:                 timeStr,
        description:          description || null,
        installment_group_id: groupId,
        installment_number:   i + 1,
        installment_total:    installments,
      });
    }

    const { error } = await supabase.from('expenses').insert(records);
    return { error };
  }

  const { error } = await supabase.from('expenses').insert({
    user_id:        uid(),
    category_id:    category_id || null,
    subcategory_id: subcategory_id || null,
    amount,
    date,
    time:           timeStr,
    description:    description || null,
  });
  return { error };
}

async function updateExpense(id, fields, mode = 'single') {
  if (mode === 'single') {
    const { error } = await supabase.from('expenses')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', uid());
    return { error };
  }

  // mode === 'all': busca group_id e atualiza todo o grupo
  const { data: expense } = await supabase
    .from('expenses').select('installment_group_id').eq('id', id).single();
  if (!expense?.installment_group_id) return updateExpense(id, fields, 'single');

  const { error } = await supabase.from('expenses')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('installment_group_id', expense.installment_group_id)
    .eq('user_id', uid());
  return { error };
}

// ── Análises para gráficos ────────────────────────────────────

async function getCategoryBreakdown(year, month) {
  const { start, end } = monthRange(year, month);
  const { data } = await supabase
    .from('expenses')
    .select('amount, category_id, categories(id, name, emoji, color)')
    .eq('user_id', uid())
    .gte('date', start)
    .lte('date', end);

  if (!data || data.length === 0) return { breakdown: [], total: 0, count: 0 };

  const catMap = {};
  data.forEach(e => {
    const key = e.category_id || '_sem_categoria';
    if (!catMap[key]) catMap[key] = {
      id:    e.categories?.id    || null,
      name:  e.categories?.name  || 'Outros',
      emoji: e.categories?.emoji || '📦',
      color: e.categories?.color || '#6B7A92',
      total: 0, count: 0,
    };
    catMap[key].total += parseFloat(e.amount);
    catMap[key].count++;
  });

  const total = Object.values(catMap).reduce((s, c) => s + c.total, 0);
  const count = data.length;

  const breakdown = Object.values(catMap)
    .sort((a, b) => b.total - a.total)
    .map(c => ({ ...c, percentage: total > 0 ? (c.total / total) * 100 : 0 }));

  return { breakdown, total, count };
}

async function getYearlyData(year) {
  const { data: expenses } = await supabase
    .from('expenses')
    .select('date, amount')
    .eq('user_id', uid())
    .gte('date', `${year}-01-01`)
    .lte('date', `${year}-12-31`);

  const monthly = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, total: 0 }));
  (expenses || []).forEach(e => {
    const m = parseInt(e.date.split('-')[1]) - 1;
    monthly[m].total += parseFloat(e.amount);
  });

  // Busca orçamentos do ano
  const { data: budgets } = await supabase
    .from('monthly_budgets')
    .select('month, amount')
    .eq('user_id', uid())
    .eq('year', year);

  const budgetMap = {};
  (budgets || []).forEach(b => { budgetMap[b.month] = parseFloat(b.amount); });
  const defBudget = parseFloat(window.appState.profile?.default_budget || 0);

  return monthly.map(m => ({
    ...m,
    budget: budgetMap[m.month] ?? defBudget,
  }));
}

// ─────────────────────────────────────────────────────────────

async function deleteExpense(id, mode = 'single') {
  if (mode === 'single') {
    const { error } = await supabase.from('expenses')
      .delete().eq('id', id).eq('user_id', uid());
    return { error };
  }

  const { data: expense } = await supabase
    .from('expenses').select('installment_group_id').eq('id', id).single();
  if (!expense?.installment_group_id) return deleteExpense(id, 'single');

  const { error } = await supabase.from('expenses')
    .delete()
    .eq('installment_group_id', expense.installment_group_id)
    .eq('user_id', uid());
  return { error };
}
