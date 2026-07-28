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

// Calcula próximo vencimento com base no dia e parcelas pagas
function calcNextDue(startDate, dueDay, paidInstallments) {
  if (!startDate || !dueDay) return null;
  const start = new Date(startDate);
  const nextMonth = new Date(start.getFullYear(), start.getMonth() + paidInstallments, dueDay);
  return nextMonth.toISOString().split('T')[0];
}

// Listar dívidas com campos calculados
router.get('/', async (req, res) => {
  const { data, error } = await db(req.token)
    .from('debts')
    .select('*, categories(id,name,color)')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });
  if (error) return res.status(400).json({ error: error.message });

  const enriched = data.map(d => {
    const remaining   = d.total_amount - (d.paid_installments * d.installment_value);
    const pct         = Math.round(d.paid_installments / d.installments * 100);
    const done        = d.paid_installments >= d.installments;
    const nextDue     = done ? null : calcNextDue(d.start_date, d.due_day, d.paid_installments);
    const daysUntilDue = nextDue
      ? Math.ceil((new Date(nextDue) - new Date()) / (1000*60*60*24))
      : null;
    return { ...d, remaining: Math.max(0,remaining), pct, done, next_due: nextDue, days_until_due: daysUntilDue };
  });

  res.json(enriched);
});

// Criar dívida
router.post('/', async (req, res) => {
  const { name, total_amount, installments, installment_value, due_day, start_date, category_id, notes } = req.body;
  if (!name || !total_amount || !installments || !installment_value)
    return res.status(400).json({ error: 'Nome, valor total, parcelas e valor da parcela são obrigatórios' });

  const { data, error } = await db(req.token).from('debts')
    .insert({ name, total_amount, installments, installment_value, due_day, start_date, category_id: category_id||null, notes, user_id: req.user.id })
    .select('*, categories(id,name,color)').single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

// Atualizar dívida
router.put('/:id', async (req, res) => {
  const { name, total_amount, installments, installment_value, due_day, start_date, category_id, notes } = req.body;
  const { data, error } = await db(req.token).from('debts')
    .update({ name, total_amount, installments, installment_value, due_day, start_date, category_id: category_id||null, notes })
    .eq('id', req.params.id).eq('user_id', req.user.id)
    .select('*, categories(id,name,color)').single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Pagar próxima parcela
router.post('/:id/pay', async (req, res) => {
  const supabase = db(req.token);
  const { data: debt } = await supabase.from('debts')
    .select('paid_installments,installments,installment_value,name')
    .eq('id', req.params.id).single();

  if (!debt) return res.status(404).json({ error: 'Dívida não encontrada' });
  if (debt.paid_installments >= debt.installments)
    return res.status(400).json({ error: 'Todas as parcelas já foram pagas' });

  const newPaid = debt.paid_installments + 1;
  const { data, error } = await supabase.from('debts')
    .update({ paid_installments: newPaid })
    .eq('id', req.params.id).eq('user_id', req.user.id)
    .select('*, categories(id,name,color)').single();
  if (error) return res.status(400).json({ error: error.message });

  // Lança como despesa automaticamente se tiver categoria
  if (req.body.create_transaction) {
    const today = new Date().toISOString().split('T')[0];
    await supabase.from('transactions').insert({
      user_id:     req.user.id,
      description: `${debt.name} — parcela ${newPaid}/${debt.installments}`,
      amount:      debt.installment_value,
      type:        'expense',
      category_id: data.category_id || null,
      date:        today,
    });
  }

  res.json(data);
});

// Desfazer último pagamento
router.post('/:id/unpay', async (req, res) => {
  const supabase = db(req.token);
  const { data: debt } = await supabase.from('debts')
    .select('paid_installments').eq('id', req.params.id).single();
  if (!debt || debt.paid_installments === 0)
    return res.status(400).json({ error: 'Nenhuma parcela paga para desfazer' });

  const { data, error } = await supabase.from('debts')
    .update({ paid_installments: debt.paid_installments - 1 })
    .eq('id', req.params.id).eq('user_id', req.user.id)
    .select('*, categories(id,name,color)').single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Excluir dívida
router.delete('/:id', async (req, res) => {
  const { error } = await db(req.token).from('debts')
    .delete().eq('id', req.params.id).eq('user_id', req.user.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'ok' });
});

module.exports = router;
