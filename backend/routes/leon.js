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

// ── Perguntas disponíveis ─────────────────────────────────────────────────
const QUESTIONS = [
  { id:'finances',    label:'Como estão minhas finanças este mês?' },
  { id:'spending',    label:'Onde estou gastando mais?'            },
  { id:'alerts',      label:'Tenho algum alerta importante?'       },
  { id:'goals',       label:'Como estão minhas metas?'             },
  { id:'budget',      label:'Quanto ainda posso gastar?'           },
  { id:'investments', label:'Como está minha carteira?'            },
  { id:'debts',       label:'Tenho parcelas vencendo?'             },
];

router.get('/questions', (req, res) => res.json(QUESTIONS));

// ── Estado do Leon ────────────────────────────────────────────────────────
router.get('/state', async (req, res) => {
  const supabase = db(req.token);
  const today    = new Date();
  const month    = today.getMonth() + 1;
  const year     = today.getFullYear();
  const start    = `${year}-${String(month).padStart(2,'0')}-01`;
  const end      = new Date(year, month, 0).toISOString().split('T')[0];

  const [txs, budgets, debts] = await Promise.all([
    safeQuery(supabase.from('transactions').select('amount,type,category_id,transfer_id').eq('user_id',req.user.id).gte('date',start).lte('date',end)),
    safeQuery(supabase.from('budgets').select('amount,category_id').eq('user_id',req.user.id)),
    safeQuery(supabase.from('debts').select('paid_installments,installments,due_day,start_date').eq('user_id',req.user.id)),
  ]);

  const real   = txs.filter(t=>!t.transfer_id);
  const income = real.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0);
  const expense= real.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);
  const byCat  = {};
  real.filter(t=>t.type==='expense'&&t.category_id).forEach(t=>{ byCat[t.category_id]=(byCat[t.category_id]||0)+Number(t.amount); });

  const budgetExceeded = budgets.some(b=>{ const l=Number(b.amount); return l>0&&(byCat[b.category_id]||0)>l; });
  const hasOverdue     = debts.some(d=>{
    if(d.paid_installments>=d.installments||!d.start_date||!d.due_day) return false;
    const dt=new Date(d.start_date.split('T')[0]);
    dt.setMonth(dt.getMonth()+d.paid_installments); dt.setDate(d.due_day);
    return dt < today;
  });

  let state='happy', reason='Tudo bem!';
  if (hasOverdue)                        { state='stressed'; reason='Parcela vencida'; }
  else if (income>0&&expense>income)     { state='stressed'; reason='Despesas maiores que receitas'; }
  else if (budgetExceeded)               { state='stressed'; reason='Teto ultrapassado'; }
  else if (income===0&&expense===0)      { state='curious';  reason='Sem movimentações'; }
  else if (income>0&&expense/income>0.85){ state='curious';  reason=`Gastando ${Math.round(expense/income*100)}% da renda`; }

  res.json({ state, reason });
});

