const express = require('express');
const router = express.Router();
const { db, safeQuery } = require('../lib/db'); // Ajuste o caminho de db/safeQuery se o seu arquivo estiver em outro diretório

// ── Score de Saúde Financeira (/api/insights/score) ──────────────────────
router.get('/score', async (req, res) => {
  const supabase = db(req.token);
  const { start, end } = (() => {
    const t = new Date(); const m = t.getMonth()+1; const y = t.getFullYear();
    return { start:`${y}-${String(m).padStart(2,'0')}-01`, end:new Date(y,m,0).toISOString().split('T')[0] };
  })();

  const [txs, budgets, goals, debts, investments] = await Promise.all([
    safeQuery(supabase.from('transactions').select('amount,type,category_id,transfer_id').eq('user_id',req.user.id).gte('date',start).lte('date',end)),
    safeQuery(supabase.from('budgets').select('amount,category_id').eq('user_id',req.user.id)),
    safeQuery(supabase.from('goals').select('current_amount,target_amount').eq('user_id',req.user.id)),
    safeQuery(supabase.from('debts').select('installment_value,paid_installments,installments').eq('user_id',req.user.id)),
    safeQuery(supabase.from('investments').select('type,quantity,avg_price,initial_amount').eq('user_id',req.user.id)),
  ]);

  const real    = txs.filter(t=>!t.transfer_id);
  const income  = real.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0);
  const expense = real.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);
  const byCat   = {};
  real.filter(t=>t.type==='expense'&&t.category_id).forEach(t=>{ byCat[t.category_id]=(byCat[t.category_id]||0)+Number(t.amount); });

  // ── Critérios (cada um vale 0-20 pts) ────────────────────────────────
  // 1. Taxa de poupança (0-20)
  const savingRate = income>0?(income-expense)/income*100:0;
  const savingPts  = Math.min(20, Math.round(savingRate/5*4)); // 25% = 20pts
  
  // 2. Tetos respeitados (0-20)
  const exceededBudgets = budgets.filter(b=>(byCat[b.category_id]||0)>Number(b.amount)).length;
  const budgetPts = budgets.length===0 ? 10 : Math.max(0, 20 - exceededBudgets*10);

  // 3. Metas em progresso (0-20)
  const avgGoalPct = goals.length===0 ? 0 : goals.reduce((s,g)=>s+(g.target_amount>0?g.current_amount/g.target_amount:0),0)/goals.length*100;
  const goalPts    = goals.length===0 ? 10 : Math.min(20, Math.round(avgGoalPct/5));

  // 4. Controle de dívidas (0-20)
  const activeDebts   = debts.filter(d=>d.paid_installments<d.installments);
  const debtCommit    = income>0 ? activeDebts.reduce((s,d)=>s+Number(d.installment_value),0)/income*100 : 0;
  const debtPts       = activeDebts.length===0 ? 20 : Math.max(0, 20-Math.round(debtCommit/5*4));

  // 5. Patrimônio investido (0-20)
  const invTotal = investments.reduce((s,i)=>{
    return s+(['fixed_income','treasury'].includes(i.type)?Number(i.initial_amount||0):Number(i.quantity||0)*Number(i.avg_price||0));
  },0);
  const invPts = invTotal===0?0:invTotal<500?5:invTotal<2000?10:invTotal<5000?15:20;

  const score = savingPts + budgetPts + goalPts + debtPts + invPts;

  res.json({
    score,
    breakdown: [
      { label:'Taxa de poupança', pts:savingPts, pct:savingPts/20*100, color:savingPts>=16?'var(--green)':savingPts>=10?'var(--indigo)':'var(--amber)',
        tip: savingRate>=20?'Ótimo! Acima de 20% da renda':savingRate>=10?`Poupando ${savingRate.toFixed(0)}% — meta: 20%`:'Tente poupar ao menos 10% da renda' },
      { label:'Tetos de gasto',   pts:budgetPts, pct:budgetPts/20*100, color:budgetPts>=16?'var(--green)':budgetPts>=10?'var(--indigo)':'var(--red)',
        tip: budgets.length===0?'Defina tetos para pontuar mais':exceededBudgets===0?'Todos os tetos respeitados!':` ${exceededBudgets} teto(s) ultrapassado(s)` },
      { label:'Metas de economia',pts:goalPts,   pct:goalPts/20*100,   color:goalPts>=16?'var(--green)':goalPts>=10?'var(--indigo)':'var(--amber)',
        tip: goals.length===0?'Crie metas para pontuar mais':`Progresso médio: ${avgGoalPct.toFixed(0)}%` },
      { label:'Controle de dívidas',pts:debtPts,  pct:debtPts/20*100,  color:debtPts>=16?'var(--green)':debtPts>=10?'var(--indigo)':'var(--red)',
        tip: activeDebts.length===0?'Sem dívidas ativas!':`Parcelas comprometem ${debtCommit.toFixed(0)}% da renda` },
      { label:'Patrimônio investido',pts:invPts, pct:invPts/20*100,   color:invPts>=16?'var(--green)':invPts>=10?'var(--indigo)':'var(--amber)',
        tip: invTotal===0?'Comece a investir para pontuar':`${new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(invTotal)} investidos` },
    ],
  });
});

module.exports = router;