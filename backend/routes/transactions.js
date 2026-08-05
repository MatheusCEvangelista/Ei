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
  const { amount, type, description, category_id, date, account_id, credit_card_id, import_hash } = req.body;
  if (!amount || !type || !date)
    return res.status(400).json({ error: 'Valor, tipo e data são obrigatórios' });

  const supabase = db(req.token);

  // Se veio com import_hash, tenta upsert ignorando conflito (deduplicação)
  const payload = {
    amount, type, description,
    category_id:    category_id    || null,
    account_id:     account_id     || null,
    credit_card_id: credit_card_id || null,
    import_hash:    import_hash    || null,
    user_id:        req.user.id,
    date,
  };

  let data, error;

  if (import_hash) {
    // Tenta inserir — se hash já existe, retorna erro 409 que o frontend trata como "já existe"
    const result = await supabase.from('transactions').insert(payload)
      .select('*, categories(id,name,color), accounts(id,name,color,icon)').single();
    data  = result.data;
    error = result.error;

    // Duplicata detectada pelo unique index — retorna 409
    if (error && error.code === '23505') {
      return res.status(409).json({ error: 'duplicate', message: 'Transação já importada' });
    }
  } else {
    const result = await supabase.from('transactions').insert(payload)
      .select('*, categories(id,name,color), accounts(id,name,color,icon)').single();
    data  = result.data;
    error = result.error;
  }

  if (error) return res.status(400).json({ error: error.message });

  // Verifica teto de gasto se for despesa com categoria
  if (type === 'expense' && category_id) {
    try {
      const { data: budget } = await supabase.from('budgets')
        .select('amount, categories(name)').eq('user_id', req.user.id)
        .eq('category_id', category_id).single();
      if (budget) {
        const txDate = new Date(date);
        const m = txDate.getMonth()+1, y = txDate.getFullYear();
        const start = `${y}-${String(m).padStart(2,'0')}-01`;
        const end   = new Date(y, m, 0).toISOString().split('T')[0];
        const { data: txs } = await supabase.from('transactions')
          .select('amount').eq('user_id', req.user.id).eq('type','expense')
          .eq('category_id', category_id).gte('date',start).lte('date',end);
        const total = (txs||[]).reduce((s,t)=>s+Number(t.amount),0);
        if (total >= Number(budget.amount)) {
          const createNotif = req.app.locals.createNotification;
          if (createNotif) await createNotif(supabase, req.user.id, 'budget_exceeded',
            '🔴 Teto atingido!',
            `Você atingiu o limite de ${budget.categories?.name||'categoria'} este mês.`,
            { category_id, budget: budget.amount, spent: total }
          );
        }
      }
    } catch(_) {}
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
