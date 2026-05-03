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

// Listar categorias do usuário
router.get('/', async (req, res) => {
  const db = getUserSupabase(req.token);
  const { data, error } = await db
    .from('categories')
    .select('*')
    .eq('user_id', req.user.id)
    .order('is_fixed', { ascending: false });

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Criar categoria personalizada
router.post('/', async (req, res) => {
  const { name, color } = req.body;
  const db = getUserSupabase(req.token);

  if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });

  const { data, error } = await db
    .from('categories')
    .insert({ name, color: color || '#6b7280', is_fixed: false, user_id: req.user.id })
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

// Editar categoria personalizada
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, color } = req.body;
  const db = getUserSupabase(req.token);

  const { data: cat } = await db.from('categories').select('is_fixed').eq('id', id).single();
  if (cat?.is_fixed) return res.status(400).json({ error: 'Não é possível editar categorias fixas' });

  const { data, error } = await db
    .from('categories')
    .update({ name, color })
    .eq('id', id)
    .eq('user_id', req.user.id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Excluir categoria personalizada
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const db = getUserSupabase(req.token);

  // Não permite excluir categorias fixas
  const { data: cat } = await db.from('categories').select('is_fixed').eq('id', id).single();
  if (cat?.is_fixed) return res.status(400).json({ error: 'Não é possível excluir categorias fixas' });

  const { error } = await db
    .from('categories')
    .delete()
    .eq('id', id)
    .eq('user_id', req.user.id);

  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'Categoria excluída' });
});

module.exports = router;
