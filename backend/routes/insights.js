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

const fmt = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);

function dailySeed() {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth()+1) * 100 + d.getDate();
}

function seededPick(arr, seed, n) {
  if (!arr.length) return [];
  const a = [...arr];
  let s = seed;
  for (let i = a.length-1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) | 0;
    const j = Math.abs(s) % (i+1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

// ── Insights diários (/api/insights) ─────────────────────────────────────
router.get('/', async (req, res) => {
  const supabase  = db(req.token);
  const today     = new Date();
  const month     = today.getMonth() + 1;
  const year      = today.getFullYear();
  const dayOfMonth = today.getDate();
  const daysTotal = new Date(year, month, 0).getDate();
  const start     = `${year}-${String(month).padStart(2,'0')}-01`;
  const end       = new Date(year, month, 0).toISOString().split('T')[0];
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear  = month === 1 ? year - 1 : year;
  const prevStart = `${prevYear}-${String(prevMonth).padStart(2,'0')}-01`;
  const prevEnd   = new Date(prevYear, prevMonth, 0).toISOString().split('T')[0];

  const [txs, prevTxs, budgets, debts, cards, investments, recurrings] = await Promise.all([
    safeQuery(supabase.from('transactions').select('amount,type,category_id,description,categories(name),transfer_id').eq('user_id',req.user.id).gte('date',start).lte('date',end)),
    safeQuery(supabase.from('transactions').select('amount,type,category_id,description,categories(name),transfer_id').eq('user_id',req.user.id).gte('date',prevStart).lte('date',prevEnd)),
    safeQuery(supabase.from('budgets').select('amount,category_id,categories(name)').eq('user_id',req.user.id)),
    safeQuery(supabase.from('debts').select('name,paid_installments,installments,installment_value,due_day,start_date').eq('user_id',req.user.id)),
    safeQuery(supabase.from('credit_cards').select('id,name,closing_day').eq('user_id',req.user.id)),
    safeQuery(supabase.from('investments').select('type,initial_amount,quantity,avg_price,calculated_current_value').eq('user_id',req.user.id)),
    safeQuery(supabase.from('recurring_transactions').select('amount,type,description,active').eq('user_id',req.user.id).eq('active',true)),
  ]);

  const real      = txs.filter(t=>!t.transfer_id);
  const prevReal  = prevTxs.filter(t=>!t.transfer_id);
  const income    = real.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0);
  const expense   = real.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);

  const byCat = {}, prevByCat = {};
  real.filter(t=>t.type==='expense').forEach(t=>{
    const id=t.category_id||'sem'; if(!byCat[id]) byCat[id]={name:t.categories?.name||'Sem categoria',total:0};
    byCat[id].total+=Number(t.amount);
  });
  prevReal.filter(t=>t.type==='expense').forEach(t=>{
    const id=t.category_id||'sem'; if(!prevByCat[id]) prevByCat[id]={total:0};
    prevByCat[id].total+=Number(t.amount);
  });

  let cardInvoiceTotal = 0;
  for (const card of cards) {
    const ct = await safeQuery(supabase.from('transactions').select('amount').eq('user_id',req.user.id).eq('credit_card_id',card.id).gte('date',start).lte('date',end));
    cardInvoiceTotal += ct.reduce((s,t)=>s+Number(t.amount),0);
  }

  const pool = [], urgent = [];

  // 1. 50/30/20
  if (income>0 && expense/income>0.8) {
    pool.push({ icon:'⚖️', title:'Seus gastos estão altos este mês', body:`Você já usou ${Math.round(expense/income*100)}% da sua renda em despesas. A regra 50/30/20 sugere manter abaixo de 80%. Ainda dá tempo!`, action:{ label:'Ver projeção', url:'/projections' } });
  }

  // 2. Ritmo de gastos
  if (dayOfMonth>=10) {
    for (const budget of budgets) {
      const spent=byCat[budget.category_id]?.total||0, limit=Number(budget.amount);
      if (limit<=0||spent<=0) continue;
      const pctDay=dayOfMonth/daysTotal, pctSpent=spent/limit;
      if (pctSpent>pctDay*1.5&&pctSpent<1.0) {
        const estDay=Math.min(daysTotal,Math.floor(limit/(spent/dayOfMonth)));
        const name=budget.categories?.name||byCat[budget.category_id]?.name||'categoria';
        pool.push({ icon:'📈', title:`No ritmo atual, ${name} vai estourar cedo`, body:`Você já gastou ${Math.round(pctSpent*100)}% do limite de ${name}. Se continuar assim, o orçamento acaba por volta do dia ${estDay}.`, action:{ label:'Ver tetos', url:'/budgets' } });
        break;
      }
    }
  }

  // 3. Perto do limite
  for (const budget of budgets) {
    const spent=byCat[budget.category_id]?.total||0, limit=Number(budget.amount);
    const pct=limit>0?Math.round(spent/limit*100):0, name=budget.categories?.name||'categoria', left=Math.max(0,limit-spent);
    if (pct>=90&&pct<100) { urgent.push({ icon:'🚨', title:`Quase no limite de ${name}`, body:`Restam apenas ${fmt(left)} no seu orçamento de ${name}. Segure os próximos gastos nessa categoria.`, action:{ label:'Ver tetos', url:'/budgets' } }); }
    else if (pct>=80&&pct<90) { pool.push({ icon:'⚠️', title:`${name} chegando perto do limite`, body:`Você usou ${pct}% do orçamento de ${name}. Ainda tem ${fmt(left)} — vale ficar de olho.`, action:{ label:'Ver tetos', url:'/budgets' } }); }
  }

  // 4. Cartão pesando
  if (income>0&&cardInvoiceTotal>0) {
    const pct=Math.round(cardInvoiceTotal/income*100);
    if (pct>30) pool.push({ icon:'💳', title:'Seu cartão está pesando no orçamento', body:`Sua fatura já compromete ${pct}% da sua renda mensal. Especialistas recomendam manter abaixo de 30%.`, action:{ label:'Ver cartões', url:'/credit-cards' } });
  }

  // 5. Risco de saldo negativo
  if (income>0&&dayOfMonth<=25) {
    const fixed=recurrings.filter(r=>r.type==='expense'&&r.frequency==='monthly').reduce((s,r)=>s+Number(r.amount),0);
    const balance=income-expense;
    if (fixed>0&&balance<fixed&&balance>0) urgent.push({ icon:'🔴', title:'Saldo pode não cobrir seus fixos', body:`Seu saldo atual (${fmt(balance)}) é menor que o total de recorrentes fixas (${fmt(fixed)}). Cuidado para não ficar no negativo!`, action:{ label:'Ver recorrentes', url:'/recurring' } });
  }

  // 6. Pico de gastos
  for (const [catId,cat] of Object.entries(byCat)) {
    const prev=prevByCat[catId]?.total||0;
    if (prev<=0||cat.total<=0) continue;
    if (cat.total/prev>=1.5&&cat.total>100) {
      pool.push({ icon:'📊', title:`Gasto em ${cat.name} subiu muito`, body:`Você está gastando ${Math.round((cat.total/prev-1)*100)}% a mais em ${cat.name} comparado ao mês passado. Vale entender o que mudou?`, action:{ label:'Ver dashboard', url:'/' } });
      break;
    }
  }

  // 7. Efeito cafézinho
  const micro=real.filter(t=>t.type==='expense'&&Number(t.amount)<=25);
  const microTotal=micro.reduce((s,t)=>s+Number(t.amount),0);
  if (micro.length>=8&&microTotal>=100) pool.push({ icon:'☕', title:'Os pequenos gastos estão somando', body:`Você fez ${micro.length} compras de até R$25 este mês, que juntas somam ${fmt(microTotal)}. Pequenos valores somados fazem grande diferença!`, action:{ label:'Ver transações', url:'/' } });

  // 8. Assinatura mais cara
  for (const rec of recurrings.filter(r=>r.type==='expense')) {
    const cs=real.filter(t=>t.type==='expense'&&t.description&&rec.description&&t.description.toLowerCase().includes(rec.description.toLowerCase().slice(0,6))).reduce((s,t)=>s+Number(t.amount),0);
    const ps=prevReal.filter(t=>t.type==='expense'&&t.description&&rec.description&&t.description.toLowerCase().includes(rec.description.toLowerCase().slice(0,6))).reduce((s,t)=>s+Number(t.amount),0);
    if (ps>0&&cs>ps*1.05) { pool.push({ icon:'🔔', title:`${rec.description} ficou mais caro`, body:`Esse gasto veio ${fmt(cs-ps)} mais alto que o mês passado. Pode ser reajuste — vale conferir.`, action:{ label:'Ver recorrentes', url:'/recurring' } }); break; }
  }

  // 9. Reserva de emergência
  const invTotal=investments.reduce((s,i)=>s+(['fixed_income','treasury'].includes(i.type)?Number(i.calculated_current_value||i.initial_amount||0):Number(i.quantity||0)*Number(i.avg_price||0)),0);
  if (invTotal>0&&expense>0) {
    const months=invTotal/Math.max(expense,1);
    if (months<6) pool.push({ icon:'🛡️', title:'Sua reserva de emergência merece atenção', body:`Com o ritmo atual, sua reserva cobre ${months.toFixed(1)} meses. O ideal é ter pelo menos 6 meses guardados.`, action:{ label:'Ver investimentos', url:'/investments' } });
    else pool.push({ icon:'🏆', title:'Reserva de emergência sólida!', body:`Sua reserva cobre ${months.toFixed(1)} meses dos seus gastos. Que tal começar a diversificar os investimentos?`, action:{ label:'Ver investimentos', url:'/investments' } });
  }

  // 10. Sobra de caixa
  if (daysTotal-dayOfMonth<=7&&income>0) {
    const balance=income-expense;
    const fixedLeft=recurrings.filter(r=>r.type==='expense'&&r.frequency==='monthly').reduce((s,r)=>s+Number(r.amount),0);
    const free=balance-fixedLeft;
    if (free>200) pool.push({ icon:'🎉', title:'Você vai fechar o mês no positivo!', body:`Faltam ${daysTotal-dayOfMonth} dias e você tem ${fmt(free)} livres após os fixos. Que tal guardar uma parte?`, action:{ label:'Ver metas', url:'/goals' } });
  }

  const seed   = dailySeed();
  const result = [];
  if (urgent.length>0) result.push(...seededPick(urgent, seed, 1));
  if (pool.length>0)   result.push(...seededPick(pool, seed+1, 2-result.length));

  res.json(result);
});

