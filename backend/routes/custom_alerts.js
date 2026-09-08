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

async function safeQuery(q) {
  try { const { data } = await q; return data || []; } catch { return []; }
}

// Listar alertas
router.get('/', async (req, res) => {
  const { data, error } = await db(req.token).from('custom_alerts')
    .select('*, categories(name,color,icon)')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Criar alerta
router.post('/', async (req, res) => {
  const { type, description, threshold, category_id, day_of_month, goal_id, goal_pct } = req.body;
  if (!type) return res.status(400).json({ error: 'Tipo de alerta obrigatório' });

  const { data, error } = await db(req.token).from('custom_alerts').insert({
    user_id: req.user.id, type, description,
    threshold:    threshold    || null,
    category_id:  category_id  || null,
    day_of_month: day_of_month || null,
    goal_id:      goal_id      || null,
    goal_pct:     goal_pct     || null,
    active: true,
  }).select('*, categories(name,color,icon)').single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

// Ativar/desativar
router.patch('/:id/toggle', async (req, res) => {
  const supabase = db(req.token);
  const { data: alert } = await supabase.from('custom_alerts')
    .select('active').eq('id', req.params.id).eq('user_id', req.user.id).single();
  if (!alert) return res.status(404).json({ error: 'Alerta não encontrado' });
  const { data, error } = await supabase.from('custom_alerts')
    .update({ active: !alert.active })
    .eq('id', req.params.id).eq('user_id', req.user.id)
    .select('*, categories(name,color,icon)').single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Excluir
router.delete('/:id', async (req, res) => {
  const { error } = await db(req.token).from('custom_alerts')
    .delete().eq('id', req.params.id).eq('user_id', req.user.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'ok' });
});

// Verificar e disparar alertas
router.post('/check', async (req, res) => {
  const supabase   = db(req.token);
  const today      = new Date();
  const dayOfMonth = today.getDate();
  const month      = today.getMonth() + 1;
  const year       = today.getFullYear();
  const start      = `${year}-${String(month).padStart(2,'0')}-01`;
  const end        = new Date(year, month, 0).toISOString().split('T')[0];

  const alerts = await safeQuery(
    supabase.from('custom_alerts')
      .select('*, categories(name), goals(name,current_amount,target_amount)')
      .eq('user_id', req.user.id).eq('active', true)
  );
  if (!alerts.length) return res.json({ triggered: [], skipped: [] });

  const [txs, goals] = await Promise.all([
    safeQuery(supabase.from('transactions').select('amount,type,category_id,transfer_id').eq('user_id',req.user.id).gte('date',start).lte('date',end)),
    safeQuery(supabase.from('goals').select('id,name,current_amount,target_amount').eq('user_id',req.user.id)),
  ]);

  const real    = txs.filter(t=>!t.transfer_id);
  const expense = real.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);
  const income  = real.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0);
  const balance = income - expense;
  const byCat   = {};
  real.filter(t=>t.type==='expense'&&t.category_id).forEach(t=>{
    byCat[t.category_id] = (byCat[t.category_id]||0) + Number(t.amount);
  });

  const triggered = [];

  for (const alert of alerts) {
    let fired = false, message = '';
    const fmt = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);

    switch(alert.type) {
      case 'category_limit': {
        const spent = byCat[alert.category_id]||0;
        if (alert.threshold && spent >= alert.threshold) {
          fired   = true;
          message = `Você gastou ${fmt(spent)} em ${alert.categories?.name||'categoria'} — limite de ${fmt(alert.threshold)} atingido.`;
        }
        break;
      }
      case 'balance_low': {
        if (alert.threshold && balance < alert.threshold) {
          fired   = true;
          message = `Saldo do mês está em ${fmt(balance)}, abaixo do alerta de ${fmt(alert.threshold)}.`;
        }
        break;
      }
      case 'reminder': {
        if (alert.day_of_month && today.getDate() === alert.day_of_month) {
          fired   = true;
          message = alert.description || 'Lembrete financeiro do dia.';
        }
        break;
      }
      case 'goal_progress': {
        const goal = goals.find(g=>g.id===alert.goal_id);
        if (goal && alert.goal_pct) {
          const pct = goal.target_amount > 0
            ? Math.round(goal.current_amount / goal.target_amount * 100) : 0;
          if (pct >= alert.goal_pct) {
            fired   = true;
            message = `Meta "${goal.name}" atingiu ${pct}%!`;
          }
        }
        break;
      }
    }

    if (fired) {
      triggered.push({ alert_id: alert.id, type: alert.type, message });
      try {
        await supabase.from('notifications').insert({
          user_id: req.user.id,
          type:    'custom_alert',
          title:   '🔔 ' + (alert.description || 'Alerta personalizado'),
          body:    message,
          data:    { alert_id: alert.id },
          read:    false,
        });
      } catch {}
    }
  }

  res.json({ triggered, count: triggered.length });
});

module.exports = router;
