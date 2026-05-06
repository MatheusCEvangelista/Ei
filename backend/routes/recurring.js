const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

function db(token) {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

// Listar recorrentes
router.get('/', async (req, res) => {
  const { data, error } = await db(req.token)
    .from('recurring_transactions')
    .select('*, categories(id,name,color), accounts(id,name,color,icon)')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Criar recorrente
router.post('/', async (req, res) => {
  const { description, amount, type, category_id, account_id, frequency, day_of_month } = req.body;
  if (!amount || !type) return res.status(400).json({ error: 'Valor e tipo são obrigatórios' });
  const { data, error } = await db(req.token)
    .from('recurring_transactions')
    .insert({ description, amount, type, category_id, account_id, frequency: frequency || 'monthly', day_of_month, user_id: req.user.id })
    .select('*, categories(id,name,color), accounts(id,name,color,icon)')
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

// Atualizar recorrente
router.put('/:id', async (req, res) => {
  const { description, amount, type, category_id, account_id, frequency, day_of_month, active } = req.body;
  const { data, error } = await db(req.token)
    .from('recurring_transactions')
    .update({ description, amount, type, category_id, account_id, frequency, day_of_month, active })
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .select('*, categories(id,name,color), accounts(id,name,color,icon)')
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Excluir recorrente
router.delete('/:id', async (req, res) => {
  const { error } = await db(req.token).from('recurring_transactions').delete().eq('id', req.params.id).eq('user_id', req.user.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'Recorrente excluída' });
});

// Gerar transações do mês atual (chamado no login ou manualmente)
router.post('/generate', async (req, res) => {
  const supabase = db(req.token);
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();
  const monthKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

  const { data: recurrings, error } = await supabase
    .from('recurring_transactions')
    .select('*')
    .eq('user_id', req.user.id)
    .eq('active', true);

  if (error) return res.status(400).json({ error: error.message });

  const created = [];

  for (const r of recurrings) {
    // Verifica se já foi gerado esse mês
    const lastCreated = r.last_created_at;
    if (lastCreated) {
      const last = new Date(lastCreated);
      if (last.getMonth() + 1 === currentMonth && last.getFullYear() === currentYear) {
        continue; // já gerou esse mês
      }
    }

    // Define a data da transação
    const day = r.day_of_month || today.getDate();
    const safeDay = Math.min(day, new Date(currentYear, currentMonth, 0).getDate());
    const txDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;

    const { data: tx } = await supabase
      .from('transactions')
      .insert({
        user_id: req.user.id,
        description: r.description,
        amount: r.amount,
        type: r.type,
        category_id: r.category_id,
        account_id: r.account_id,
        date: txDate,
      })
      .select()
      .single();

    if (tx) {
      await supabase
        .from('recurring_transactions')
        .update({ last_created_at: txDate })
        .eq('id', r.id);
      created.push(tx);
    }
  }

  res.json({ generated: created.length, transactions: created });
});

module.exports = router;
