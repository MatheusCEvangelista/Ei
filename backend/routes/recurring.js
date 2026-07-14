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
  const { data, error } = await db(req.token).from('recurring_transactions')
    .select('*, categories(id,name,color), accounts(id,name,color,icon)')
    .eq('user_id', req.user.id).order('created_at', { ascending: false });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.post('/', async (req, res) => {
  const { description, amount, type, category_id, account_id, frequency, day_of_month } = req.body;
  if (!amount || !type) return res.status(400).json({ error: 'Valor e tipo são obrigatórios' });
  const { data, error } = await db(req.token).from('recurring_transactions')
    .insert({ description, amount, type, category_id, account_id, frequency: frequency||'monthly', day_of_month, user_id: req.user.id })
    .select('*, categories(id,name,color), accounts(id,name,color,icon)').single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

router.put('/:id', async (req, res) => {
  const { description, amount, type, category_id, account_id, frequency, day_of_month, active } = req.body;
  const { data, error } = await db(req.token).from('recurring_transactions')
    .update({ description, amount, type, category_id, account_id, frequency, day_of_month, active })
    .eq('id', req.params.id).eq('user_id', req.user.id)
    .select('*, categories(id,name,color), accounts(id,name,color,icon)').single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.delete('/:id', async (req, res) => {
  const { error } = await db(req.token).from('recurring_transactions')
    .delete().eq('id', req.params.id).eq('user_id', req.user.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'ok' });
});

router.post('/generate', async (req, res) => {
  const supabase = db(req.token);
  const today    = new Date();
  const currMonth = today.getMonth()+1;
  const currYear  = today.getFullYear();

  const { data: recurrings, error } = await supabase.from('recurring_transactions')
    .select('*').eq('user_id', req.user.id).eq('active', true);
  if (error) return res.status(400).json({ error: error.message });

  const created = [];
  for (const r of recurrings) {
    if (r.frequency === 'monthly') {
      if (r.last_created_at) {
        const last = new Date(r.last_created_at);
        if (last.getMonth()+1===currMonth && last.getFullYear()===currYear) continue;
      }
      const day     = r.day_of_month || today.getDate();
      const safeDay = Math.min(day, new Date(currYear, currMonth, 0).getDate());
      const txDate  = `${currYear}-${String(currMonth).padStart(2,'0')}-${String(safeDay).padStart(2,'0')}`;
      const { data: tx } = await supabase.from('transactions')
        .insert({ user_id: r.user_id, description: r.description, amount: r.amount, type: r.type, category_id: r.category_id, account_id: r.account_id, date: txDate })
        .select().single();
      if (tx) { await supabase.from('recurring_transactions').update({ last_created_at: txDate }).eq('id', r.id); created.push(tx); }

    } else if (r.frequency === 'weekly') {
      const lastCreated   = r.last_created_at ? new Date(r.last_created_at) : null;
      const daysSinceLast = lastCreated ? Math.floor((today-lastCreated)/(1000*60*60*24)) : 999;
      if (daysSinceLast < 7) continue;
      const txDate = today.toISOString().split('T')[0];
      const { data: tx } = await supabase.from('transactions')
        .insert({ user_id: r.user_id, description: r.description, amount: r.amount, type: r.type, category_id: r.category_id, account_id: r.account_id, date: txDate })
        .select().single();
      if (tx) { await supabase.from('recurring_transactions').update({ last_created_at: txDate }).eq('id', r.id); created.push(tx); }
    }
  }
  res.json({ generated: created.length, transactions: created });
});

module.exports = router;
