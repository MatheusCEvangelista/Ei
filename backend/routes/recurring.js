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

// Listar recorrentes
router.get('/', async (req, res) => {
  const { data, error } = await db(req.token).from('recurring_transactions')
    .select('*, categories(id,name,color), accounts(id,name,icon,color)')
    .eq('user_id', req.user.id).order('created_at', { ascending: false });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Criar recorrente
router.post('/', async (req, res) => {
  const { description, amount, type, frequency, day_of_month, category_id, account_id, auto_confirm } = req.body;
  if (!description || !amount || !type || !frequency)
    return res.status(400).json({ error: 'Campos obrigatórios: description, amount, type, frequency' });
  const { data, error } = await db(req.token).from('recurring_transactions').insert({
    description, amount, type, frequency,
    day_of_month: day_of_month || null,
    category_id:  category_id  || null,
    account_id:   account_id   || null,
    auto_confirm: auto_confirm !== false, // default: true
    active:       true,
    user_id:      req.user.id,
  }).select('*, categories(id,name,color), accounts(id,name,icon,color)').single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

// Atualizar
router.put('/:id', async (req, res) => {
  const { description, amount, type, frequency, day_of_month, category_id, account_id, active, auto_confirm } = req.body;
  const { data, error } = await db(req.token).from('recurring_transactions')
    .update({ description, amount, type, frequency, day_of_month: day_of_month||null, category_id: category_id||null, account_id: account_id||null, active, auto_confirm })
    .eq('id', req.params.id).eq('user_id', req.user.id)
    .select('*, categories(id,name,color), accounts(id,name,icon,color)').single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Excluir
router.delete('/:id', async (req, res) => {
  const { error } = await db(req.token).from('recurring_transactions')
    .delete().eq('id', req.params.id).eq('user_id', req.user.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'ok' });
});

// ── Verificação diária — chamado pelo frontend ao abrir o app ─────────────
// Cria automaticamente as transações recorrentes do dia e notifica
router.post('/check', async (req, res) => {
  const supabase  = db(req.token);
  const today     = new Date();
  const dayOfMonth= today.getDate();
  const month     = today.getMonth() + 1;
  const year      = today.getFullYear();
  const dateStr   = today.toISOString().split('T')[0];

  // Busca recorrentes mensais ativas com dia configurado = hoje
  const { data: recurrings } = await supabase.from('recurring_transactions')
    .select('*, categories(id,name), accounts(id,name)')
    .eq('user_id', req.user.id).eq('active', true)
    .eq('frequency', 'monthly').eq('day_of_month', dayOfMonth);

  if (!recurrings?.length) return res.json({ created: [], skipped: [] });

  const created = [], skipped = [];

  for (const rec of recurrings) {
    // Verifica se já foi gerada este mês
    const { data: existing } = await supabase.from('transactions')
      .select('id').eq('user_id', req.user.id)
      .eq('recurring_id', rec.id)
      .gte('date', `${year}-${String(month).padStart(2,'0')}-01`)
      .lte('date', new Date(year, month, 0).toISOString().split('T')[0])
      .limit(1);

    if (existing?.length) { skipped.push(rec.id); continue; }

    // Cria a transação
    const { data: tx } = await supabase.from('transactions').insert({
      user_id:      req.user.id,
      description:  rec.description,
      amount:       rec.amount,
      type:         rec.type,
      date:         dateStr,
      category_id:  rec.category_id  || null,
      account_id:   rec.account_id   || null,
      recurring_id: rec.id,
      status:       'confirmed',
    }).select().single();

    if (tx) {
      // Atualiza last_created_at
      await supabase.from('recurring_transactions')
        .update({ last_created_at: dateStr }).eq('id', rec.id);

      // Cria notificação no sino com referência à transação criada
      await supabase.from('notifications').insert({
        user_id: req.user.id,
        type:    'recurring_created',
        title:   `🔄 ${rec.description} lançado`,
        body:    `Recorrente de ${new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(rec.amount)} criado automaticamente. Toque para desfazer.`,
        data:    { transaction_id: tx.id, recurring_id: rec.id },
        read:    false,
      });

      created.push({ recurring: rec, transaction: tx });
    }
  }

  res.json({ created, skipped, total: created.length });
});

module.exports = router;
