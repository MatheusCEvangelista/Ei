const express = require('express');
const router  = express.Router();
const { createClient } = require('@supabase/supabase-js');
const authMiddleware   = require('../middleware/auth');

router.use(authMiddleware);

// Cliente admin — usa service role para atualizar dados de auth
// Nunca expor SUPABASE_SERVICE_ROLE_KEY no frontend
function adminDb() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// PUT /api/profile/name — atualizar nome
router.put('/name', async (req, res) => {
  const { name } = req.body;
  if (!name?.trim())
    return res.status(400).json({ error: 'Nome inválido' });

  const { error } = await adminDb().auth.admin.updateUserById(
    req.user.id,
    { user_metadata: { name: name.trim() } }
  );

  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'ok', name: name.trim() });
});

// PUT /api/profile/password — alterar senha
router.put('/password', async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6)
    return res.status(400).json({ error: 'Senha deve ter pelo menos 6 caracteres' });

  const { error } = await adminDb().auth.admin.updateUserById(
    req.user.id,
    { password }
  );

  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'ok' });
});

module.exports = router;