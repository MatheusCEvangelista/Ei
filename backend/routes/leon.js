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

// ── Perguntas disponíveis ──────────────────────────────────────────────────
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

// ── Estado do Leon (rule-based, sem IA) ───────────────────────────────────
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

  const real    = txs.filter(t=>!t.transfer_id);
  const income  = real.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0);
  const expense = real.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);
  const byCat   = {};
  real.filter(t=>t.type==='expense'&&t.category_id).forEach(t=>{ byCat[t.category_id]=(byCat[t.category_id]||0)+Number(t.amount); });

  // Bug fix: ignora orçamentos zerados e usa > em vez de >=
  const budgetExceeded = budgets.some(b => {
    const limit = Number(b.amount);
    if (limit <= 0) return false; // ignora tetos sem valor
    return (byCat[b.category_id]||0) > limit; // só > (não >=)
  });

  // Bug fix: calcula data de vencimento corretamente sem overflow
  const hasOverdue = debts.some(d => {
    if (d.paid_installments >= d.installments) return false;
    if (!d.start_date || !d.due_day) return false;
    try {
      const base = new Date(d.start_date);
      if (isNaN(base.getTime())) return false;
      // Avança meses sem risco de overflow de data
      const dueDate = new Date(
        base.getFullYear(),
        base.getMonth() + d.paid_installments,
        d.due_day
      );
      return dueDate < today;
    } catch { return false; }
  });

  const isNegative = income > 0 && expense > income;
  const isHighSpend = income > 0 && expense / income > 0.85; // aumentado de 0.7 para 0.85

  let state  = 'happy';
  let reason = 'Tudo bem!';

  if (hasOverdue) {
    state  = 'stressed';
    reason = 'Parcela de dívida vencida';
  } else if (isNegative) {
    state  = 'stressed';
    reason = 'Despesas maiores que receitas';
  } else if (budgetExceeded) {
    state  = 'stressed';
    reason = 'Teto de categoria ultrapassado';
  } else if (income === 0 && expense === 0) {
    state  = 'curious';
    reason = 'Sem movimentações no mês';
  } else if (isHighSpend) {
    state  = 'curious';
    reason = `Gastando ${Math.round(expense/income*100)}% da renda`;
  } else {
    reason = `Poupando ${Math.round((income-expense)/income*100)}% da renda`;
  }

  res.json({ state, reason });
});