// ── Coleta contexto financeiro ────────────────────────────────────────────
async function getUserContext(supabase, userId) {
  const today  = new Date();
  const month  = today.getMonth()+1, year=today.getFullYear();
  const start  = `${year}-${String(month).padStart(2,'0')}-01`;
  const end    = new Date(year,month,0).toISOString().split('T')[0];
  const daysLeft = new Date(year,month,0).getDate()-today.getDate();

  const [txs, budgets, goals, debts, investments, recurrings, cards] = await Promise.all([
    safeQuery(supabase.from('transactions').select('amount,type,category_id,date,description,transfer_id,categories(name)').eq('user_id',userId).gte('date',start).lte('date',end)),
    safeQuery(supabase.from('budgets').select('amount,category_id,categories(name)').eq('user_id',userId)),
    safeQuery(supabase.from('goals').select('name,current_amount,target_amount,deadline').eq('user_id',userId)),
    safeQuery(supabase.from('debts').select('name,paid_installments,installments,installment_value,due_day,start_date').eq('user_id',userId)),
    safeQuery(supabase.from('investments').select('name,type,quantity,avg_price,initial_amount,calculated_current_value').eq('user_id',userId)),
    safeQuery(supabase.from('recurring_transactions').select('description,amount,type,frequency,active').eq('user_id',userId).eq('active',true)),
    safeQuery(supabase.from('credit_cards').select('id,name,closing_day').eq('user_id',userId)),
  ]);

  const real    = txs.filter(t=>!t.transfer_id);
  const income  = real.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0);
  const expense = real.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);

  const byCat = {};
  real.filter(t=>t.type==='expense').forEach(t=>{ const n=t.categories?.name||'Sem categoria'; byCat[n]=(byCat[n]||0)+Number(t.amount); });
  const topCats = Object.entries(byCat).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([n,v])=>`${n}: ${fmt(v)}`);

  const budgetStatus = budgets.map(b=>{ const s=byCat[b.categories?.name]||0; return `${b.categories?.name}: ${b.amount>0?Math.round(s/b.amount*100):0}% (${fmt(s)} de ${fmt(b.amount)})`; });
  const goalStatus   = goals.map(g=>{ const p=g.target_amount>0?Math.round(g.current_amount/g.target_amount*100):0; return `${g.name}: ${p}% — ${fmt(g.current_amount)} de ${fmt(g.target_amount)}`; });
  const debtStatus   = debts.filter(d=>d.paid_installments<d.installments).map(d=>{
    let info=''; if(d.start_date&&d.due_day){ const dt=new Date(d.start_date); dt.setMonth(dt.getMonth()+d.paid_installments); dt.setDate(d.due_day); const diff=Math.ceil((dt-new Date())/(1000*60*60*24)); info=diff<0?` (VENCIDA há ${Math.abs(diff)}d)`:` (vence em ${diff}d)`; }
    return `${d.name}: parcela ${d.paid_installments+1}/${d.installments} de ${fmt(d.installment_value)}${info}`;
  });
  const invTotal = investments.reduce((s,i)=>s+(['fixed_income','treasury'].includes(i.type)?Number(i.calculated_current_value||i.initial_amount||0):Number(i.quantity||0)*Number(i.avg_price||0)),0);

  return { mes:`${today.toLocaleString('pt-BR',{month:'long',year:'numeric'})}`, daysLeft, income, expense, balance:income-expense, savingRate:income>0?Math.round((income-expense)/income*100):0, topCats, budgetStatus, goalStatus, debtStatus, invTotal, txCount:real.length, fixedMonthly:recurrings.filter(r=>r.type==='expense'&&r.frequency==='monthly').reduce((s,r)=>s+Number(r.amount),0), rawBudgets:budgets, rawGoals:goals, rawTopCats:Object.entries(byCat).sort((a,b)=>b[1]-a[1]).slice(0,3) };
}

// ── Detecta ações sugeridas baseado na pergunta e contexto ────────────────
function detectActions(questionId, ctx) {
  const actions = [];

  if (questionId === 'spending' || questionId === 'budget') {
    // Sugere criar teto para maior categoria sem teto
    const topCatName = ctx.rawTopCats?.[0]?.[0];
    const hasBudget  = ctx.rawBudgets?.some(b => b.categories?.name === topCatName);
    if (topCatName && !hasBudget) {
      actions.push({ type:'navigate', label:`📊 Criar teto para ${topCatName}`, url:'/budgets' });
    }
  }

  if (questionId === 'goals') {
    // Sugere criar meta se não tiver nenhuma
    if (!ctx.rawGoals?.length) {
      actions.push({ type:'navigate', label:'🎯 Criar primeira meta', url:'/goals' });
    } else {
      actions.push({ type:'navigate', label:'🎯 Ver todas as metas', url:'/goals' });
    }
  }

  if (questionId === 'alerts') {
    actions.push({ type:'navigate', label:'📊 Ver tetos de gastos', url:'/budgets' });
  }

  if (questionId === 'investments') {
    actions.push({ type:'navigate', label:'📈 Ver carteira', url:'/investments' });
  }

  if (questionId === 'debts') {
    actions.push({ type:'navigate', label:'💰 Ver dívidas', url:'/debts' });
  }

  if (questionId === 'finances') {
    const balance = ctx.balance;
    if (balance > 500) {
      actions.push({ type:'navigate', label:'💰 Investir a sobra', url:'/investments' });
      actions.push({ type:'navigate', label:'🎯 Contribuir para meta', url:'/goals' });
    }
    actions.push({ type:'navigate', label:'📊 Ver projeção', url:'/projections' });
  }

  if (questionId === 'free') {
    actions.push({ type:'navigate', label:'📋 Ver dashboard', url:'/' });
  }

  return actions.slice(0, 3); // máx 3 ações
}

