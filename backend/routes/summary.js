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

async function getMonthSummary(supabase, userId, month, year) {
  const start = `${year}-${String(month).padStart(2,'0')}-01`;
  const end   = new Date(year, month, 0).toISOString().split('T')[0];

  const { data: txs } = await supabase.from('transactions')
    .select('amount,type,category_id,transfer_id,is_investment,categories(name,color)')
    .eq('user_id', userId).gte('date', start).lte('date', end)
    .neq('status','pending');

  const real = (txs||[]).filter(t => !t.transfer_id);

  // Investimentos NÃO contam como despesa no dashboard
  const income  = real.filter(t=>t.type==='income' && !t.is_investment).reduce((s,t)=>s+Number(t.amount),0);
  const expense = real.filter(t=>t.type==='expense'&& !t.is_investment).reduce((s,t)=>s+Number(t.amount),0);
  const invested= real.filter(t=>t.is_investment).reduce((s,t)=>s+Number(t.amount),0);

  const byCat = {};
  real.filter(t=>t.type==='expense'&&!t.is_investment&&t.category_id).forEach(t=>{
    const n = t.categories?.name||'Sem categoria';
    const c = t.categories?.color||'#6b7280';
    if (!byCat[t.category_id]) byCat[t.category_id]={ name:n, color:c, value:0, category_id:t.category_id };
    byCat[t.category_id].value += Number(t.amount);
  });

  return {
    income:  Math.round(income  * 100) / 100,
    expense: Math.round(expense * 100) / 100,
    balance: Math.round((income - expense) * 100) / 100,
    invested:Math.round(invested* 100) / 100,
    byCategory: Object.values(byCat).sort((a,b)=>b.value-a.value),
  };
}

// GET /api/summary?month=8&year=2026
router.get('/', async (req, res) => {
  const supabase = db(req.token);
  const month    = Number(req.query.month) || new Date().getMonth()+1;
  const year     = Number(req.query.year)  || new Date().getFullYear();

  // Mês anterior
  const prevMonth = month===1 ? 12 : month-1;
  const prevYear  = month===1 ? year-1 : year;

  const [curr, prev] = await Promise.all([
    getMonthSummary(supabase, req.user.id, month, year),
    getMonthSummary(supabase, req.user.id, prevMonth, prevYear),
  ]);

  // Calcula variação percentual
  function pctChange(curr, prev) {
    if (!prev || prev === 0) return null;
    return Math.round(((curr - prev) / prev) * 100);
  }

  res.json({
    ...curr,
    prev: prev,
    changes: {
      income:  pctChange(curr.income,  prev.income),
      expense: pctChange(curr.expense, prev.expense),
      balance: pctChange(curr.balance, prev.balance),
    },
  });
});

module.exports = router;
