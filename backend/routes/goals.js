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

// Listar metas
router.get('/', async (req, res) => {
  const { data, error } = await db(req.token)
    .from('goals')
    .select('*, categories(id,name,color)')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Criar meta
router.post('/', async (req, res) => {
  const { name, target_amount, deadline, category_id, color, current_amount } = req.body;
  if (!name || !target_amount) return res.status(400).json({ error: 'Nome e valor alvo são obrigatórios' });
  const { data, error } = await db(req.token)
    .from('goals')
    .insert({ name, target_amount, deadline, category_id, color, current_amount: current_amount || 0, user_id: req.user.id })
    .select('*, categories(id,name,color)')
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

// Atualizar meta (incluindo progresso manual)
router.put('/:id', async (req, res) => {
  const { name, target_amount, deadline, category_id, color, current_amount } = req.body;
  const { data, error } = await db(req.token)
    .from('goals')
    .update({ name, target_amount, deadline, category_id, color, current_amount })
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .select('*, categories(id,name,color)')
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Adicionar valor à meta (depósito manual)
router.post('/:id/deposit', async (req, res) => {
  const { amount } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Valor inválido' });
  const supabase = db(req.token);
  const { data: goal } = await supabase.from('goals').select('current_amount').eq('id', req.params.id).single();
  const newAmount = Number(goal.current_amount) + Number(amount);
  const { data, error } = await supabase
    .from('goals')
    .update({ current_amount: newAmount })
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .select('*, categories(id,name,color)')
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Excluir meta
router.delete('/:id', async (req, res) => {
  const { error } = await db(req.token).from('goals').delete().eq('id', req.params.id).eq('user_id', req.user.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'Meta excluída' });
});

module.exports = router;
