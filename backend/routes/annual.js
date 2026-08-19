const express = require('express');
const router  = express.Router();
const { createClient } = require('@supabase/supabase-js');
const authMiddleware   = require('../middleware/auth');

router.use(authMiddleware);

function db(token) {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

// GET /api/annual?year=2026
router.get('/', async (req, res) => {
  const supabase = db(req.token);
  const year     = Number(req.query.year) || new Date().getFullYear();
  const start    = `${year}-01-01`;
  const end      = `${year}-12-31`;

  // Busca todas as transações do ano
  const { data: txs, error } = await supabase
    .from('transactions')
    .select('amount,type,date,category_id,categories(name,color),transfer_id')
    .eq('user_id', req.user.id)
    .gte('date', start).lte('date', end);

  if (error) return res.status(400).json({ error: error.message });

  const real = (txs || []).filter(t => !t.transfer_id);

  const MONTH_NAMES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  // Agrega por mês
  const byMonth = Array.from({ length: 12 }, (_, i) => ({
    month:   i + 1,
    label:   MONTH_NAMES[i],
    income:  0,
    expense: 0,
    balance: 0,
  }));

  real.forEach(t => {
    const m = new Date(t.date + 'T00:00:00').getMonth(); // 0-indexed
    if (t.type === 'income')  byMonth[m].income  += Number(t.amount);
    if (t.type === 'expense') byMonth[m].expense += Number(t.amount);
  });

  byMonth.forEach(m => {
    m.income  = Math.round(m.income  * 100) / 100;
    m.expense = Math.round(m.expense * 100) / 100;
    m.balance = Math.round((m.income - m.expense) * 100) / 100;
  });

  // Totais anuais
  const totalIncome  = byMonth.reduce((s, m) => s + m.income,  0);
  const totalExpense = byMonth.reduce((s, m) => s + m.expense, 0);
  const totalBalance = totalIncome - totalExpense;
  const savingRate   = totalIncome > 0 ? Math.round((totalBalance / totalIncome) * 100) : 0;

  // Melhor e pior mês
  const activeMonths = byMonth.filter(m => m.income > 0 || m.expense > 0);
  const bestMonth    = activeMonths.length ? activeMonths.reduce((a, b) => b.balance > a.balance ? b : a) : null;
  const worstMonth   = activeMonths.length ? activeMonths.reduce((a, b) => b.balance < a.balance ? b : a) : null;

  // Por categoria (ano inteiro)
  const catMap = {};
  real.filter(t => t.type === 'expense' && t.category_id).forEach(t => {
    const id = t.category_id;
    if (!catMap[id]) catMap[id] = { name: t.categories?.name || 'Sem categoria', color: t.categories?.color || '#6b7280', total: 0 };
    catMap[id].total += Number(t.amount);
  });
  const byCategory = Object.values(catMap)
    .sort((a, b) => b.total - a.total)
    .map(c => ({ ...c, total: Math.round(c.total * 100) / 100, pct: totalExpense > 0 ? Math.round(c.total / totalExpense * 100) : 0 }));

  // Acumulado mês a mês
  let accumulated = 0;
  const withAccumulated = byMonth.map(m => {
    accumulated += m.balance;
    return { ...m, accumulated: Math.round(accumulated * 100) / 100 };
  });

  res.json({
    year,
    months:         withAccumulated,
    by_category:    byCategory,
    total_income:   Math.round(totalIncome  * 100) / 100,
    total_expense:  Math.round(totalExpense * 100) / 100,
    total_balance:  Math.round(totalBalance * 100) / 100,
    saving_rate:    savingRate,
    best_month:     bestMonth,
    worst_month:    worstMonth,
    months_with_data: activeMonths.length,
  });
});

module.exports = router;
