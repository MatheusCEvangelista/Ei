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

// Atualizar nome do perfil
router.put('/profile', async (req, res) => {
  const { name } = req.body;
  const supabase  = db(req.token);
  const { error } = await supabase.auth.updateUser({ data: { name } });
  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'ok' });
});

// Alterar senha
router.put('/password', async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6)
    return res.status(400).json({ error: 'Senha deve ter pelo menos 6 caracteres' });
  const supabase  = db(req.token);
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'ok' });
});

module.exports = router;
