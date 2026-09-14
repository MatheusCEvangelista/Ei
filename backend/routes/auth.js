const express = require('express');
const router  = express.Router();
const { createClient } = require('@supabase/supabase-js');

// Cliente público (sem token) — usado para login/registro
function publicDb() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
}

// Cliente autenticado — usado para rotas protegidas
function db(token) {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

// ── Registro ──────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'E-mail e senha são obrigatórios' });

  const { data, error } = await publicDb().auth.signUp({
    email,
    password,
    options: { data: { name: name || email.split('@')[0] } },
  });

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json({ user: data.user, session: data.session });
});

// ── Login ─────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'E-mail e senha são obrigatórios' });

  const { data, error } = await publicDb().auth.signInWithPassword({ email, password });
  if (error) return res.status(401).json({ error: error.message });
  res.json({ user: data.user, session: data.session });
});

// ── Refresh token ─────────────────────────────────────────────────────────
router.post('/refresh', async (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token)
    return res.status(400).json({ error: 'refresh_token obrigatório' });

  const { data, error } = await publicDb().auth.refreshSession({ refresh_token });
  if (error) return res.status(401).json({ error: error.message });
  res.json({ user: data.user, session: data.session });
});

// ── Logout ────────────────────────────────────────────────────────────────
router.post('/logout', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    await db(token).auth.signOut().catch(() => {});
  }
  res.json({ message: 'ok' });
});

// ── Usuário atual ─────────────────────────────────────────────────────────
router.get('/me', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Não autenticado' });

  const { data, error } = await db(token).auth.getUser();
  if (error) return res.status(401).json({ error: error.message });
  res.json({ user: data.user });
});

// ── Atualizar perfil (nome) ───────────────────────────────────────────────
router.put('/profile', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Não autenticado' });

  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Nome inválido' });

  const { error } = await db(token).auth.updateUser({ data: { name: name.trim() } });
  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'ok' });
});

// ── Alterar senha ─────────────────────────────────────────────────────────
router.put('/password', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Não autenticado' });

  const { password } = req.body;
  if (!password || password.length < 6)
    return res.status(400).json({ error: 'Senha deve ter pelo menos 6 caracteres' });

  const { error } = await db(token).auth.updateUser({ password });
  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'ok' });
});

// ── Reset de senha (e-mail) ───────────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'E-mail obrigatório' });

  const { error } = await publicDb().auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.FRONTEND_URL}/reset-password`,
  });
  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'E-mail de redefinição enviado' });
});

module.exports = router;