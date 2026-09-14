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

router.get('/state', async (req, res) => {
  const supabase = db(req.token);
  const today = new Date();
  const month = today.getMonth()+1, year = today.getFullYear();
  const start = `${year}-${String(month).padStart(2,'0')}-01`;
  const end   = new Date(year,month,0).toISOString().split('T')[0];

  const [txs, budgets, debts] = await Promise.all([
    safeQuery(supabase.from('transactions').select('amount,type,category_id,transfer_id,is_investment').eq('user_id',req.user.id).gte('date',start).lte('date',end)),
    safeQuery(supabase.from('budgets').select('amount,category_id').eq('user_id',req.user.id)),
    safeQuery(supabase.from('debts').select('paid_installments,installments,due_day,start_date').eq('user_id',req.user.id)),
  ]);

  const real    = txs.filter(t=>!t.transfer_id);
  const income  = real.filter(t=>t.type==='income'&&!t.is_investment).reduce((s,t)=>s+Number(t.amount),0);
  const expense = real.filter(t=>t.type==='expense'&&!t.is_investment).reduce((s,t)=>s+Number(t.amount),0);
  const byCat   = {};
  real.filter(t=>t.type==='expense'&&!t.is_investment&&t.category_id).forEach(t=>{byCat[t.category_id]=(byCat[t.category_id]||0)+Number(t.amount);});
  const budgetExceeded = budgets.some(b=>Number(b.amount)>0&&(byCat[b.category_id]||0)>Number(b.amount));
  const hasOverdue     = debts.some(d=>{
    if(d.paid_installments>=d.installments||!d.start_date||!d.due_day) return false;
    const dt=new Date(d.start_date);dt.setMonth(dt.getMonth()+d.paid_installments);dt.setDate(d.due_day);
    return dt<today;
  });

  let state='happy', reason='Tudo bem!';
  if(hasOverdue)                        {state='stressed';reason='Parcela vencida';}
  else if(income>0&&expense>income)     {state='stressed';reason='Despesas maiores que receitas';}
  else if(budgetExceeded)               {state='stressed';reason='Teto ultrapassado';}
  else if(income===0&&expense===0)      {state='neutral'; reason='Sem movimentações';}
  else if(income>0&&expense/income>0.85){state='neutral'; reason=`Gastando ${Math.round(expense/income*100)}% da renda`;}

  res.json({ state, reason });
});

// ── Contexto financeiro ───────────────────────────────────────────────────
async function getUserContext(supabase, userId) {
  const today = new Date();
  const month = today.getMonth()+1, year=today.getFullYear();
  const start = `${year}-${String(month).padStart(2,'0')}-01`;
  const end   = new Date(year,month,0).toISOString().split('T')[0];
  const daysLeft = new Date(year,month,0).getDate()-today.getDate();

  const [txs,budgets,goals,debts] = await Promise.all([
    safeQuery(supabase.from('transactions').select('amount,type,category_id,date,description,transfer_id,is_investment,categories(name)').eq('user_id',userId).gte('date',start).lte('date',end)),
    safeQuery(supabase.from('budgets').select('amount,category_id,categories(name)').eq('user_id',userId)),
    safeQuery(supabase.from('goals').select('name,current_amount,target_amount,deadline').eq('user_id',userId)),
    safeQuery(supabase.from('debts').select('name,paid_installments,installments,installment_value,due_day,start_date').eq('user_id',userId)),
  ]);

  const real    = txs.filter(t=>!t.transfer_id);
  const income  = real.filter(t=>t.type==='income'&&!t.is_investment).reduce((s,t)=>s+Number(t.amount),0);
  const expense = real.filter(t=>t.type==='expense'&&!t.is_investment).reduce((s,t)=>s+Number(t.amount),0);

  const byCat = {};
  real.filter(t=>t.type==='expense'&&!t.is_investment).forEach(t=>{const n=t.categories?.name||'Sem cat';byCat[n]=(byCat[n]||0)+Number(t.amount);});
  const topCats = Object.entries(byCat).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([n,v])=>`${n}: ${fmt(v)}`);

  const budgetStatus = budgets.map(b=>{const s=byCat[b.categories?.name]||0;return `${b.categories?.name}: ${b.amount>0?Math.round(s/b.amount*100):0}% (${fmt(s)}/${fmt(b.amount)})`;});
  const goalStatus   = goals.map(g=>{const p=g.target_amount>0?Math.round(g.current_amount/g.target_amount*100):0;return `${g.name}: ${p}% — ${fmt(g.current_amount)}/${fmt(g.target_amount)}`;});
  const debtStatus   = debts.filter(d=>d.paid_installments<d.installments).map(d=>{
    let info='';if(d.start_date&&d.due_day){const dt=new Date(d.start_date);dt.setMonth(dt.getMonth()+d.paid_installments);dt.setDate(d.due_day);const diff=Math.ceil((dt-new Date())/(1000*60*60*24));info=diff<0?` (VENCIDA há ${Math.abs(diff)}d)`:` (vence em ${diff}d)`;}
    return `${d.name}: parcela ${d.paid_installments+1}/${d.installments} de ${fmt(d.installment_value)}${info}`;
  });

  return { mes:`${today.toLocaleString('pt-BR',{month:'long',year:'numeric'})}`, daysLeft, income, expense, balance:income-expense, savingRate:income>0?Math.round((income-expense)/income*100):0, topCats, budgetStatus, goalStatus, debtStatus, txCount:real.length, rawBudgets:budgets, rawGoals:goals, rawTopCats:Object.entries(byCat).sort((a,b)=>b[1]-a[1]).slice(0,3) };
}

