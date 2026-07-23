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

// Projeção dos próximos 6 meses
router.get('/', async (req, res) => {
  const supabase  = db(req.token);
  const today     = new Date();
  const months    = Number(req.query.months) || 6;

  // ── 1. Média dos últimos 3 meses ──────────────────────────────────────
  const histMonths = Array.from({ length: 3 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() - 1 - i, 1);
    return { month: d.getMonth() + 1, year: d.getFullYear() };
  });

  const histData = [];
  for (const { month, year } of histMonths) {
    const start = `${year}-${String(month).padStart(2,'0')}-01`;
    const end   = new Date(year, month, 0).toISOString().split('T')[0];
    const { data } = await supabase.from('transactions')
      .select('amount,type,category_id,categories(name,color)')
      .eq('user_id', req.user.id).gte('date', start).lte('date', end);
    histData.push({ month, year, transactions: data || [] });
  }

  const avgIncome  = histData.reduce((s, m) =>
    s + m.transactions.filter(t=>t.type==='income').reduce((a,t)=>a+Number(t.amount),0), 0) / 3;

  // Média por categoria
  const catTotals = {};
  histData.forEach(m => {
    m.transactions.filter(t=>t.type==='expense').forEach(t => {
      const key = t.category_id || 'sem-categoria';
      if (!catTotals[key]) catTotals[key] = { name: t.categories?.name||'Sem categoria', color: t.categories?.color||'#6b7280', total: 0 };
      catTotals[key].total += Number(t.amount);
    });
  });
  const avgByCategory = Object.entries(catTotals).map(([id, v]) => ({
    category_id: id, name: v.name, color: v.color,
    avg_monthly: Math.round(v.total / 3 * 100) / 100,
  })).sort((a, b) => b.avg_monthly - a.avg_monthly);

  const avgExpense = avgByCategory.reduce((s, c) => s + c.avg_monthly, 0);

  // ── 2. Recorrentes ativas (valores fixos) ────────────────────────────
  const { data: recurrings } = await supabase.from('recurring_transactions')
    .select('amount,type,frequency,description').eq('user_id', req.user.id).eq('active', true);

  const fixedIncome  = (recurrings||[]).filter(r=>r.type==='income' && r.frequency==='monthly').reduce((s,r)=>s+Number(r.amount),0);
  const fixedExpense = (recurrings||[]).filter(r=>r.type==='expense'&& r.frequency==='monthly').reduce((s,r)=>s+Number(r.amount),0);
  const weeklyExpense= (recurrings||[]).filter(r=>r.type==='expense'&& r.frequency==='weekly').reduce((s,r)=>s+Number(r.amount)*4.33,0);
  const weeklyIncome = (recurrings||[]).filter(r=>r.type==='income' && r.frequency==='weekly').reduce((s,r)=>s+Number(r.amount)*4.33,0);

  // ── 3. Saldo atual (mês corrente) ─────────────────────────────────────
  const currStart = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-01`;
  const currEnd   = new Date(today.getFullYear(), today.getMonth()+1, 0).toISOString().split('T')[0];
  const { data: currTxs } = await supabase.from('transactions')
    .select('amount,type').eq('user_id', req.user.id).gte('date',currStart).lte('date',currEnd);
  const currIncome  = (currTxs||[]).filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0);
  const currExpense = (currTxs||[]).filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);
  const currBalance = currIncome - currExpense;

  // ── 4. Projeção mês a mês ─────────────────────────────────────────────
  // Receita projetada = média histórica + fixas recorrentes (sem duplicar)
  const projIncome  = Math.max(avgIncome, fixedIncome + weeklyIncome);
  const projExpense = avgExpense + weeklyExpense; // variáveis + semanais; fixas já estão na média

  const projection = [];
  let accumulated  = currBalance;

  for (let i = 1; i <= months; i++) {
    const d    = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const label= d.toLocaleString('pt-BR', { month: 'short', year: 'numeric' });
    const balance = projIncome - projExpense;
    accumulated  += balance;

    // Cenários: pessimista (-15%), realista, otimista (+10%)
    projection.push({
      month:       d.getMonth() + 1,
      year:        d.getFullYear(),
      label,
      income:      Math.round(projIncome  * 100) / 100,
      expense:     Math.round(projExpense * 100) / 100,
      balance:     Math.round(balance     * 100) / 100,
      accumulated: Math.round(accumulated * 100) / 100,
      pessimistic: Math.round((projIncome * 0.85 - projExpense * 1.15) * 100) / 100,
      optimistic:  Math.round((projIncome * 1.10 - projExpense * 0.90) * 100) / 100,
    });
  }

  res.json({
    avg_income:   Math.round(avgIncome  * 100) / 100,
    avg_expense:  Math.round(avgExpense * 100) / 100,
    avg_balance:  Math.round((avgIncome - avgExpense) * 100) / 100,
    fixed_income: Math.round((fixedIncome + weeklyIncome)  * 100) / 100,
    fixed_expense:Math.round((fixedExpense + weeklyExpense) * 100) / 100,
    by_category:  avgByCategory,
    projection,
  });
});

module.exports = router;
