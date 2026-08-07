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

// ── Insights diários ─────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const supabase   = db(req.token);
  const today      = new Date();
  const month      = today.getMonth() + 1;
  const year       = today.getFullYear();
  const dayOfMonth = today.getDate();
  const daysTotal  = new Date(year, month, 0).getDate();
  const start      = `${year}-${String(month).padStart(2,'0')}-01`;
  const end        = new Date(year, month, 0).toISOString().split('T')[0];
  const prevMonth  = month === 1 ? 12 : month - 1;
  const prevYear   = month === 1 ? year - 1 : year;
  const prevStart  = `${prevYear}-${String(prevMonth).padStart(2,'0')}-01`;
  const prevEnd    = new Date(prevYear, prevMonth, 0).toISOString().split('T')[0];

  const [txs, prevTxs, budgets, debts, cards, investments, recurrings] = await Promise.all([
    safeQuery(supabase.from('transactions').select('amount,type,category_id,description,categories(name),transfer_id').eq('user_id',req.user.id).gte('date',start).lte('date',end)),
    safeQuery(supabase.from('transactions').select('amount,type,category_id,description,transfer_id').eq('user_id',req.user.id).gte('date',prevStart).lte('date',prevEnd)),
    safeQuery(supabase.from('budgets').select('amount,category_id,categories(name)').eq('user_id',req.user.id)),
    safeQuery(supabase.from('debts').select('name,paid_installments,installments,installment_value,due_day,start_date').eq('user_id',req.user.id)),
    safeQuery(supabase.from('credit_cards').select('id,name,closing_day').eq('user_id',req.user.id)),
    safeQuery(supabase.from('investments').select('type,initial_amount,quantity,avg_price,calculated_current_value').eq('user_id',req.user.id)),
    safeQuery(supabase.from('recurring_transactions').select('amount,type,description,active').eq('user_id',req.user.id).eq('active',true)),
  ]);

  const real     = txs.filter(t=>!t.transfer_id);
  const prevReal = prevTxs.filter(t=>!t.transfer_id);
  const income   = real.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0);
  const expense  = real.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);

  const byCat = {}, prevByCat = {};
  real.filter(t=>t.type==='expense').forEach(t=>{
    const id=t.category_id||'sem';
    if(!byCat[id]) byCat[id]={name:t.categories?.name||'Sem categoria',total:0};
    byCat[id].total+=Number(t.amount);
  });
  prevReal.filter(t=>t.type==='expense').forEach(t=>{
    const id=t.category_id||'sem';
    if(!prevByCat[id]) prevByCat[id]={total:0};
    prevByCat[id].total+=Number(t.amount);
  });

  // Fatura dos cartões
  let cardInvoiceTotal = 0;
  for (const card of cards) {
    const ct = await safeQuery(supabase.from('transactions').select('amount').eq('user_id',req.user.id).eq('credit_card_id',card.id).gte('date',start).lte('date',end));
    cardInvoiceTotal += ct.reduce((s,t)=>s+Number(t.amount),0);
  }

  const pool = [], urgent = [];

  // ── Regras urgentes ──────────────────────────────────────────────────

  // Teto estourado (≥100%)
  for (const budget of budgets) {
    const spent=byCat[budget.category_id]?.total||0, limit=Number(budget.amount);
    const pct=limit>0?Math.round(spent/limit*100):0;
    const name=budget.categories?.name||'categoria';
    if (pct>=100) {
      urgent.push({ icon:'🚨', title:`Teto estourado: ${name}`, body:`Você ultrapassou o limite de ${name} este mês. Considere revisar seus gastos.`, action:{label:'Ver tetos',url:'/budgets'} });
    } else if (pct>=80) {
      pool.push({ icon:'⚠️', title:`${name} em ${pct}% do limite`, body:`Restam apenas ${fmt(limit-spent)} no orçamento de ${name}. Vale ficar de olho.`, action:{label:'Ver tetos',url:'/budgets'} });
    }
  }

  // Parcela vencida
  for (const debt of debts) {
    if (debt.paid_installments>=debt.installments||!debt.start_date||!debt.due_day) continue;
    const dt=new Date(debt.start_date);
    dt.setMonth(dt.getMonth()+debt.paid_installments); dt.setDate(debt.due_day);
    const diff=Math.ceil((dt-today)/(1000*60*60*24));
    if (diff<0) urgent.push({ icon:'🔴', title:`Parcela vencida: ${debt.name}`, body:`A parcela ${debt.paid_installments+1}/${debt.installments} de ${fmt(debt.installment_value)} está vencida há ${Math.abs(diff)} dia(s).`, action:{label:'Ver dívidas',url:'/debts'} });
    else if (diff<=5) urgent.push({ icon:'⚠️', title:`Parcela vence em ${diff}d: ${debt.name}`, body:`Parcela ${debt.paid_installments+1}/${debt.installments} de ${fmt(debt.installment_value)} vence em breve.`, action:{label:'Ver dívidas',url:'/debts'} });
  }

  // Cartão fechando
  for (const card of cards) {
    if (!card.closing_day) continue;
    const dt=new Date(year,month-1,card.closing_day);
    const diff=Math.ceil((dt-today)/(1000*60*60*24));
    if (diff>=0&&diff<=3) urgent.push({ icon:'💳', title:`Fatura ${card.name} fecha ${diff===0?'hoje':`em ${diff}d`}`, body:`Verifique os lançamentos pendentes antes do fechamento.`, action:{label:'Ver cartões',url:'/credit-cards'} });
  }

  // Saldo negativo
  if (income>0&&expense>income) {
    urgent.push({ icon:'📉', title:'Despesas superam receitas este mês', body:`Você gastou ${fmt(expense-income)} a mais do que recebeu. Tente equilibrar nos próximos dias.`, action:{label:'Ver dashboard',url:'/'} });
  }

  // ── Regras da pool (rotativas) ───────────────────────────────────────

  // 50/30/20
  if (income>0&&expense/income>0.75) {
    pool.push({ icon:'⚖️', title:'Seus gastos estão acima do ideal', body:`Você usou ${Math.round(expense/income*100)}% da renda este mês. A regra 50/30/20 sugere manter abaixo de 80%.`, action:{label:'Ver projeção',url:'/projections'} });
  }

  // Ritmo de gastos
  if (dayOfMonth>=8) {
    for (const budget of budgets) {
      const spent=byCat[budget.category_id]?.total||0, limit=Number(budget.amount);
      if (limit<=0||spent<=0) continue;
      const pctDay=dayOfMonth/daysTotal, pctSpent=spent/limit;
      if (pctSpent>pctDay*1.4&&pctSpent<0.8) {
        const estDay=Math.min(daysTotal,Math.floor(limit/(spent/dayOfMonth)));
        const name=budget.categories?.name||byCat[budget.category_id]?.name||'categoria';
        pool.push({ icon:'📈', title:`Ritmo alto em ${name}`, body:`No ritmo atual, o orçamento de ${name} pode acabar por volta do dia ${estDay}.`, action:{label:'Ver tetos',url:'/budgets'} });
        break;
      }
    }
  }

  // Cartão pesando
  if (income>0&&cardInvoiceTotal>0&&cardInvoiceTotal/income>0.25) {
    pool.push({ icon:'💳', title:'Sua fatura está pesando no orçamento', body:`A fatura do cartão compromete ${Math.round(cardInvoiceTotal/income*100)}% da sua renda. O ideal é manter abaixo de 30%.`, action:{label:'Ver cartões',url:'/credit-cards'} });
  }

  // Risco saldo negativo com fixas
  if (income>0&&dayOfMonth<=25) {
    const fixed=recurrings.filter(r=>r.type==='expense'&&r.frequency==='monthly').reduce((s,r)=>s+Number(r.amount),0);
    const balance=income-expense;
    if (fixed>0&&balance<fixed&&balance>0) {
      urgent.push({ icon:'🔴', title:'Saldo pode não cobrir recorrentes', body:`Seu saldo (${fmt(balance)}) está abaixo dos fixos mensais (${fmt(fixed)}). Atenção!`, action:{label:'Ver recorrentes',url:'/recurring'} });
    }
  }

  // Pico de gastos vs mês anterior
  for (const [catId,cat] of Object.entries(byCat)) {
    const prev=prevByCat[catId]?.total||0;
    if (prev>50&&cat.total>prev*1.4) {
      pool.push({ icon:'📊', title:`Gasto em ${cat.name} subiu muito`, body:`Você está gastando ${Math.round((cat.total/prev-1)*100)}% a mais em ${cat.name} comparado ao mês passado.`, action:{label:'Ver dashboard',url:'/'} });
      break;
    }
  }

  // Efeito cafézinho
  const micro=real.filter(t=>t.type==='expense'&&Number(t.amount)<=25);
  const microTotal=micro.reduce((s,t)=>s+Number(t.amount),0);
  if (micro.length>=5&&microTotal>=80) {
    pool.push({ icon:'☕', title:'Microgastos somando alto', body:`${micro.length} compras de até R$25 somaram ${fmt(microTotal)} este mês. Pequenos valores fazem diferença!`, action:{label:'Ver transações',url:'/'} });
  }

  // Reserva de emergência
  const invTotal=investments.reduce((s,i)=>s+(['fixed_income','treasury'].includes(i.type)?Number(i.calculated_current_value||i.initial_amount||0):Number(i.quantity||0)*Number(i.avg_price||0)),0);
  if (invTotal>0&&expense>0) {
    const months=invTotal/Math.max(expense,1);
    if (months<6) pool.push({ icon:'🛡️', title:'Reserva de emergência abaixo do ideal', body:`Sua reserva cobre ${months.toFixed(1)} meses de gastos. O recomendado é 6 meses.`, action:{label:'Ver investimentos',url:'/investments'} });
    else pool.push({ icon:'🏆', title:'Reserva de emergência sólida!', body:`Sua reserva cobre ${months.toFixed(1)} meses. Continue assim e pense em diversificar!`, action:{label:'Ver investimentos',url:'/investments'} });
  }

  // Sobra de caixa
  if (daysTotal-dayOfMonth<=7&&income>0) {
    const free=income-expense-recurrings.filter(r=>r.type==='expense'&&r.frequency==='monthly').reduce((s,r)=>s+Number(r.amount),0);
    if (free>150) pool.push({ icon:'🎉', title:'Encerrando o mês no positivo!', body:`Você tem ${fmt(free)} livres ao fechar o mês. Que tal guardar uma parte ou investir?`, action:{label:'Ver metas',url:'/goals'} });
  }

  // Meta quase concluída
  const goals = await safeQuery(supabase.from('goals').select('name,current_amount,target_amount').eq('user_id',req.user.id));
  for (const g of goals) {
    const pct=g.target_amount>0?Math.round(g.current_amount/g.target_amount*100):0;
    if (pct>=90&&pct<100) {
      pool.push({ icon:'🎯', title:`Meta "${g.name}" quase lá!`, body:`Faltam apenas ${fmt(Number(g.target_amount)-Number(g.current_amount))} para concluir essa meta. Um último esforço!`, action:{label:'Ver metas',url:'/goals'} });
    }
  }

  // ── Fallback: se não há nada, mostra insight motivacional ────────────
  const motivational = [
    { icon:'💡', title:'Dica do dia: regra 50/30/20', body:'Destine 50% da renda para necessidades, 30% para desejos e 20% para poupança ou dívidas. Simples e eficaz!', action:{label:'Ver projeção',url:'/projections'} },
    { icon:'📌', title:'Você sabia? Importação inteligente', body:'Você pode importar extratos bancários e o sistema sugere categorias automaticamente. Sem duplicatas!', action:{label:'Ver categorias',url:'/categories'} },
    { icon:'🧮', title:'Use as calculadoras financeiras', body:'Simule financiamentos, férias, 13º e muito mais nas calculadoras do app.', action:{label:'Ver calculadoras',url:'/calculators'} },
    { icon:'📊', title:'Defina tetos de gastos', body:'Com tetos por categoria, o Leon te avisa quando você está chegando perto do limite.', action:{label:'Ver tetos',url:'/budgets'} },
    { icon:'🎯', title:'Crie uma meta de economia', body:'Metas ajudam a manter o foco. Comece com algo pequeno — como R$500 de reserva.', action:{label:'Ver metas',url:'/goals'} },
  ];

  const seed   = dailySeed();
  const result = [];

  if (urgent.length>0) result.push(...seededPick(urgent, seed, 1));
  if (pool.length>0)   result.push(...seededPick(pool, seed+1, 2-result.length));

  // Fallback se ainda vazio
  if (result.length===0) {
    result.push(...seededPick(motivational, seed, 1));
  }

  res.json(result);
});

