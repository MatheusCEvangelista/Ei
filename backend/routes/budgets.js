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

// Listar tetos do usuário com gasto atual do mês
router.get('/', async (req, res) => {
  const { month, year } = req.query;
  const supabase = db(req.token);

  const m = month || new Date().getMonth() + 1;
  const y = year  || new Date().getFullYear();
  const start = `${y}-${String(m).padStart(2,'0')}-01`;
  const end   = new Date(y, m, 0).toISOString().split('T')[0];

  // Busca tetos + transações do mês em paralelo
  const [{ data: budgets, error }, { data: txs }] = await Promise.all([
    supabase.from('budgets')
      .select('*, categories(id,name,color)')
      .eq('user_id', req.user.id),
    supabase.from('transactions')
      .select('amount,category_id')
      .eq('user_id', req.user.id)
      .eq('type', 'expense')
      .gte('date', start).lte('date', end),
  ]);
  if (error) return res.status(400).json({ error: error.message });

  // Calcula gasto atual por categoria
  const spentByCategory = {};
  (txs||[]).forEach(t => {
    if (!t.category_id) return;
    spentByCategory[t.category_id] = (spentByCategory[t.category_id]||0) + Number(t.amount);
  });

  const enriched = budgets.map(b => ({
    ...b,
    spent: spentByCategory[b.category_id] || 0,
    pct:   b.amount > 0 ? Math.round((spentByCategory[b.category_id]||0) / b.amount * 100) : 0,
  }));

  res.json(enriched);
});

// Sugestões baseadas na média dos últimos 3 meses
router.get('/suggestions', async (req, res) => {
  const supabase = db(req.token);
  const today = new Date();

  // Busca transações dos últimos 3 meses
  const months = Array.from({length:3}, (_,i) => {
    const d = new Date(today.getFullYear(), today.getMonth()-1-i, 1);
    return { month: d.getMonth()+1, year: d.getFullYear() };
  });

  const allTxs = [];
  for (const { month, year } of months) {
    const start = `${year}-${String(month).padStart(2,'0')}-01`;
    const end   = new Date(year, month, 0).toISOString().split('T')[0];
    const { data } = await supabase.from('transactions')
      .select('amount,category_id,categories(id,name,color)')
      .eq('user_id', req.user.id).eq('type','expense')
      .gte('date',start).lte('date',end);
    if (data) allTxs.push(...data);
  }

  // Agrupa por categoria e calcula média mensal
  const byCategory = {};
  allTxs.forEach(t => {
    if (!t.category_id) return;
    if (!byCategory[t.category_id]) {
      byCategory[t.category_id] = {
        category_id: t.category_id,
        name:  t.categories?.name  || 'Sem categoria',
        color: t.categories?.color || '#6b7280',
        total: 0,
        months: new Set(),
      };
    }
    byCategory[t.category_id].total += Number(t.amount);
    byCategory[t.category_id].months.add(`${months[0].year}-${t.category_id}`);
  });

  // Monta sugestões
  const suggestions = Object.values(byCategory).map(cat => {
    const avg       = cat.total / 3;
    const suggested = Math.round(avg * 0.9 * 100) / 100; // -10%
    return {
      category_id:     cat.category_id,
      name:            cat.name,
      color:           cat.color,
      avg_monthly:     Math.round(avg * 100) / 100,
      suggested_limit: suggested,
      cut_pct:         10,
    };
  }).filter(s => s.avg_monthly > 0)
    .sort((a,b) => b.avg_monthly - a.avg_monthly);

  res.json(suggestions);
});

// Criar ou atualizar teto (upsert)
router.post('/', async (req, res) => {
  const { category_id, amount } = req.body;
  if (!category_id || !amount) return res.status(400).json({ error: 'Categoria e valor são obrigatórios' });

  const { data, error } = await db(req.token).from('budgets')
    .upsert({ category_id, amount, user_id: req.user.id }, { onConflict: 'user_id,category_id' })
    .select('*, categories(id,name,color)').single();

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

// Excluir teto
router.delete('/:id', async (req, res) => {
  const { error } = await db(req.token).from('budgets')
    .delete().eq('id', req.params.id).eq('user_id', req.user.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'ok' });
});

module.exports = router;
