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
  const supabase = db(req.token);
  const today    = new Date();
  const months   = Number(req.query.months) || 6;

  // Histórico dos últimos 3 meses
  const histMonths = Array.from({ length: 3 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    return { month: d.getMonth() + 1, year: d.getFullYear() };
  });

  const histData = [];
  for (const { month, year } of histMonths) {
    const start = `${year}-${String(month).padStart(2,'0')}-01`;
    const end   = new Date(year, month, 0).toISOString().split('T')[0];
    const { data } = await supabase.from('transactions')
      .select('amount,type,category_id,categories(name,color)')
      .eq('user_id', req.user.id).gte('date', start).lte('date', end)
      .is('transfer_id', null);
    if (data?.length) histData.push({ month, year, transactions: data });
  }

  const divisor    = Math.max(1, histData.length);
  const totalIncome = histData.reduce((s,m)=>
    s + m.transactions.filter(t=>t.type==='income').reduce((a,t)=>a+Number(t.amount),0), 0);
  const avgIncome  = totalIncome / divisor;

  const catTotals = {};
  histData.forEach(m => {
    m.transactions.filter(t=>t.type==='expense').forEach(t => {
      const key = t.category_id || 'sem-categoria';
      if (!catTotals[key]) catTotals[key] = { name:t.categories?.name||'Sem categoria', color:t.categories?.color||'#6b7280', total:0 };
      catTotals[key].total += Number(t.amount);
    });
  });

  const avgByCategory = Object.entries(catTotals).map(([id,v]) => ({
    category_id: id, name: v.name, color: v.color,
    avg_monthly: Math.round(v.total / divisor * 100) / 100,
  })).sort((a,b) => b.avg_monthly - a.avg_monthly);

  const avgExpense = avgByCategory.reduce((s,c) => s + c.avg_monthly, 0);

  const { data: recurrings } = await supabase.from('recurring_transactions')
    .select('amount,type,frequency').eq('user_id', req.user.id).eq('active', true);

  const fixedIncome   = (recurrings||[]).filter(r=>r.type==='income' &&r.frequency==='monthly').reduce((s,r)=>s+Number(r.amount),0);
  const fixedExpense  = (recurrings||[]).filter(r=>r.type==='expense'&&r.frequency==='monthly').reduce((s,r)=>s+Number(r.amount),0);
  const weeklyIncome  = (recurrings||[]).filter(r=>r.type==='income' &&r.frequency==='weekly').reduce((s,r)=>s+Number(r.amount)*4.33,0);
  const weeklyExpense = (recurrings||[]).filter(r=>r.type==='expense'&&r.frequency==='weekly').reduce((s,r)=>s+Number(r.amount)*4.33,0);

  // Saldo atual do mês corrente
  const currStart = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-01`;
  const currEnd   = new Date(today.getFullYear(), today.getMonth()+1, 0).toISOString().split('T')[0];
  const { data: currTxs } = await supabase.from('transactions')
    .select('amount,type').eq('user_id', req.user.id)
    .gte('date',currStart).lte('date',currEnd).is('transfer_id',null);
  const currBalance = (currTxs||[]).filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0)
    - (currTxs||[]).filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);

  const projIncome  = Math.max(avgIncome,  fixedIncome  + weeklyIncome);
  const projExpense = Math.max(avgExpense, fixedExpense + weeklyExpense);

  // Projeção com 3 cenários — acumulados independentes
  const projection = [];
  let accReal = currBalance, accPess = currBalance, accOpt = currBalance;

  for (let i = 1; i <= months; i++) {
    const d     = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const label = d.toLocaleString('pt-BR', { month: 'short', year: 'numeric' });

    const incReal = projIncome,         expReal = projExpense;
    const incPess = projIncome  * 0.85, expPess = projExpense * 1.15;
    const incOpt  = projIncome  * 1.10, expOpt  = projExpense * 0.90;

    accReal += incReal - expReal;
    accPess += incPess - expPess;
    accOpt  += incOpt  - expOpt;

    projection.push({
      month: d.getMonth()+1, year: d.getFullYear(), label,
      // Realista
      income:      Math.round(incReal * 100) / 100,
      expense:     Math.round(expReal * 100) / 100,
      balance:     Math.round((incReal-expReal) * 100) / 100,
      accumulated: Math.round(accReal * 100) / 100,
      // Pessimista
      pess_income:      Math.round(incPess * 100) / 100,
      pess_expense:     Math.round(expPess * 100) / 100,
      pessimistic:      Math.round((incPess-expPess) * 100) / 100,
      pess_accumulated: Math.round(accPess * 100) / 100,
      // Otimista
      opt_income:      Math.round(incOpt * 100) / 100,
      opt_expense:     Math.round(expOpt * 100) / 100,
      optimistic:      Math.round((incOpt-expOpt) * 100) / 100,
      opt_accumulated: Math.round(accOpt * 100) / 100,
    });
  }

  res.json({
    months_analyzed: divisor,
    avg_income:    Math.round(avgIncome  * 100) / 100,
    avg_expense:   Math.round(avgExpense * 100) / 100,
    avg_balance:   Math.round((avgIncome-avgExpense) * 100) / 100,
    fixed_income:  Math.round((fixedIncome  + weeklyIncome)  * 100) / 100,
    fixed_expense: Math.round((fixedExpense + weeklyExpense) * 100) / 100,
    by_category:   avgByCategory,
    projection,
  });
});

module.exports = router;
