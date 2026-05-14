const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

function db(token) {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

// Listar investimentos com aportes agregados
router.get('/', async (req, res) => {
  const { data, error } = await db(req.token)
    .from('investments')
    .select('*, investment_entries(*)')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Criar investimento
router.post('/', async (req, res) => {
  const { name, ticker, type } = req.body;
  if (!name || !type) return res.status(400).json({ error: 'Nome e tipo são obrigatórios' });
  const { data, error } = await db(req.token)
    .from('investments')
    .insert({ name, ticker: ticker?.toUpperCase(), type, user_id: req.user.id })
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

// Atualizar investimento
router.put('/:id', async (req, res) => {
  const { name, ticker, type } = req.body;
  const { data, error } = await db(req.token)
    .from('investments')
    .update({ name, ticker: ticker?.toUpperCase(), type })
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Excluir investimento
router.delete('/:id', async (req, res) => {
  const { error } = await db(req.token)
    .from('investments')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.user.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'Investimento excluído' });
});

// Adicionar aporte
router.post('/:id/entries', async (req, res) => {
  const { quantity, price, date } = req.body;
  if (!quantity || !price || !date) return res.status(400).json({ error: 'Quantidade, preço e data são obrigatórios' });
  const supabase = db(req.token);

  const { data: entry, error } = await supabase
    .from('investment_entries')
    .insert({ investment_id: req.params.id, user_id: req.user.id, quantity, price, date })
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });

  // Recalcula preço médio e quantidade total
  const { data: entries } = await supabase
    .from('investment_entries')
    .select('quantity, price')
    .eq('investment_id', req.params.id);

  const totalQty   = entries.reduce((s, e) => s + Number(e.quantity), 0);
  const totalCost  = entries.reduce((s, e) => s + Number(e.quantity) * Number(e.price), 0);
  const avgPrice   = totalQty > 0 ? totalCost / totalQty : 0;

  await supabase
    .from('investments')
    .update({ quantity: totalQty, avg_price: avgPrice })
    .eq('id', req.params.id);

  res.status(201).json(entry);
});

// Excluir aporte
router.delete('/:id/entries/:entryId', async (req, res) => {
  const supabase = db(req.token);
  const { error } = await supabase
    .from('investment_entries')
    .delete()
    .eq('id', req.params.entryId)
    .eq('user_id', req.user.id);
  if (error) return res.status(400).json({ error: error.message });

  // Recalcula após excluir
  const { data: entries } = await supabase
    .from('investment_entries')
    .select('quantity, price')
    .eq('investment_id', req.params.id);

  const totalQty  = entries.reduce((s, e) => s + Number(e.quantity), 0);
  const totalCost = entries.reduce((s, e) => s + Number(e.quantity) * Number(e.price), 0);
  const avgPrice  = totalQty > 0 ? totalCost / totalQty : 0;

  await supabase
    .from('investments')
    .update({ quantity: totalQty, avg_price: avgPrice })
    .eq('id', req.params.id);

  res.json({ message: 'Aporte excluído' });
});

module.exports = router;
