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

// GET /api/planning?month=8&year=2026
router.get('/', async (req, res) => {
  const supabase = db(req.token);
  const month    = Number(req.query.month) || new Date().getMonth()+1;
  const year     = Number(req.query.year)  || new Date().getFullYear();

  const { data, error } = await supabase.from('planning_sessions')
    .select('*').eq('user_id', req.user.id).eq('month', month).eq('year', year).single();

  if (error && error.code !== 'PGRST116') return res.status(400).json({ error: error.message });
  res.json(data || { month, year, items: [], leon_notes: null });
});

// POST /api/planning — cria ou atualiza
router.post('/', async (req, res) => {
  const supabase = db(req.token);
  const { month, year, items, leon_notes } = req.body;

  const { data: existing } = await supabase.from('planning_sessions')
    .select('id').eq('user_id', req.user.id).eq('month', month).eq('year', year).single();

  let result;
  if (existing?.id) {
    result = await supabase.from('planning_sessions')
      .update({ items, leon_notes, updated_at: new Date().toISOString() })
      .eq('id', existing.id).select().single();
  } else {
    result = await supabase.from('planning_sessions')
      .insert({ user_id: req.user.id, month, year, items: items||[], leon_notes: leon_notes||null })
      .select().single();
  }

  if (result.error) return res.status(400).json({ error: result.error.message });
  res.json(result.data);
});

// GET /api/planning/real-transactions?month=8&year=2026
// Puxa receitas e despesas reais do mês como itens de planejamento
router.get('/real-transactions', async (req, res) => {
  const supabase = db(req.token);
  const month    = Number(req.query.month) || new Date().getMonth()+1;
  const year     = Number(req.query.year)  || new Date().getFullYear();
  const start    = `${year}-${String(month).padStart(2,'0')}-01`;
  const end      = new Date(year, month, 0).toISOString().split('T')[0];

  const { data: txs } = await supabase.from('transactions')
    .select('amount,type,description,categories(name)')
    .eq('user_id', req.user.id).eq('status','confirmed')
    .gte('date', start).lte('date', end).is('transfer_id', null);

  const items = (txs||[]).map(t => ({
    id:          crypto.randomUUID?.() || Math.random().toString(36).slice(2),
    type:        t.type,
    description: t.description || t.categories?.name || 'Sem descrição',
    amount:      Number(t.amount),
    from_real:   true,
  }));

  res.json(items);
});

