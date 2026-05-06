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

// Listar contas
router.get('/', async (req, res) => {
  const { data, error } = await db(req.token)
    .from('accounts')
    .select('*')
    .eq('user_id', req.user.id)
    .order('created_at');
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Criar conta
router.post('/', async (req, res) => {
  const { name, bank, color, icon } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });
  const { data, error } = await db(req.token)
    .from('accounts')
    .insert({ name, bank, color: color || '#7c7ff7', icon: icon || '🏦', user_id: req.user.id })
    .select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

// Atualizar conta
router.put('/:id', async (req, res) => {
  const { name, bank, color, icon } = req.body;
  const { data, error } = await db(req.token)
    .from('accounts')
    .update({ name, bank, color, icon })
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Excluir conta
router.delete('/:id', async (req, res) => {
  const { error } = await db(req.token).from('accounts').delete().eq('id', req.params.id).eq('user_id', req.user.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'Conta excluída' });
});

module.exports = router;