// ── Coleta contexto financeiro completo do usuário ────────────────────────
async function getUserContext(supabase, userId) {
  const today  = new Date();
  const month  = today.getMonth() + 1;
  const year   = today.getFullYear();
  const start  = `${year}-${String(month).padStart(2,'0')}-01`;
  const end    = new Date(year, month, 0).toISOString().split('T')[0];
  const daysLeft = new Date(year, month, 0).getDate() - today.getDate();

  const [txs, budgets, goals, debts, investments, recurrings, cards] = await Promise.all([
    safeQuery(supabase.from('transactions').select('amount,type,category_id,date,description,transfer_id,categories(name)').eq('user_id',userId).gte('date',start).lte('date',end)),
    safeQuery(supabase.from('budgets').select('amount,category_id,categories(name)').eq('user_id',userId)),
    safeQuery(supabase.from('goals').select('name,current_amount,target_amount').eq('user_id',userId)),
    safeQuery(supabase.from('debts').select('name,paid_installments,installments,installment_value,due_day,start_date').eq('user_id',userId)),
    safeQuery(supabase.from('investments').select('name,type,quantity,avg_price,initial_amount,calculated_current_value').eq('user_id',userId)),
    safeQuery(supabase.from('recurring_transactions').select('description,amount,type,frequency,active').eq('user_id',userId).eq('active',true)),
    safeQuery(supabase.from('credit_cards').select('id,name,closing_day').eq('user_id',userId)),
  ]);

  const real    = txs.filter(t=>!t.transfer_id);
  const income  = real.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0);
  const expense = real.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);

  // Gastos por categoria
  const byCat = {};
  real.filter(t=>t.type==='expense').forEach(t=>{
    const name = t.categories?.name||'Sem categoria';
    byCat[name] = (byCat[name]||0)+Number(t.amount);
  });
  const topCats = Object.entries(byCat).sort((a,b)=>b[1]-a[1]).slice(0,5)
    .map(([name,val])=>`${name}: ${fmt(val)}`);

  // Status dos tetos
  const budgetStatus = budgets.map(b=>{
    const spent=byCat[b.categories?.name]||0;
    const pct=b.amount>0?Math.round(spent/b.amount*100):0;
    return `${b.categories?.name}: ${pct}% (${fmt(spent)} de ${fmt(b.amount)})`;
  });

  // Metas
  const goalStatus = goals.map(g=>{
    const pct=g.target_amount>0?Math.round(g.current_amount/g.target_amount*100):0;
    return `${g.name}: ${pct}% — ${fmt(g.current_amount)} de ${fmt(g.target_amount)}`;
  });

  // Dívidas com vencimento
  const debtStatus = debts.filter(d=>d.paid_installments<d.installments).map(d=>{
    let daysInfo = '';
    if (d.start_date&&d.due_day) {
      const dt=new Date(d.start_date);
      dt.setMonth(dt.getMonth()+d.paid_installments); dt.setDate(d.due_day);
      const diff=Math.ceil((dt-new Date())/(1000*60*60*24));
      daysInfo = diff<0?` (VENCIDA há ${Math.abs(diff)}d)`:` (vence em ${diff}d)`;
    }
    return `${d.name}: parcela ${d.paid_installments+1}/${d.installments} de ${fmt(d.installment_value)}${daysInfo}`;
  });

  // Carteira
  const invTotal = investments.reduce((s,i)=>{
    return s+(['fixed_income','treasury'].includes(i.type)
      ? Number(i.calculated_current_value||i.initial_amount||0)
      : Number(i.quantity||0)*Number(i.avg_price||0));
  },0);

  // Faturas cartão
  let cardInfo = '';
  for (const card of cards) {
    const cardTxs = await safeQuery(
      supabase.from('transactions').select('amount').eq('user_id',userId).eq('credit_card_id',card.id).gte('date',start).lte('date',end)
    );
    const invoice = cardTxs.reduce((s,t)=>s+Number(t.amount),0);
    if (invoice>0) cardInfo += `${card.name}: ${fmt(invoice)} | `;
  }

  return {
    mes: today.toLocaleString('pt-BR',{month:'long',year:'numeric'}),
    daysLeft,
    income, expense,
    balance: income-expense,
    savingRate: income>0?Math.round((income-expense)/income*100):0,
    topCats,
    budgetStatus,
    goalStatus,
    debtStatus,
    invTotal,
    cardInfo: cardInfo.slice(0,-3)||'Nenhuma fatura no mês',
    txCount: real.length,
    fixedMonthly: recurrings.filter(r=>r.type==='expense'&&r.frequency==='monthly').reduce((s,r)=>s+Number(r.amount),0),
  };
}

// ── Sistema de prompts por pergunta ───────────────────────────────────────
function buildPrompt(questionId, ctx) {
  const base = `
DADOS FINANCEIROS DO USUÁRIO (${ctx.mes}):
- Receitas: ${fmt(ctx.income)} | Despesas: ${fmt(ctx.expense)} | Saldo: ${fmt(ctx.balance)}
- Taxa de poupança: ${ctx.savingRate}% | Dias restantes no mês: ${ctx.daysLeft}
- Transações registradas: ${ctx.txCount}
- Fixos mensais: ${fmt(ctx.fixedMonthly)}
`.trim();

  const extras = {
    finances: '',
    spending: `\nTop categorias de gasto:\n${ctx.topCats.join('\n') || 'Nenhum gasto registrado'}`,
    alerts:   `\nStatus dos tetos:\n${ctx.budgetStatus.join('\n') || 'Nenhum teto definido'}\n\nDívidas:\n${ctx.debtStatus.join('\n') || 'Nenhuma dívida ativa'}\n\nFaturas de cartão: ${ctx.cardInfo}`,
    goals:    `\nMetas:\n${ctx.goalStatus.join('\n') || 'Nenhuma meta cadastrada'}`,
    budget:   `\nTop categorias de gasto:\n${ctx.topCats.join('\n')}\n\nStatus dos tetos:\n${ctx.budgetStatus.join('\n') || 'Nenhum teto definido'}`,
    investments: `\nCarteira total estimada: ${fmt(ctx.invTotal)}`,
    debts:    `\nDívidas:\n${ctx.debtStatus.join('\n') || 'Nenhuma dívida ativa'}`,
  };

  const questions = {
    finances:    'Como estão minhas finanças este mês?',
    spending:    'Onde estou gastando mais e como posso melhorar?',
    alerts:      'Tenho algum alerta importante que devo saber agora?',
    goals:       'Como estão minhas metas de economia?',
    budget:      'Quanto ainda posso gastar de forma segura até o fim do mês?',
    investments: 'Como está minha carteira de investimentos?',
    debts:       'Como estão minhas dívidas e há alguma urgência?',
  };

  return `${base}${extras[questionId]||''}\n\nPERGUNTA DO USUÁRIO: "${questions[questionId]}"`;
}

