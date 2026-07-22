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

router.get('/', async (req, res) => {
  const { month, year, account_id } = req.query;
  let query = db(req.token).from('transactions')
    .select('*, categories(id,name,color), accounts(id,name,color,icon)')
    .eq('user_id', req.user.id).order('date', { ascending: false });
  if (month && year) {
    const start = `${year}-${String(month).padStart(2,'0')}-01`;
    const end   = new Date(year, month, 0).toISOString().split('T')[0];
    query = query.gte('date', start).lte('date', end);
  }
  if (account_id) query = query.eq('account_id', account_id);
  const { data, error } = await query;
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.post('/', async (req, res) => {
  const { amount, type, description, category_id, date, account_id } = req.body;
  if (!amount || !type || !date)
    return res.status(400).json({ error: 'Valor, tipo e data são obrigatórios' });

  const supabase = db(req.token);
  const { data, error } = await supabase.from('transactions')
    .insert({ amount, type, description, category_id, date, account_id: account_id||null, user_id: req.user.id })
    .select('*, categories(id,name,color), accounts(id,name,color,icon)').single();
  if (error) return res.status(400).json({ error: error.message });

  // Verifica teto de gasto se for despesa com categoria
  if (type === 'expense' && category_id) {
    try {
      const { data: budget } = await supabase.from('budgets')
        .select('amount, categories(name)').eq('user_id', req.user.id)
        .eq('category_id', category_id).single();

      if (budget) {
        const txDate  = new Date(date);
        const month   = txDate.getMonth() + 1;
        const year    = txDate.getFullYear();
        const start   = `${year}-${String(month).padStart(2,'0')}-01`;
        const end     = new Date(year, month, 0).toISOString().split('T')[0];
        const { data: txs } = await supabase.from('transactions')
          .select('amount').eq('user_id', req.user.id).eq('type','expense')
          .eq('category_id', category_id).gte('date',start).lte('date',end);

        const total = (txs||[]).reduce((s,t) => s+Number(t.amount), 0);
        if (total >= Number(budget.amount)) {
          const { data: prefs } = await supabase.from('notification_preferences')
            .select('budget_exceeded').eq('user_id', req.user.id).single();
          if (!prefs || prefs.budget_exceeded !== false) {
            const createNotif = req.app.locals.createNotification;
            if (createNotif) await createNotif(
              supabase, req.user.id, 'budget_exceeded',
              '🔴 Teto atingido!',
              `Você atingiu o limite de ${budget.categories?.name || 'categoria'} este mês.`,
              { category_id, budget: budget.amount, spent: total }
            );
          }
        }
      }
    } catch (_) {}
  }

  res.status(201).json(data);
});

router.put('/:id', async (req, res) => {
  const { amount, type, description, category_id, date, account_id } = req.body;
  const { data, error } = await db(req.token).from('transactions')
    .update({ amount, type, description, category_id, date, account_id: account_id||null })
    .eq('id', req.params.id).eq('user_id', req.user.id)
    .select('*, categories(id,name,color), accounts(id,name,color,icon)').single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.delete('/:id', async (req, res) => {
  const { error } = await db(req.token).from('transactions')
    .delete().eq('id', req.params.id).eq('user_id', req.user.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'ok' });
});

module.exports = router;