// ── Prompts por pergunta ──────────────────────────────────────────────────
function buildPrompt(questionId, ctx) {
  const base = `DADOS FINANCEIROS (${ctx.mes}):\n- Receitas: ${fmt(ctx.income)} | Despesas: ${fmt(ctx.expense)} | Saldo: ${fmt(ctx.balance)}\n- Poupança: ${ctx.savingRate}% | Dias restantes: ${ctx.daysLeft} | Transações: ${ctx.txCount}`.trim();
  const extras = {
    finances:    '',
    spending:    `\nTop gastos:\n${ctx.topCats.join('\n')||'Nenhum'}`,
    alerts:      `\nTetos: ${ctx.budgetStatus.join('; ')||'Nenhum'}\nDívidas: ${ctx.debtStatus.join('; ')||'Nenhuma'}`,
    goals:       `\nMetas:\n${ctx.goalStatus.join('\n')||'Nenhuma'}`,
    budget:      `\nTop gastos: ${ctx.topCats.join(', ')}\nTetos: ${ctx.budgetStatus.join('; ')||'Nenhum'}`,
    investments: `\nCarteira total: ${fmt(ctx.invTotal)}`,
    debts:       `\nDívidas:\n${ctx.debtStatus.join('\n')||'Nenhuma'}`,
  };
  const questions = {
    finances:'Como estão minhas finanças este mês?', spending:'Onde estou gastando mais?',
    alerts:'Tenho alertas importantes?', goals:'Como estão minhas metas?',
    budget:'Quanto posso gastar com segurança?', investments:'Como está minha carteira?',
    debts:'Como estão minhas dívidas?',
  };
  return `${base}${extras[questionId]||''}\n\nPERGUNTA: "${questions[questionId]||'Análise geral'}"`;
}

const LEON_SYSTEM = `Você é Leon, o camaleão conselheiro financeiro do app Ei!. Simpático, direto, linguagem informal mas profissional.

REGRAS IMPORTANTES:
- Responda SEMPRE em português brasileiro
- Use no máximo 4 parágrafos curtos — nunca corte a resposta no meio de uma frase
- Seja específico com os números fornecidos
- Use 1-2 emojis de forma natural, nunca em excesso
- Comece sempre de forma diferente (evite "Olá" ou "Oi" toda vez)
- Termine SEMPRE com uma frase de encerramento completa
- Nunca invente dados — use apenas os fornecidos
- Mantenha coerência com o histórico da conversa
- Se a resposta precisar de mais detalhes, prefira 4 parágrafos completos a 3 cortados`;

// ── Endpoint principal ────────────────────────────────────────────────────
router.post('/ask', async (req, res) => {
  const { question_id, message, history=[] } = req.body;
  const isFree     = question_id === 'free' && message;
  const predefined = QUESTIONS.find(q=>q.id===question_id);
  if (!isFree && !predefined) return res.status(400).json({ error:'Pergunta inválida' });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error:'GROQ_API_KEY não configurada' });

  try {
    const supabase = db(req.token);
    let ctx;
    try { ctx = await getUserContext(supabase, req.user.id); }
    catch(e) { ctx = { mes:'este mês',daysLeft:15,income:0,expense:0,balance:0,savingRate:0,topCats:[],budgetStatus:[],goalStatus:[],debtStatus:[],invTotal:0,txCount:0,fixedMonthly:0,rawBudgets:[],rawGoals:[],rawTopCats:[] }; }

    const userPrompt = isFree
      ? `[CONTEXTO]\n${`Receitas: ${fmt(ctx.income)} | Despesas: ${fmt(ctx.expense)} | Saldo: ${fmt(ctx.balance)} | Top gastos: ${ctx.topCats.join(', ')||'nenhum'} | Tetos: ${ctx.budgetStatus.join('; ')||'nenhum'} | Metas: ${ctx.goalStatus.join('; ')||'nenhuma'}`}\n\n[PERGUNTA]\n${message}`
      : buildPrompt(question_id, ctx);

    const recentHistory = history.slice(-6).map(h=>({ role:h.from==='user'?'user':'assistant', content:h.text }));

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${apiKey}` },
      body: JSON.stringify({
        model:'llama-3.1-8b-instant', max_tokens:600, temperature:0.7,
        messages:[ {role:'system',content:LEON_SYSTEM}, ...recentHistory, {role:'user',content:userPrompt} ],
      }),
    });

    const data = await response.json();
    if (!response.ok) return res.status(500).json({ error: data.error?.message||'Erro no Groq' });

    const answer  = data.choices?.[0]?.message?.content?.trim() || 'Não consegui gerar resposta agora. Tenta de novo! 🦎';
    const actions = detectActions(question_id, ctx);

    res.json({ answer, actions });

  } catch(err) {
    console.error('Leon error:', err?.message||err);
    res.status(500).json({ error:`Erro interno: ${err?.message||'desconhecido'}` });
  }
});

module.exports = router;