function detectActions(questionId, ctx) {
  const actions = [];
  if(questionId==='spending'||questionId==='budget'){const topCatName=ctx.rawTopCats?.[0]?.[0];const hasBudget=ctx.rawBudgets?.some(b=>b.categories?.name===topCatName);if(topCatName&&!hasBudget)actions.push({type:'navigate',label:`📊 Criar teto para ${topCatName}`,url:'/budgets'});}
  if(questionId==='goals'){if(!ctx.rawGoals?.length)actions.push({type:'navigate',label:'🎯 Criar primeira meta',url:'/goals'});else actions.push({type:'navigate',label:'🎯 Ver todas as metas',url:'/goals'});}
  if(questionId==='alerts') actions.push({type:'navigate',label:'📊 Ver tetos',url:'/budgets'});
  if(questionId==='investments') actions.push({type:'navigate',label:'📈 Ver carteira',url:'/investments'});
  if(questionId==='finances'&&ctx.balance>500){actions.push({type:'navigate',label:'💰 Investir a sobra',url:'/investments'});actions.push({type:'navigate',label:'🎯 Contribuir para meta',url:'/goals'});}
  return actions.slice(0,3);
}

function buildPrompt(questionId, ctx) {
  const base=`DADOS (${ctx.mes}):\n- Receitas: ${fmt(ctx.income)} | Despesas: ${fmt(ctx.expense)} | Saldo: ${fmt(ctx.balance)}\n- Poupança: ${ctx.savingRate}% | Dias restantes: ${ctx.daysLeft}`;
  const extras={finances:'',spending:`\nTop gastos:\n${ctx.topCats.join('\n')||'Nenhum'}`,alerts:`\nTetos: ${ctx.budgetStatus.join('; ')||'Nenhum'}\nDívidas: ${ctx.debtStatus.join('; ')||'Nenhuma'}`,goals:`\nMetas:\n${ctx.goalStatus.join('\n')||'Nenhuma'}`,budget:`\nTop gastos: ${ctx.topCats.join(', ')}\nTetos: ${ctx.budgetStatus.join('; ')||'Nenhum'}`,investments:'',debts:`\nDívidas:\n${ctx.debtStatus.join('\n')||'Nenhuma'}`};
  const questions={finances:'Como estão minhas finanças?',spending:'Onde estou gastando mais?',alerts:'Tenho alertas importantes?',goals:'Como estão minhas metas?',budget:'Quanto posso gastar?',investments:'Como está minha carteira?',debts:'Como estão minhas dívidas?'};
  return `${base}${extras[questionId]||''}\n\nPERGUNTA: "${questions[questionId]||'Análise geral'}"`;
}

const LEON_SYSTEM = `Você é Leon, camaleão conselheiro financeiro do app Ei!. Simpático, direto, linguagem informal.
REGRAS: Responda em português brasileiro | Máximo 4 parágrafos curtos | Use os números fornecidos | 1-2 emojis | Termine com frase de encerramento completa | Nunca invente dados | Seja coerente com o histórico.`;

// ── Sistema de intenções para criação de transações ───────────────────────
const INTENT_SYSTEM = `Você é Leon, assistente financeiro. Analise a mensagem e retorne JSON puro (sem markdown) com:
{
  "intent": "create_transaction" | "none",
  "type": "income" | "expense",
  "amount": número ou null,
  "description": "string" ou null,
  "date": "YYYY-MM-DD" ou null,
  "missing": ["amount","description","date"] (campos ausentes),
  "question": "pergunta para obter o campo faltante" (se houver missing),
  "summary": "resumo da intenção detectada"
}

Datas relativas: "hoje" = data atual, "ontem" = dia anterior, "semana passada" etc.
Data de hoje: ${new Date().toISOString().split('T')[0]}
Se não houver intenção de criar transação, retorne apenas {"intent":"none"}.`;

async function detectIntent(message, apiKey) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions',{
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':`Bearer ${apiKey}`},
    body:JSON.stringify({
      model:'openai/gpt-oss-120b', max_tokens:200, temperature:0.1,
      messages:[{role:'system',content:INTENT_SYSTEM},{role:'user',content:message}],
    }),
  });
  const data = await response.json();
  const text = data.choices?.[0]?.message?.content?.trim()||'{}';
  try { return JSON.parse(text.replace(/```json|```/g,'').trim()); }
  catch { return { intent:'none' }; }
}

