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

// Inicializa web-push se disponível
let webpush = null;
try {
  webpush = require('web-push');
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      `mailto:${process.env.VAPID_EMAIL || 'app@financeapp.com'}`,
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
  }
} catch (_) { webpush = null; }

// Chave pública VAPID para o frontend
router.get('/vapid-public-key', (req, res) => {
  res.json({ key: process.env.VAPID_PUBLIC_KEY || null });
});

// Salvar subscription push
router.post('/subscribe', async (req, res) => {
  const { subscription } = req.body;
  if (!subscription) return res.status(400).json({ error: 'Subscription obrigatória' });
  const supabase = db(req.token);
  // Remove antigas do mesmo user e insere nova
  await supabase.from('push_subscriptions').delete().eq('user_id', req.user.id);
  const { error } = await supabase.from('push_subscriptions')
    .insert({ user_id: req.user.id, subscription });
  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'ok' });
});

// Remover subscription
router.delete('/subscribe', async (req, res) => {
  await db(req.token).from('push_subscriptions').delete().eq('user_id', req.user.id);
  res.json({ message: 'ok' });
});

// Listar notificações
router.get('/', async (req, res) => {
  const { data, error } = await db(req.token)
    .from('notifications')
    .select('*')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Marcar uma como lida
router.put('/:id/read', async (req, res) => {
  await db(req.token).from('notifications')
    .update({ read: true }).eq('id', req.params.id).eq('user_id', req.user.id);
  res.json({ message: 'ok' });
});

// Marcar todas como lidas
router.put('/read-all', async (req, res) => {
  await db(req.token).from('notifications')
    .update({ read: true }).eq('user_id', req.user.id).eq('read', false);
  res.json({ message: 'ok' });
});

// Excluir notificação
router.delete('/:id', async (req, res) => {
  await db(req.token).from('notifications')
    .delete().eq('id', req.params.id).eq('user_id', req.user.id);
  res.json({ message: 'ok' });
});

// Preferências
router.get('/preferences', async (req, res) => {
  const { data } = await db(req.token).from('notification_preferences')
    .select('*').eq('user_id', req.user.id).single();
  // Se não existe, retorna defaults
  res.json(data || { budget_exceeded: true, recurring_due: true, goal_completed: true, push_enabled: false });
});

router.put('/preferences', async (req, res) => {
  const { budget_exceeded, recurring_due, goal_completed, push_enabled } = req.body;
  const { data, error } = await db(req.token).from('notification_preferences')
    .upsert({ user_id: req.user.id, budget_exceeded, recurring_due, goal_completed, push_enabled },
             { onConflict: 'user_id' })
    .select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Verificar recorrentes do mês (chamado ao abrir o app)
router.post('/check-recurring', async (req, res) => {
  const supabase  = db(req.token);
  const today     = new Date();
  const currMonth = today.getMonth() + 1;
  const currYear  = today.getFullYear();

  // Verifica preferência
  const { data: prefs } = await supabase.from('notification_preferences')
    .select('recurring_due').eq('user_id', req.user.id).single();
  if (prefs && !prefs.recurring_due) return res.json({ sent: 0 });

  // Busca recorrentes ativas não geradas este mês
  const { data: recurrings } = await supabase.from('recurring_transactions')
    .select('*').eq('user_id', req.user.id).eq('active', true);

  const due = (recurrings || []).filter(r => {
    if (r.frequency !== 'monthly') return false;
    if (!r.last_created_at) return true;
    const last = new Date(r.last_created_at);
    return !(last.getMonth() + 1 === currMonth && last.getFullYear() === currYear);
  });

  if (!due.length) return res.json({ sent: 0 });

  // Verifica se já notificou hoje
  const todayStr = today.toISOString().split('T')[0];
  const { data: existing } = await supabase.from('notifications')
    .select('id').eq('user_id', req.user.id).eq('type', 'recurring_due')
    .gte('created_at', todayStr).limit(1);
  if (existing?.length) return res.json({ sent: 0 });

  // Cria notificação
  const title = `${due.length} recorrente${due.length > 1 ? 's' : ''} pendente${due.length > 1 ? 's' : ''}`;
  const body  = due.slice(0, 3).map(r => r.description || 'Sem descrição').join(', ');
  await createNotificationAndPush(supabase, req.user.id, 'recurring_due', title, body, { count: due.length });

  res.json({ sent: 1 });
});

// Helper: cria notificação + envia push se habilitado
async function createNotificationAndPush(supabase, userId, type, title, body, data = {}) {
  await supabase.from('notifications').insert({ user_id: userId, type, title, body, data });

  if (!webpush) return;
  const { data: prefs } = await supabase.from('notification_preferences')
    .select('push_enabled').eq('user_id', userId).single();
  if (!prefs?.push_enabled) return;

  const { data: subs } = await supabase.from('push_subscriptions')
    .select('subscription').eq('user_id', userId);
  for (const sub of subs || []) {
    try {
      await webpush.sendNotification(sub.subscription, JSON.stringify({ title, body, data }));
    } catch (_) {}
  }
}

// Exporta helper para uso em outras rotas
router.createNotification = createNotificationAndPush;
module.exports = router;
