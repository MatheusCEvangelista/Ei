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

// Listar transações (com filtro de mês/ano)
router.get('/', async (req, res) => {
  const { month, year } = req.query;
  const db = getUserSupabase(req.token);

  let query = db
    .from('transactions')
    .select('*, categories(id, name, color)')
    .eq('user_id', req.user.id)
    .order('date', { ascending: false });

  if (month && year) {
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const end = new Date(year, month, 0).toISOString().split('T')[0];
    query = query.gte('date', start).lte('date', end);
  }

  const { data, error } = await query;
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Criar transação
router.post('/', async (req, res) => {
  const { amount, type, description, category_id, date } = req.body;
  const db = getUserSupabase(req.token);

  if (!amount || !type || !date) {
    return res.status(400).json({ error: 'Valor, tipo e data são obrigatórios' });
  }

  const { data, error } = await db
    .from('transactions')
    .insert({ amount, type, description, category_id, date, user_id: req.user.id })
    .select('*, categories(id, name, color)')
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

// Atualizar transação
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { amount, type, description, category_id, date } = req.body;
  const db = getUserSupabase(req.token);

  const { data, error } = await db
    .from('transactions')
    .update({ amount, type, description, category_id, date })
    .eq('id', id)
    .eq('user_id', req.user.id)
    .select('*, categories(id, name, color)')
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Excluir transação
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const db = getUserSupabase(req.token);

  const { error } = await db
    .from('transactions')
    .delete()
    .eq('id', id)
    .eq('user_id', req.user.id);

  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'Transação excluída' });
});

module.exports = router;