// ── Executar ação (criar transação) ──────────────────────────────────────
router.post('/execute', async (req, res) => {
  const { action } = req.body;
  if (action?.type !== 'create_transaction') return res.status(400).json({ error:'Ação inválida' });

  const supabase = db(req.token);
  const { amount, type, description, date, category_id, account_id } = action;

  try {
    const { data: tx } = await supabase.from('transactions').insert({
      user_id: req.user.id, amount, type,
      description: description||'Lançado pelo Leon',
      date: date || new Date().toISOString().split('T')[0],
      category_id: category_id||null,
      account_id:  account_id||null,
      status: 'confirmed',
    }).select().single();

    res.json({ success:true, transaction:tx, message:`✅ ${type==='income'?'Receita':'Despesa'} de ${fmt(amount)} registrada com sucesso!` });
  } catch(err) {
    res.status(400).json({ error: err.message });
  }
});

// ── Endpoint principal ─────────────────────────────────────────────────────
router.post('/ask', async (req, res) => {
  const { question_id, message, history=[], pending_action } = req.body;
  const isFree     = question_id==='free' && message;
  const predefined = QUESTIONS.find(q=>q.id===question_id);
  if (!isFree&&!predefined) return res.status(400).json({ error:'Pergunta inválida' });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error:'GROQ_API_KEY não configurada' });

  try {
    const supabase = db(req.token);
    let ctx;
    try { ctx = await getUserContext(supabase, req.user.id); }
    catch { ctx = { mes:'este mês',daysLeft:15,income:0,expense:0,balance:0,savingRate:0,topCats:[],budgetStatus:[],goalStatus:[],debtStatus:[],txCount:0,rawBudgets:[],rawGoals:[],rawTopCats:[] }; }

    // Detectar intenção de criar transação (só para mensagens livres)
    if (isFree) {
      const intent = await detectIntent(message, apiKey);

      if (intent.intent === 'create_transaction') {
        // Confirmação de ação pendente
        if (pending_action && /sim|confirma|ok|pode|vai|cria/i.test(message)) {
          return res.json({
            answer: `Perfeito! Registrando agora... 🦎`,
            action_confirmed: pending_action,
          });
        }

        // Campos faltando — faz pergunta
        if (intent.missing?.length > 0) {
          return res.json({
            answer: intent.question || `Para registrar essa ${intent.type==='income'?'receita':'despesa'}, preciso de mais informações.`,
            pending_action: {
              type: 'create_transaction',
              transaction_type: intent.type,
              amount: intent.amount,
              description: intent.description,
              date: intent.date,
              missing: intent.missing,
            },
            actions: [],
          });
        }

        // Todos os campos presentes — pede confirmação
        if (intent.amount && intent.description) {
          const today = new Date().toISOString().split('T')[0];
          return res.json({
            answer: `Entendi! Vou registrar:\n\n${intent.type==='income'?'📈 Receita':'📉 Despesa'}: ${fmt(intent.amount)}\nDescrição: ${intent.description}\nData: ${intent.date||today}\n\nConfirma? 🦎`,
            pending_action: {
              type: 'create_transaction',
              transaction_type: intent.type,
              amount: intent.amount,
              description: intent.description,
              date: intent.date || today,
            },
            actions: [
              { type:'confirm_action', label:'✓ Confirmar', variant:'success' },
              { type:'cancel_action',  label:'✗ Cancelar',  variant:'danger'  },
            ],
          });
        }
      }

      // Cancelar ação pendente
      if (pending_action && /não|nao|cancela|para/i.test(message)) {
        return res.json({
          answer: 'Tudo bem, cancelei! Me avisa se precisar de algo. 🦎',
          action_cancelled: true,
          actions: [],
        });
      }
    }

    // Resposta normal do Leon
    const userPrompt = isFree
      ? `[CONTEXTO]\nReceitas: ${fmt(ctx.income)} | Despesas: ${fmt(ctx.expense)} | Saldo: ${fmt(ctx.balance)} | Top gastos: ${ctx.topCats.join(', ')||'nenhum'} | Tetos: ${ctx.budgetStatus.join('; ')||'nenhum'}\n\n[PERGUNTA]\n${message}`
      : buildPrompt(question_id, ctx);

    const recentHistory = history.slice(-6).map(h=>({role:h.from==='user'?'user':'assistant',content:h.text}));

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${apiKey}`},
      body:JSON.stringify({ model:'openai/gpt-oss-120b', max_tokens:600, temperature:0.7,
        messages:[{role:'system',content:LEON_SYSTEM},...recentHistory,{role:'user',content:userPrompt}] }),
    });

    const data = await response.json();
    if (!response.ok) return res.status(500).json({ error:data.error?.message||'Erro no Groq' });

    const answer  = data.choices?.[0]?.message?.content?.trim()||'Não consegui gerar resposta. Tenta de novo! 🦎';
    const actions = isFree ? [] : detectActions(question_id, ctx);
    res.json({ answer, actions });

  } catch(err) {
    res.status(500).json({ error:`Erro interno: ${err?.message||'desconhecido'}` });
  }
});

module.exports = router;
