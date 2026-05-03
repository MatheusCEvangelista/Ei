const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

function getUserSupabase(token) {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

// Resumo do mês: totais + por categoria
router.get('/', async (req, res) => {
  const { month, year } = req.query;
  const db = getUserSupabase(req.token);

  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const end = new Date(year, month, 0).toISOString().split('T')[0];

  const { data, error } = await db
    .from('transactions')
    .select('amount, type, categories(name, color)')
    .eq('user_id', req.user.id)
    .gte('date', start)
    .lte('date', end);

  if (error) return res.status(400).json({ error: error.message });

  const income = data.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const expense = data.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);

  // Agrupar despesas por categoria para gráfico de pizza
  const byCategory = {};
  data.filter(t => t.type === 'expense').forEach(t => {
    const cat = t.categories?.name || 'Sem categoria';
    const color = t.categories?.color || '#6b7280';
    if (!byCategory[cat]) byCategory[cat] = { name: cat, value: 0, color };
    byCategory[cat].value += Number(t.amount);
  });

  res.json({
    income,
    expense,
    balance: income - expense,
    byCategory: Object.values(byCategory),
  });
});

// Evolução dos últimos 6 meses para gráfico de barras
router.get('/evolution', async (req, res) => {
  const db = getUserSupabase(req.token);
  const today = new Date();
  const months = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    months.push({ month: d.getMonth() + 1, year: d.getFullYear() });
  }

  const results = await Promise.all(months.map(async ({ month, year }) => {
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const end = new Date(year, month, 0).toISOString().split('T')[0];

    const { data } = await db
      .from('transactions')
      .select('amount, type')
      .eq('user_id', req.user.id)
      .gte('date', start)
      .lte('date', end);

    const income = (data || []).filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const expense = (data || []).filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
    const label = new Date(year, month - 1).toLocaleString('pt-BR', { month: 'short' });

    return { label, income, expense };
  }));

  res.json(results);
});

module.exports = router;
