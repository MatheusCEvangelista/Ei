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

// Calcula meses entre hoje e deadline
function monthsUntil(deadline) {
  if (!deadline) return null;
  const now  = new Date();
  const end  = new Date(deadline);
  const diff = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());
  return Math.max(0, diff);
}

// Enriquece meta com cálculos automáticos
function enrichGoal(goal) {
  const remaining = Math.max(0, Number(goal.target_amount) - Number(goal.current_amount));
  const pct       = goal.target_amount > 0
    ? Math.min(100, Math.round(Number(goal.current_amount) / Number(goal.target_amount) * 100))
    : 0;

  const months_left    = monthsUntil(goal.deadline);
  const monthly_target = months_left > 0 ? Math.ceil(remaining / months_left * 100) / 100 : null;
  const on_track       = monthly_target !== null ? (goal.monthly_saved || 0) >= monthly_target : null;

  // Estimativa de quando vai atingir baseado no ritmo atual
  let estimated_completion = null;
  if (goal.monthly_saved > 0 && remaining > 0) {
    const monthsNeeded = Math.ceil(remaining / goal.monthly_saved);
    const comp = new Date();
    comp.setMonth(comp.getMonth() + monthsNeeded);
    estimated_completion = comp.toISOString().split('T')[0];
  }

  return {
    ...goal,
    remaining:            Math.round(remaining * 100) / 100,
    pct,
    months_left,
    monthly_target,
    on_track,
    estimated_completion,
  };
}

// Listar metas
router.get('/', async (req, res) => {
  const supabase = db(req.token);
  const { data, error } = await supabase
    .from('goals').select('*')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });
  if (error) return res.status(400).json({ error: error.message });

  // Calcula quanto foi guardado por meta no mês atual (via transactions com goal_id se existir)
  const today  = new Date();
  const start  = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-01`;
  const end    = new Date(today.getFullYear(), today.getMonth()+1, 0).toISOString().split('T')[0];

  const enriched = data.map(g => enrichGoal({ ...g, monthly_saved: 0 }));
  res.json(enriched);
});

// Criar meta
router.post('/', async (req, res) => {
  const { name, target_amount, current_amount, deadline, icon, color } = req.body;
  if (!name || !target_amount) return res.status(400).json({ error: 'Nome e valor alvo são obrigatórios' });

  const { data, error } = await db(req.token).from('goals').insert({
    name, target_amount, current_amount: current_amount || 0,
    deadline: deadline || null, icon: icon || '🎯', color: color || '#7c3aed',
    user_id: req.user.id,
  }).select().single();

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(enrichGoal(data));
});

// Atualizar meta
router.put('/:id', async (req, res) => {
  const { name, target_amount, current_amount, deadline, icon, color } = req.body;
  const { data, error } = await db(req.token).from('goals')
    .update({ name, target_amount, current_amount, deadline: deadline||null, icon, color })
    .eq('id', req.params.id).eq('user_id', req.user.id)
    .select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(enrichGoal(data));
});

// Adicionar aporte à meta
router.patch('/:id/contribute', async (req, res) => {
  const { amount } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Valor inválido' });

  const supabase = db(req.token);
  const { data: goal } = await supabase.from('goals').select('current_amount,target_amount').eq('id', req.params.id).eq('user_id', req.user.id).single();
  if (!goal) return res.status(404).json({ error: 'Meta não encontrada' });

  const newAmount = Math.min(Number(goal.current_amount) + Number(amount), Number(goal.target_amount));
  const done      = newAmount >= Number(goal.target_amount);

  const { data, error } = await supabase.from('goals')
    .update({ current_amount: newAmount, done })
    .eq('id', req.params.id).eq('user_id', req.user.id)
    .select().single();

  if (error) return res.status(400).json({ error: error.message });
  res.json({ ...enrichGoal(data), just_completed: done });
});

// Excluir
router.delete('/:id', async (req, res) => {
  const { error } = await db(req.token).from('goals').delete().eq('id', req.params.id).eq('user_id', req.user.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'ok' });
});

module.exports = router;
