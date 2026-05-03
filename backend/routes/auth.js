const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');

// Cadastro
router.post('/register', async (req, res) => {
  const { email, password, name } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios' });
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });

  if (error) return res.status(400).json({ error: error.message });

  // Insere categorias fixas padrão para o novo usuário
  if (data.user) {
    const defaultCategories = [
      { name: 'Moradia',      color: '#6366f1', is_fixed: true, user_id: data.user.id },
      { name: 'Alimentação',  color: '#f59e0b', is_fixed: true, user_id: data.user.id },
      { name: 'Transporte',   color: '#10b981', is_fixed: true, user_id: data.user.id },
      { name: 'Saúde',        color: '#ef4444', is_fixed: true, user_id: data.user.id },
      { name: 'Lazer',        color: '#8b5cf6', is_fixed: true, user_id: data.user.id },
      { name: 'Outros',       color: '#6b7280', is_fixed: true, user_id: data.user.id },
    ];

    // Usa service role key para inserir sem RLS (ou ajuste as políticas no Supabase)
    await supabase.from('categories').insert(defaultCategories);
  }

  res.status(201).json({ user: data.user, session: data.session });
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios' });
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return res.status(401).json({ error: 'Email ou senha incorretos' });

  res.json({ user: data.user, session: data.session });
});

// Logout
router.post('/logout', async (req, res) => {
  const { error } = await supabase.auth.signOut();
  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'Logout realizado com sucesso' });
});

module.exports = router;