// ── Score de Saúde Financeira ─────────────────────────────────────────────
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

  const savingRate      = income>0?(income-expense)/income*100:0;
  const savingPts       = Math.min(20,Math.round(savingRate/5*4));
  const exceededBudgets = budgets.filter(b=>(byCat[b.category_id]||0)>Number(b.amount)).length;
  const budgetPts       = budgets.length===0?10:Math.max(0,20-exceededBudgets*10);
  const avgGoalPct      = goals.length===0?0:goals.reduce((s,g)=>s+(g.target_amount>0?g.current_amount/g.target_amount:0),0)/goals.length*100;
  const goalPts         = goals.length===0?10:Math.min(20,Math.round(avgGoalPct/5));
  const activeDebts     = debts.filter(d=>d.paid_installments<d.installments);
  const debtCommit      = income>0?activeDebts.reduce((s,d)=>s+Number(d.installment_value),0)/income*100:0;
  const debtPts         = activeDebts.length===0?20:Math.max(0,20-Math.round(debtCommit/5*4));
  const invTotal        = investments.reduce((s,i)=>s+(['fixed_income','treasury'].includes(i.type)?Number(i.initial_amount||0):Number(i.quantity||0)*Number(i.avg_price||0)),0);
  const invPts          = invTotal===0?0:invTotal<500?5:invTotal<2000?10:invTotal<5000?15:20;

  res.json({
    score: savingPts+budgetPts+goalPts+debtPts+invPts,
    breakdown:[
      {label:'Taxa de poupança',    pts:savingPts, pct:savingPts/20*100, color:savingPts>=16?'var(--green)':savingPts>=10?'var(--indigo)':'var(--amber)', tip:savingRate>=20?'Ótimo! Acima de 20%':savingRate>=10?`Poupando ${savingRate.toFixed(0)}% — meta: 20%`:'Tente poupar ao menos 10%'},
      {label:'Tetos de gasto',      pts:budgetPts, pct:budgetPts/20*100, color:budgetPts>=16?'var(--green)':budgetPts>=10?'var(--indigo)':'var(--red)',   tip:budgets.length===0?'Defina tetos para pontuar':exceededBudgets===0?'Todos os tetos respeitados!':`${exceededBudgets} teto(s) ultrapassado(s)`},
      {label:'Metas de economia',   pts:goalPts,   pct:goalPts/20*100,   color:goalPts>=16?'var(--green)':goalPts>=10?'var(--indigo)':'var(--amber)',    tip:goals.length===0?'Crie metas para pontuar':`Progresso médio: ${avgGoalPct.toFixed(0)}%`},
      {label:'Controle de dívidas', pts:debtPts,   pct:debtPts/20*100,   color:debtPts>=16?'var(--green)':debtPts>=10?'var(--indigo)':'var(--red)',      tip:activeDebts.length===0?'Sem dívidas ativas!':`Parcelas comprometem ${debtCommit.toFixed(0)}% da renda`},
      {label:'Patrimônio investido',pts:invPts,    pct:invPts/20*100,    color:invPts>=16?'var(--green)':invPts>=10?'var(--indigo)':'var(--amber)',      tip:invTotal===0?'Comece a investir para pontuar':`${fmt(invTotal)} investidos`},
    ],
  });
});

module.exports = router;
