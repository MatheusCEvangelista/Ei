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

// GET /api/search?q=mercado&limit=30
router.get('/', async (req, res) => {
  const q     = (req.query.q || '').trim();
  const limit = Math.min(50, Number(req.query.limit) || 30);
  if (!q || q.length < 2) return res.json([]);

  const { data, error } = await db(req.token).from('transactions')
    .select('id,amount,type,description,date,category_id,categories(name,color),accounts(name,icon)')
    .eq('user_id', req.user.id)
    .ilike('description', `%${q}%`)
    .neq('status', 'pending')
    .order('date', { ascending: false })
    .limit(limit);

  if (error) return res.status(400).json({ error: error.message });
  res.json(data || []);
});

module.exports = router;
