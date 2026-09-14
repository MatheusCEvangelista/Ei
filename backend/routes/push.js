const express  = require('express');
const router   = express.Router();
const webpush  = require('web-push');
const { createClient } = require('@supabase/supabase-js');
const authMiddleware   = require('../middleware/auth');

// Configurar VAPID
webpush.setVapidDetails(
  `mailto:${process.env.VAPID_EMAIL||'admin@ei.app'}`,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY,
);

router.use(authMiddleware);

function db(token) {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

// Salvar subscription
router.post('/subscribe', async (req, res) => {
  const { subscription } = req.body;
  if (!subscription?.endpoint) return res.status(400).json({ error:'Subscription inválida' });

  const supabase = db(req.token);
  // Upsert por endpoint
  await supabase.from('push_subscriptions').upsert({
    user_id:      req.user.id,
    endpoint:     subscription.endpoint,
    subscription: JSON.stringify(subscription),
    updated_at:   new Date().toISOString(),
  }, { onConflict:'endpoint' });

  res.json({ message:'ok' });
});

// Enviar push para o usuário autenticado
router.post('/send', async (req, res) => {
  const { title, body, url } = req.body;
  if (!title) return res.status(400).json({ error:'title obrigatório' });

  const supabase = db(req.token);
  const { data: subs } = await supabase.from('push_subscriptions')
    .select('subscription').eq('user_id', req.user.id);

  if (!subs?.length) return res.json({ sent:0, message:'Nenhuma subscription encontrada' });

  let sent=0;
  for (const row of subs) {
    try {
      const sub = JSON.parse(row.subscription);
      await webpush.sendNotification(sub, JSON.stringify({ title, body, url: url||'/' }));
      sent++;
    } catch(err) {
      // Remove subscriptions expiradas
      if (err.statusCode===410) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', JSON.parse(row.subscription).endpoint);
      }
    }
  }
  res.json({ sent });
});

module.exports = router;