// ── System prompt do Leon ────────────────────────────────────────────────
const LEON_SYSTEM = `Você é Leon, o camaleão conselheiro financeiro do app Ei!. Você é simpático, direto e usa linguagem informal mas profissional.

REGRAS IMPORTANTES:
- Responda SEMPRE em português brasileiro
- Use no máximo 3 parágrafos curtos
- Seja específico com os números fornecidos nos dados financeiros
- Use 1-2 emojis de forma natural, nunca em excesso
- Não repita a pergunta do usuário
- Comece sempre de forma diferente (evite começar com "Olá" ou "Oi" toda vez)
- Se os dados forem positivos, celebre! Se negativos, seja honesto mas encorajador
- Termine com uma dica prática e acionável quando possível
- Nunca invente dados — use apenas os fornecidos
- Você tem acesso ao histórico da conversa — mantenha coerência com o que já foi dito
- Se o usuário fizer uma pergunta fora do contexto financeiro, redirecione gentilmente para finanças`;

// ── Endpoint principal: pergunta para o Leon (IA via Groq) ────────────────
router.post('/ask', async (req, res) => {
  const { question_id, message, history = [] } = req.body;

  // Valida: precisa de question_id (predefinida) OU message (livre)
  const isFree     = question_id === 'free' && message;
  const predefined = QUESTIONS.find(q => q.id === question_id);
  if (!isFree && !predefined) return res.status(400).json({ error: 'Pergunta inválida' });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GROQ_API_KEY não configurada no servidor' });

  try {
    const supabase = db(req.token);
    const ctx      = await getUserContext(supabase, req.user.id);

    // Contexto financeiro resumido (sempre enviado)
    const contextBlock = `
DADOS FINANCEIROS ATUAIS (${ctx.mes}):
Receitas: ${fmt(ctx.income)} | Despesas: ${fmt(ctx.expense)} | Saldo: ${fmt(ctx.balance)}
Poupança: ${ctx.savingRate}% | Dias restantes: ${ctx.daysLeft}
Top gastos: ${ctx.topCats.join(', ') || 'nenhum'}
Tetos: ${ctx.budgetStatus.join('; ') || 'nenhum definido'}
Metas: ${ctx.goalStatus.join('; ') || 'nenhuma'}
Dívidas: ${ctx.debtStatus.join('; ') || 'nenhuma'}
Carteira investida: ${fmt(ctx.invTotal)}
Faturas cartão: ${ctx.cardInfo}
`.trim();

    // Monta o prompt da mensagem atual
    let userPrompt;
    if (isFree) {
      userPrompt = `[CONTEXTO FINANCEIRO]
${contextBlock}

[PERGUNTA DO USUÁRIO]
${message}`;
    } else {
      userPrompt = buildPrompt(question_id, ctx);
    }

    // Monta histórico de conversa para o Groq (máx últimas 6 mensagens)
    const recentHistory = history.slice(-6).map(h => ({
      role:    h.from === 'user' ? 'user' : 'assistant',
      content: h.text,
    }));

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:       'llama-3.1-8b-instant',
        max_tokens:  300,
        temperature: 0.7,
        messages: [
          { role: 'system', content: LEON_SYSTEM },
          ...recentHistory,
          { role: 'user',   content: userPrompt },
        ],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Groq error:', data);
      return res.status(500).json({ error: data.error?.message || 'Erro ao chamar o Groq' });
    }

    const answer = data.choices?.[0]?.message?.content?.trim()
      || 'Não consegui gerar uma resposta agora. Tente de novo! 🦎';

    res.json({ answer });

  } catch (err) {
    console.error('Leon error:', err);
    res.status(500).json({ error: 'Erro ao processar resposta. Tente novamente!' });
  }
});

module.exports = router;