// POST /api/planning/analyze — análise por regras (sem IA)
router.post('/analyze', async (req, res) => {
  const { items, month, year } = req.body;
  if (!items?.length) return res.json({ suggestions:[], daily_budget:0, status:'empty' });

  const today      = new Date();
  const daysInMonth= new Date(year, month, 0).getDate();
  const daysLeft   = Math.max(1, daysInMonth - today.getDate() + 1);
  const totalIncome  = items.filter(i=>i.type==='income').reduce((s,i)=>s+Number(i.amount),0);
  const totalExpense = items.filter(i=>i.type==='expense').reduce((s,i)=>s+Number(i.amount),0);
  const balance      = totalIncome - totalExpense;
  const savingRate   = totalIncome>0 ? (balance/totalIncome)*100 : 0;
  const dailyBudget  = Math.max(0, balance/daysLeft);

  const suggestions = [];

  if (totalIncome === 0) {
    suggestions.push({ icon:'⚠️', type:'warning', text:'Nenhuma receita prevista. Adicione pelo menos uma fonte de renda para o planejamento funcionar.' });
  } else if (balance < 0) {
    suggestions.push({ icon:'🔴', type:'danger', text:`Suas despesas superam as receitas em ${new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Math.abs(balance))}. Revise seus gastos antes de fechar o mês.` });
  } else {
    suggestions.push({ icon:'✅', type:'success', text:`Você pode gastar até ${new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(dailyBudget)} por dia pelos próximos ${daysLeft} dias restantes do mês.` });
  }

  if (savingRate >= 20) {
    suggestions.push({ icon:'💰', type:'success', text:`Taxa de poupança de ${Math.round(savingRate)}% — excelente! Considere aportar ${new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(balance*0.5)} em investimentos e manter o resto como reserva.` });
  } else if (savingRate > 0 && savingRate < 10) {
    suggestions.push({ icon:'📉', type:'warning', text:`Taxa de poupança de apenas ${Math.round(savingRate)}%. O ideal é guardar pelo menos 20% da renda. Tente reduzir despesas variáveis.` });
  }

  const topExpense = items.filter(i=>i.type==='expense').sort((a,b)=>b.amount-a.amount)[0];
  if (topExpense && totalExpense>0) {
    const pct = Math.round(topExpense.amount/totalExpense*100);
    if (pct > 40) suggestions.push({ icon:'📊', type:'info', text:`"${topExpense.description}" representa ${pct}% das suas despesas. Despesas concentradas em um item são um risco — considere diversificar ou reduzir.` });
  }

  if (balance > 0 && savingRate > 0) {
    const emergency = balance * 0.3, invest = balance * 0.5, free = balance * 0.2;
    suggestions.push({ icon:'🎯', type:'info', text:`Sugestão de uso do saldo de ${new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(balance)}: 50% em investimentos (${new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(invest)}), 30% reserva de emergência (${new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(emergency)}), 20% livre (${new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(free)}).` });
  }

  res.json({
    suggestions, daily_budget: Math.round(dailyBudget*100)/100,
    total_income: totalIncome, total_expense: totalExpense,
    balance, saving_rate: Math.round(savingRate), days_left: daysLeft,
    status: balance>=0?'ok':'deficit',
  });
});

// POST /api/planning/analyze-leon — análise com IA (Groq)
router.post('/analyze-leon', async (req, res) => {
  const { items, month, year } = req.body;
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error:'GROQ_API_KEY não configurada' });

  const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const fmt = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);

  const income  = items.filter(i=>i.type==='income').reduce((s,i)=>s+Number(i.amount),0);
  const expense = items.filter(i=>i.type==='expense').reduce((s,i)=>s+Number(i.amount),0);
  const balance = income - expense;
  const today   = new Date();
  const daysLeft= new Date(year,month,0).getDate()-today.getDate()+1;

  const incomeList  = items.filter(i=>i.type==='income').map(i=>`  • ${i.description}: ${fmt(i.amount)}`).join('\n');
  const expenseList = items.filter(i=>i.type==='expense').map(i=>`  • ${i.description}: ${fmt(i.amount)}`).join('\n');

  const prompt = `Sou o Leon, camaleão consultor financeiro do app Ei!. Analise este planejamento de ${MONTH_NAMES[month-1]} ${year}:

RECEITAS (Total: ${fmt(income)}):
${incomeList||'  Nenhuma'}

DESPESAS (Total: ${fmt(expense)}):
${expenseList||'  Nenhuma'}

SALDO PREVISTO: ${fmt(balance)}
DIAS RESTANTES NO MÊS: ${daysLeft}

Forneça uma análise personalizada em português informal com:
1. Avaliação geral do planejamento
2. Quanto pode gastar por dia
3. 2-3 sugestões práticas e específicas
4. Uma dica motivacional final

Seja direto, use os números reais, máximo 4 parágrafos.`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${apiKey}`},
      body: JSON.stringify({
        model:'llama-3.1-8b-instant', max_tokens:500, temperature:0.7,
        messages:[
          {role:'system',content:'Você é Leon, camaleão conselheiro financeiro. Responda sempre em português brasileiro, seja direto e use os números fornecidos.'},
          {role:'user',content:prompt},
        ],
      }),
    });
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content?.trim() || 'Não consegui analisar agora. Tente novamente!';
    res.json({ text, status: balance>=0?'ok':'deficit' });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
