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

function calcFixedIncome(initialAmount, rate, ratePeriod, startDate, toDate) {
  if (!rate || !startDate || !initialAmount) return Number(initialAmount) || 0;
  const monthlyRate = ratePeriod === 'yearly' ? rate / 12 : rate;
  const months = Math.max(0, Math.floor(
    (new Date(toDate) - new Date(startDate)) / (1000 * 60 * 60 * 24 * 30.44)
  ));
  return Number(initialAmount) * Math.pow(1 + monthlyRate / 100, months);
}

// Listar investimentos
router.get('/', async (req, res) => {
  const { data, error } = await db(req.token)
    .from('investments').select('*, investment_entries(*)')
    .eq('user_id', req.user.id).order('created_at', { ascending: false });
  if (error) return res.status(400).json({ error: error.message });

  const enriched = data.map(inv => {
    if (['fixed_income','treasury'].includes(inv.type) && inv.rate && inv.initial_amount) {
      const startDate = inv.investment_entries?.[0]?.date || inv.created_at;
      return { ...inv, calculated_current_value: calcFixedIncome(inv.initial_amount, inv.rate, inv.rate_period, startDate, new Date()) };
    }
    return inv;
  });
  res.json(enriched);
});

// Evolução histórica da carteira
router.get('/evolution', async (req, res) => {
  const supabase = db(req.token);
  const months   = Number(req.query.months) || 12;

  // Busca todos os aportes do usuário
  const { data: entries, error } = await supabase
    .from('investment_entries')
    .select('*, investments(id,name,type,rate,rate_period,initial_amount)')
    .eq('user_id', req.user.id)
    .order('date', { ascending: true });
  if (error) return res.status(400).json({ error: error.message });

  if (!entries?.length) return res.json({ points: [], total_invested: 0, total_current: 0 });

  // Gera pontos mensais
  const today   = new Date();
  const points  = [];

  for (let i = months - 1; i >= 0; i--) {
    const pointDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const pointStr  = pointDate.toISOString().split('T')[0];

    // Soma aportes até este ponto
    const relevantEntries = entries.filter(e => e.date <= pointStr);
    let invested    = 0;
    let fixedValue  = 0;
    let variableInvested = 0;

    relevantEntries.forEach(e => {
      const cost = Number(e.quantity) * Number(e.price);
      invested += cost;

      const inv = e.investments;
      if (inv && ['fixed_income','treasury'].includes(inv.type) && inv.rate && inv.initial_amount) {
        // Para renda fixa, calcula valor com juros até este ponto
        const startDate = entries.find(en => en.investment_id === inv.id)?.date || pointStr;
        fixedValue += calcFixedIncome(Number(e.price) * Number(e.quantity), inv.rate, inv.rate_period, e.date, pointStr);
      } else {
        variableInvested += cost;
      }
    });

    const label = pointDate.toLocaleString('pt-BR', { month: 'short', year: 'numeric' });
    points.push({
      label,
      date:       pointStr,
      invested:   Math.round(invested     * 100) / 100,
      // Para variáveis sem dados históricos, usamos o custo; para renda fixa, valor calculado
      estimated:  Math.round((fixedValue + variableInvested) * 100) / 100,
    });
  }

  // Totais atuais (último ponto)
  const last = points[points.length - 1];

  res.json({
    points,
    total_invested: last?.invested  || 0,
    total_estimated: last?.estimated || 0,
    gain: Math.round(((last?.estimated || 0) - (last?.invested || 0)) * 100) / 100,
    gain_pct: last?.invested > 0
      ? Math.round(((last.estimated - last.invested) / last.invested) * 100 * 100) / 100
      : 0,
  });
});

// Criar
router.post('/', async (req, res) => {
  const { name, ticker, type, rate, rate_period, maturity_date, initial_amount } = req.body;
  if (!name || !type) return res.status(400).json({ error: 'Nome e tipo são obrigatórios' });
  const payload = { name, ticker: ticker?.toUpperCase()||null, type, user_id: req.user.id };
  if (['fixed_income','treasury'].includes(type))
    Object.assign(payload, { rate, rate_period, maturity_date: maturity_date||null, initial_amount });
  const supabase = db(req.token);
  const { data, error } = await supabase.from('investments').insert(payload).select().single();
  if (error) return res.status(400).json({ error: error.message });
  if (['fixed_income','treasury'].includes(type) && initial_amount) {
    const today = new Date().toISOString().split('T')[0];
    await supabase.from('investment_entries').insert({ investment_id: data.id, user_id: req.user.id, quantity: 1, price: initial_amount, date: today });
    await supabase.from('investments').update({ quantity: 1, avg_price: initial_amount }).eq('id', data.id);
  }
  res.status(201).json(data);
});

// Atualizar
router.put('/:id', async (req, res) => {
  const { name, ticker, type, rate, rate_period, maturity_date, initial_amount } = req.body;
  const { data, error } = await db(req.token).from('investments')
    .update({ name, ticker: ticker?.toUpperCase()||null, type, rate, rate_period, maturity_date: maturity_date||null, initial_amount })
    .eq('id', req.params.id).eq('user_id', req.user.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Excluir
router.delete('/:id', async (req, res) => {
  const { error } = await db(req.token).from('investments').delete().eq('id', req.params.id).eq('user_id', req.user.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'ok' });
});

// Adicionar aporte
router.post('/:id/entries', async (req, res) => {
  const { quantity, price, date } = req.body;
  if (!quantity || !price || !date) return res.status(400).json({ error: 'Dados obrigatórios' });
  const supabase = db(req.token);
  const { data: entry, error } = await supabase.from('investment_entries')
    .insert({ investment_id: req.params.id, user_id: req.user.id, quantity, price, date }).select().single();
  if (error) return res.status(400).json({ error: error.message });
  const { data: entries } = await supabase.from('investment_entries').select('quantity,price').eq('investment_id', req.params.id);
  const totalQty = entries.reduce((s,e)=>s+Number(e.quantity),0);
  const avgPrice = totalQty>0 ? entries.reduce((s,e)=>s+Number(e.quantity)*Number(e.price),0)/totalQty : 0;
  await supabase.from('investments').update({ quantity: totalQty, avg_price: avgPrice }).eq('id', req.params.id);
  res.status(201).json(entry);
});

// Excluir aporte
router.delete('/:id/entries/:entryId', async (req, res) => {
  const supabase = db(req.token);
  await supabase.from('investment_entries').delete().eq('id', req.params.entryId).eq('user_id', req.user.id);
  const { data: entries } = await supabase.from('investment_entries').select('quantity,price').eq('investment_id', req.params.id);
  const totalQty = entries.reduce((s,e)=>s+Number(e.quantity),0);
  const avgPrice = totalQty>0 ? entries.reduce((s,e)=>s+Number(e.quantity)*Number(e.price),0)/totalQty : 0;
  await supabase.from('investments').update({ quantity: totalQty, avg_price: avgPrice }).eq('id', req.params.id);
  res.json({ message: 'ok' });
});

module.exports = router;