// ── Score de Saúde Financeira (/api/insights/score) ──────────────────────
router.get('/score', async (req, res) => {
  const supabase = db(req.token);
  const today = new Date(); const m = today.getMonth()+1; const y = today.getFullYear();
  const start = `${y}-${String(m).padStart(2,'0')}-01`;
  const end   = new Date(y, m, 0).toISOString().split('T')[0];

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

  const savingRate       = income>0?(income-expense)/income*100:0;
  const savingPts        = Math.min(20, Math.round(savingRate/5*4));
  const exceededBudgets  = budgets.filter(b=>(byCat[b.category_id]||0)>Number(b.amount)).length;
  const budgetPts        = budgets.length===0?10:Math.max(0,20-exceededBudgets*10);
  const avgGoalPct       = goals.length===0?0:goals.reduce((s,g)=>s+(g.target_amount>0?g.current_amount/g.target_amount:0),0)/goals.length*100;
  const goalPts          = goals.length===0?10:Math.min(20,Math.round(avgGoalPct/5));
  const activeDebts      = debts.filter(d=>d.paid_installments<d.installments);
  const debtCommit       = income>0?activeDebts.reduce((s,d)=>s+Number(d.installment_value),0)/income*100:0;
  const debtPts          = activeDebts.length===0?20:Math.max(0,20-Math.round(debtCommit/5*4));
  const invTotal         = investments.reduce((s,i)=>s+(['fixed_income','treasury'].includes(i.type)?Number(i.initial_amount||0):Number(i.quantity||0)*Number(i.avg_price||0)),0);
  const invPts           = invTotal===0?0:invTotal<500?5:invTotal<2000?10:invTotal<5000?15:20;

  res.json({
    score: savingPts+budgetPts+goalPts+debtPts+invPts,
    breakdown: [
      { label:'Taxa de poupança',    pts:savingPts, pct:savingPts/20*100, color:savingPts>=16?'var(--green)':savingPts>=10?'var(--indigo)':'var(--amber)', tip:savingRate>=20?'Ótimo! Acima de 20%':savingRate>=10?`Poupando ${savingRate.toFixed(0)}% — meta: 20%`:'Tente poupar ao menos 10%' },
      { label:'Tetos de gasto',      pts:budgetPts, pct:budgetPts/20*100, color:budgetPts>=16?'var(--green)':budgetPts>=10?'var(--indigo)':'var(--red)',   tip:budgets.length===0?'Defina tetos para pontuar mais':exceededBudgets===0?'Todos os tetos respeitados!':` ${exceededBudgets} teto(s) ultrapassado(s)` },
      { label:'Metas de economia',   pts:goalPts,   pct:goalPts/20*100,   color:goalPts>=16?'var(--green)':goalPts>=10?'var(--indigo)':'var(--amber)',      tip:goals.length===0?'Crie metas para pontuar mais':`Progresso médio: ${avgGoalPct.toFixed(0)}%` },
      { label:'Controle de dívidas', pts:debtPts,   pct:debtPts/20*100,   color:debtPts>=16?'var(--green)':debtPts>=10?'var(--indigo)':'var(--red)',        tip:activeDebts.length===0?'Sem dívidas ativas!':`Parcelas comprometem ${debtCommit.toFixed(0)}% da renda` },
      { label:'Patrimônio investido',pts:invPts,    pct:invPts/20*100,    color:invPts>=16?'var(--green)':invPts>=10?'var(--indigo)':'var(--amber)',         tip:invTotal===0?'Comece a investir para pontuar':`${fmt(invTotal)} investidos` },
    ],
  });
});

module.exports = router;