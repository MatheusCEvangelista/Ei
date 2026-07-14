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

router.get('/', async (req, res) => {
  const { month, year, account_id } = req.query;
  const start = `${year}-${String(month).padStart(2,'0')}-01`;
  const end   = new Date(year, month, 0).toISOString().split('T')[0];

  let query = db(req.token).from('transactions')
    .select('amount,type,categories(name,color)')
    .eq('user_id', req.user.id).gte('date', start).lte('date', end);
  if (account_id) query = query.eq('account_id', account_id);

  const { data, error } = await query;
  if (error) return res.status(400).json({ error: error.message });

  const income  = data.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0);
  const expense = data.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);

  const byCategory = {};
  data.filter(t=>t.type==='expense').forEach(t => {
    const name = t.categories?.name || 'Sem categoria';
    if (!byCategory[name]) byCategory[name] = { name, value:0, color: t.categories?.color||'#6b7280' };
    byCategory[name].value += Number(t.amount);
  });

  res.json({ income, expense, balance: income-expense, byCategory: Object.values(byCategory) });
});

router.get('/evolution', async (req, res) => {
  const today  = new Date();
  const months = Array.from({length:6},(_,i) => {
    const d = new Date(today.getFullYear(), today.getMonth()-i, 1);
    return { month: d.getMonth()+1, year: d.getFullYear() };
  }).reverse();

  const results = await Promise.all(months.map(async ({month,year}) => {
    const start = `${year}-${String(month).padStart(2,'0')}-01`;
    const end   = new Date(year, month, 0).toISOString().split('T')[0];
    const { data } = await db(req.token).from('transactions')
      .select('amount,type').eq('user_id', req.user.id).gte('date',start).lte('date',end);
    const income  = (data||[]).filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0);
    const expense = (data||[]).filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);
    return { label: new Date(year,month-1).toLocaleString('pt-BR',{month:'short'}), income, expense };
  }));

  res.json(results);
});

router.get('/analysis', async (req, res) => {
  const { month, year } = req.query;
  const start = `${year}-${String(month).padStart(2,'0')}-01`;
  const end   = new Date(year, month, 0).toISOString().split('T')[0];
  const prevMonth = Number(month)===1 ? 12 : Number(month)-1;
  const prevYear  = Number(month)===1 ? Number(year)-1 : Number(year);
  const prevStart = `${prevYear}-${String(prevMonth).padStart(2,'0')}-01`;
  const prevEnd   = new Date(prevYear, prevMonth, 0).toISOString().split('T')[0];

  const [{ data: curr }, { data: prev }] = await Promise.all([
    db(req.token).from('transactions').select('amount,type,categories(name)')
      .eq('user_id', req.user.id).gte('date',start).lte('date',end),
    db(req.token).from('transactions').select('amount,type')
      .eq('user_id', req.user.id).gte('date',prevStart).lte('date',prevEnd),
  ]);

  const income      = (curr||[]).filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0);
  const expense     = (curr||[]).filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);
  const prevIncome  = (prev||[]).filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0);
  const prevExpense = (prev||[]).filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);

  const byCat = {};
  (curr||[]).filter(t=>t.type==='expense').forEach(t => {
    const k = t.categories?.name||'Sem categoria';
    byCat[k] = (byCat[k]||0) + Number(t.amount);
  });
  const topCategories = Object.entries(byCat).sort((a,b)=>b[1]-a[1]).slice(0,3)
    .map(([name,value]) => ({ name, value, pct: expense>0?Math.round(value/expense*100):0 }));

  res.json({
    income, expense, balance: income-expense,
    prevIncome, prevExpense,
    incomeVar:  prevIncome>0  ? Math.round((income-prevIncome)/prevIncome*100)    : null,
    expenseVar: prevExpense>0 ? Math.round((expense-prevExpense)/prevExpense*100)  : null,
    savingRate: income>0 ? Math.round((income-expense)/income*100) : 0,
    topCategories, txCount: (curr||[]).length,
  });
});

module.exports = router;
