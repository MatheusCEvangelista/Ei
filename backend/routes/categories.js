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

// Categorias padrão do sistema
const DEFAULT_CATEGORIES = [
  { name:'Alimentação', color:'#f97316', icon:'🛒' },
  { name:'Moradia',     color:'#3b82f6', icon:'🏠' },
  { name:'Transporte',  color:'#8b5cf6', icon:'🚗' },
  { name:'Saúde',       color:'#ef4444', icon:'💊' },
  { name:'Educação',    color:'#06b6d4', icon:'📚' },
  { name:'Lazer',       color:'#ec4899', icon:'🎉' },
  { name:'Vestuário',   color:'#a78bfa', icon:'👕' },
  { name:'Assinaturas', color:'#6366f1', icon:'📱' },
  { name:'Compras',     color:'#f59e0b', icon:'🛍️' },
  { name:'Beleza',      color:'#d946ef', icon:'💈' },
  { name:'Pets',        color:'#84cc16', icon:'🐾' },
  { name:'Financeiro',  color:'#64748b', icon:'💳' },
  { name:'Salário',     color:'#22c55e', icon:'💼' },
  { name:'Renda Extra', color:'#10b981', icon:'💵' },
  { name:'Investimentos',color:'#0ea5e9',icon:'📈' },
  { name:'Outros',      color:'#94a3b8', icon:'❓' },
];

// Seed automático para usuários sem categorias
async function seedDefaultCategories(supabase, userId) {
  const toInsert = DEFAULT_CATEGORIES.map(c => ({ ...c, user_id: userId }));
  const { data, error } = await supabase.from('categories').insert(toInsert).select();
  return error ? [] : data;
}

// Listar categorias — faz seed se não tiver nenhuma
router.get('/', async (req, res) => {
  const supabase = db(req.token);
  let { data, error } = await supabase.from('categories')
    .select('*').eq('user_id', req.user.id).order('name');
  if (error) return res.status(400).json({ error: error.message });

  // Lazy init: cria categorias padrão se usuário não tiver nenhuma
  if (!data || data.length === 0) {
    data = await seedDefaultCategories(supabase, req.user.id);
  }

  res.json(data);
});

// Criar categoria
router.post('/', async (req, res) => {
  const { name, color, icon } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });
  const { data, error } = await db(req.token).from('categories')
    .insert({ name, color: color||'#6b7280', icon: icon||'📌', user_id: req.user.id })
    .select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

// Atualizar
router.put('/:id', async (req, res) => {
  const { name, color, icon } = req.body;
  const { data, error } = await db(req.token).from('categories')
    .update({ name, color, icon })
    .eq('id', req.params.id).eq('user_id', req.user.id)
    .select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Excluir
router.delete('/:id', async (req, res) => {
  const { error } = await db(req.token).from('categories')
    .delete().eq('id', req.params.id).eq('user_id', req.user.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'ok' });
});

// Endpoint para restaurar categorias padrão
router.post('/seed-defaults', async (req, res) => {
  const supabase  = db(req.token);
  const { data: existing } = await supabase.from('categories').select('name').eq('user_id', req.user.id);
  const existingNames = new Set((existing||[]).map(c=>c.name.toLowerCase()));

  // Insere apenas as que ainda não existem
  const toInsert = DEFAULT_CATEGORIES
    .filter(c => !existingNames.has(c.name.toLowerCase()))
    .map(c => ({ ...c, user_id: req.user.id }));

  if (!toInsert.length) return res.json({ message: 'Todas as categorias padrão já existem', added: 0 });

  const { data, error } = await supabase.from('categories').insert(toInsert).select();
  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: `${data.length} categorias adicionadas`, added: data.length, categories: data });
});

module.exports = router;