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

// Calcula período da fatura aberta atual
function getInvoicePeriod(closingDay) {
  const today = new Date();
  const day   = today.getDate();
  let startDate, endDate;

  if (day <= closingDay) {
    // Antes do fechamento: fatura aberta começou no fechamento do mês passado +1
    startDate = new Date(today.getFullYear(), today.getMonth() - 1, closingDay + 1);
    endDate   = new Date(today.getFullYear(), today.getMonth(),     closingDay);
  } else {
    // Depois do fechamento: fatura aberta começou hoje (fechamento deste mês +1)
    startDate = new Date(today.getFullYear(), today.getMonth(),     closingDay + 1);
    endDate   = new Date(today.getFullYear(), today.getMonth() + 1, closingDay);
  }

  return {
    start: startDate.toISOString().split('T')[0],
    end:   endDate.toISOString().split('T')[0],
  };
}

// Listar cartões com totais da fatura atual
router.get('/', async (req, res) => {
  const supabase = db(req.token);
  const { data: cards, error } = await supabase
    .from('credit_cards').select('*').eq('user_id', req.user.id)
    .order('created_at', { ascending: false });
  if (error) return res.status(400).json({ error: error.message });

  const enriched = await Promise.all(cards.map(async card => {
    const period = getInvoicePeriod(card.closing_day || 1);

    // Total da fatura atual
    const { data: txs } = await supabase.from('transactions')
      .select('amount,category_id,categories(name,color)')
      .eq('user_id', req.user.id)
      .eq('credit_card_id', card.id)
      .gte('date', period.start).lte('date', period.end);

    const invoice_total = (txs||[]).reduce((s,t) => s+Number(t.amount), 0);

    // Agrupado por categoria
    const byCategory = {};
    (txs||[]).forEach(t => {
      const key  = t.category_id || 'sem';
      const name = t.categories?.name  || 'Sem categoria';
      const color= t.categories?.color || '#6b7280';
      if (!byCategory[key]) byCategory[key] = { name, color, total: 0 };
      byCategory[key].total += Number(t.amount);
    });

    return {
      ...card,
      invoice_period:  period,
      invoice_total:   Math.round(invoice_total * 100) / 100,
      available_limit: Math.max(0, Number(card.limit_amount) - invoice_total),
      used_pct:        card.limit_amount > 0 ? Math.round(invoice_total / card.limit_amount * 100) : 0,
      invoice_by_category: Object.values(byCategory).sort((a,b) => b.total - a.total),
    };
  }));

  res.json(enriched);
});

// Criar cartão
router.post('/', async (req, res) => {
  const { name, limit_amount, closing_day, due_day, color, icon } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });
  const { data, error } = await db(req.token).from('credit_cards')
    .insert({ name, limit_amount: limit_amount||0, closing_day, due_day, color: color||'#7c7ff7', icon: icon||'💳', user_id: req.user.id })
    .select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

// Atualizar
router.put('/:id', async (req, res) => {
  const { name, limit_amount, closing_day, due_day, color, icon } = req.body;
  const { data, error } = await db(req.token).from('credit_cards')
    .update({ name, limit_amount, closing_day, due_day, color, icon })
    .eq('id', req.params.id).eq('user_id', req.user.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Excluir
router.delete('/:id', async (req, res) => {
  const { error } = await db(req.token).from('credit_cards')
    .delete().eq('id', req.params.id).eq('user_id', req.user.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'ok' });
});

// Transações de um cartão num período
router.get('/:id/transactions', async (req, res) => {
  const { start, end } = req.query;
  const { data, error } = await db(req.token).from('transactions')
    .select('*, categories(id,name,color)')
    .eq('user_id', req.user.id)
    .eq('credit_card_id', req.params.id)
    .gte('date', start).lte('date', end)
    .order('date', { ascending: false });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Pagar fatura — lança débito em conta e zera referência do período
router.post('/:id/pay', async (req, res) => {
  const { account_id, amount, date } = req.body;
  if (!account_id || !amount || !date)
    return res.status(400).json({ error: 'Conta, valor e data são obrigatórios' });

  const supabase = db(req.token);
  const { data: card } = await supabase.from('credit_cards').select('name').eq('id', req.params.id).single();

  // Lança despesa na conta bancária
  const { data, error } = await supabase.from('transactions')
    .insert({
      user_id:     req.user.id,
      description: `Fatura ${card?.name || 'Cartão'}`,
      amount,
      type:        'expense',
      account_id,
      date,
    })
    .select('*, categories(id,name,color), accounts(id,name,color,icon)')
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

module.exports = router;
