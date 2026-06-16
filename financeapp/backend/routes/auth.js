const express  = require('express');
const router   = express.Router();
const supabase = require('../lib/supabase');

router.post('/register', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email e senha são obrigatórios' });
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
  if (error) return res.status(400).json({ error: error.message });
  if (data.user) {
    const cats = [
      { name:'Moradia',     color:'#6366f1', is_fixed:true, user_id:data.user.id },
      { name:'Alimentação', color:'#f59e0b', is_fixed:true, user_id:data.user.id },
      { name:'Transporte',  color:'#10b981', is_fixed:true, user_id:data.user.id },
      { name:'Saúde',       color:'#ef4444', is_fixed:true, user_id:data.user.id },
      { name:'Lazer',       color:'#8b5cf6', is_fixed:true, user_id:data.user.id },
      { name:'Outros',      color:'#6b7280', is_fixed:true, user_id:data.user.id },
    ];
    await supabase.from('categories').insert(cats);
  }
  res.status(201).json({ user: data.user, session: data.session });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email e senha são obrigatórios' });
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return res.status(401).json({ error: 'Email ou senha incorretos' });
  res.json({ user: data.user, session: data.session });
});

router.post('/logout', async (req, res) => {
  await supabase.auth.signOut();
  res.json({ message: 'ok' });
});

module.exports = router;
