const express = require('express');
const router  = express.Router();
const { createClient } = require('@supabase/supabase-js');
const authMiddleware   = require('../middleware/auth');
const { v4: uuidv4 }  = require('uuid');

router.use(authMiddleware);

function db(token) {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

// Listar transferências
router.get('/', async (req, res) => {
  const { month, year } = req.query;
  const supabase = db(req.token);

  let query = supabase.from('transactions')
    .select('*, accounts(id,name,color,icon)')
    .eq('user_id', req.user.id)
    .eq('type', 'expense')
    .not('transfer_id', 'is', null)
    .order('date', { ascending: false });

  if (month && year) {
    const start = `${year}-${String(month).padStart(2,'0')}-01`;
    const end   = new Date(year, month, 0).toISOString().split('T')[0];
    query = query.gte('date', start).lte('date', end);
  }

  const { data: debits, error } = await query;
  if (error) return res.status(400).json({ error: error.message });

  // Para cada débito, busca o crédito correspondente
  const transfers = await Promise.all((debits||[]).map(async debit => {
    const { data: credit } = await supabase.from('transactions')
      .select('*, accounts(id,name,color,icon)')
      .eq('transfer_id', debit.transfer_id)
      .eq('type', 'income')
      .eq('user_id', req.user.id)
      .single();
    return {
      transfer_id: debit.transfer_id,
      date:        debit.date,
      description: debit.description || 'Transferência',
      amount:      debit.amount,
      from_account: debit.accounts,
      to_account:   credit?.accounts || null,
      from_tx_id:   debit.id,
      to_tx_id:     credit?.id || null,
    };
  }));

  res.json(transfers);
});

// Criar transferência
router.post('/', async (req, res) => {
  const { from_account_id, to_account_id, amount, date, description } = req.body;
  if (!from_account_id || !to_account_id || !amount || !date)
    return res.status(400).json({ error: 'Conta origem, destino, valor e data são obrigatórios' });
  if (from_account_id === to_account_id)
    return res.status(400).json({ error: 'Conta de origem e destino devem ser diferentes' });

  const supabase   = db(req.token);
  const transferId = uuidv4();
  const desc       = description || 'Transferência entre contas';

  const { error } = await supabase.from('transactions').insert([
    // Débito na conta de origem
    {
      user_id:     req.user.id,
      account_id:  from_account_id,
      amount,
      type:        'expense',
      date,
      description: desc,
      transfer_id: transferId,
    },
    // Crédito na conta de destino
    {
      user_id:     req.user.id,
      account_id:  to_account_id,
      amount,
      type:        'income',
      date,
      description: desc,
      transfer_id: transferId,
    },
  ]);

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json({ transfer_id: transferId, message: 'Transferência criada' });
});

// Excluir transferência (remove as duas transações)
router.delete('/:transferId', async (req, res) => {
  const { error } = await db(req.token).from('transactions')
    .delete()
    .eq('transfer_id', req.params.transferId)
    .eq('user_id', req.user.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'ok' });
});

module.exports = router;
