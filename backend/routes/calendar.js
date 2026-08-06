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

// GET /api/calendar?month=7&year=2026
router.get('/', async (req, res) => {
  const supabase = db(req.token);
  const month    = Number(req.query.month) || new Date().getMonth() + 1;
  const year     = Number(req.query.year)  || new Date().getFullYear();
  const start    = `${year}-${String(month).padStart(2,'0')}-01`;
  const end      = new Date(year, month, 0).toISOString().split('T')[0];
  const daysInMonth = new Date(year, month, 0).getDate();

  const [transactions, debts, recurrings, cards] = await Promise.all([
    safeQuery(supabase.from('transactions').select('id,date,amount,type,description,categories(name,color),transfer_id').eq('user_id',req.user.id).gte('date',start).lte('date',end).order('date')),
    safeQuery(supabase.from('debts').select('id,name,installment_value,paid_installments,installments,due_day,start_date').eq('user_id',req.user.id)),
    safeQuery(supabase.from('recurring_transactions').select('id,description,amount,type,day_of_month,frequency').eq('user_id',req.user.id).eq('active',true)),
    safeQuery(supabase.from('credit_cards').select('id,name,closing_day,due_day,color').eq('user_id',req.user.id)),
  ]);

  // Monta mapa dia → eventos
  const dayMap = {};
  for (let d = 1; d <= daysInMonth; d++) dayMap[d] = [];

  // 1. Transações reais
  transactions.filter(t=>!t.transfer_id).forEach(t => {
    const day = new Date(t.date+'T00:00:00').getDate();
    dayMap[day]?.push({
      type:  'transaction',
      kind:  t.type,
      label: t.description || t.categories?.name || '—',
      amount: Number(t.amount),
      color: t.type === 'income' ? 'var(--green)' : 'var(--red)',
      category: t.categories?.name,
      categoryColor: t.categories?.color,
      id: t.id,
    });
  });

  // 2. Dívidas — parcela vencendo no mês
  debts.filter(d => d.paid_installments < d.installments).forEach(debt => {
    if (!debt.start_date || !debt.due_day) return;
    const dt = new Date(debt.start_date);
    dt.setMonth(dt.getMonth() + debt.paid_installments);
    dt.setDate(debt.due_day);
    if (dt.getMonth()+1 === month && dt.getFullYear() === year) {
      const day = dt.getDate();
      if (dayMap[day]) dayMap[day].push({
        type:   'debt',
        label:  debt.name,
        amount: Number(debt.installment_value),
        color:  'var(--amber)',
        installment: `${debt.paid_installments+1}/${debt.installments}`,
        id: debt.id,
      });
    }
  });

  // 3. Recorrentes mensais previstas
  recurrings.filter(r => r.frequency === 'monthly' && r.day_of_month).forEach(rec => {
    const day = Math.min(rec.day_of_month, daysInMonth);
    if (dayMap[day]) dayMap[day].push({
      type:   'recurring',
      kind:   rec.type,
      label:  rec.description || '—',
      amount: Number(rec.amount),
      color:  rec.type === 'income' ? 'var(--green)' : 'var(--indigo)',
      id: rec.id,
    });
  });

  // 4. Cartões — fechamento e vencimento
  cards.forEach(card => {
    if (card.closing_day) {
      const day = Math.min(card.closing_day, daysInMonth);
      if (dayMap[day]) dayMap[day].push({
        type:  'card_closing',
        label: `Fecha ${card.name}`,
        color: card.color || 'var(--red)',
        id: card.id,
      });
    }
    if (card.due_day) {
      const day = Math.min(card.due_day, daysInMonth);
      if (dayMap[day]) dayMap[day].push({
        type:  'card_due',
        label: `Vence ${card.name}`,
        color: card.color || 'var(--red)',
        id: card.id,
      });
    }
  });

  // Resumo do mês
  const realTxs = transactions.filter(t=>!t.transfer_id);
  const summary = {
    income:  realTxs.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0),
    expense: realTxs.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0),
    debtsDue:     debts.filter(d=>{ if(d.paid_installments>=d.installments||!d.start_date||!d.due_day) return false; const dt=new Date(d.start_date); dt.setMonth(dt.getMonth()+d.paid_installments); dt.setDate(d.due_day); return dt.getMonth()+1===month&&dt.getFullYear()===year; }).length,
    recurringsDue: recurrings.filter(r=>r.frequency==='monthly'&&r.day_of_month).length,
  };

  res.json({ month, year, days: dayMap, summary });
});

module.exports = router;
