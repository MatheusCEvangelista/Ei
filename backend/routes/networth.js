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

router.get('/', async (req, res) => {
  const supabase = db(req.token);
  const today    = new Date();

  const [accounts, allTxs, investments, debts, cards] = await Promise.all([
    safeQuery(supabase.from('accounts').select('id,name,color,icon').eq('user_id', req.user.id)),
    safeQuery(supabase.from('transactions').select('amount,type,account_id,transfer_id').eq('user_id', req.user.id)),
    safeQuery(supabase.from('investments').select('type,name,quantity,avg_price,initial_amount,calculated_current_value').eq('user_id', req.user.id)),
    safeQuery(supabase.from('debts').select('name,total_amount,paid_installments,installments,installment_value').eq('user_id', req.user.id)),
    safeQuery(supabase.from('credit_cards').select('id,name,color').eq('user_id', req.user.id)),
  ]);

  // ── ATIVOS ───────────────────────────────────────────────────────────

  // 1. Saldo por conta (soma de transações - transfers)
  const balanceByAccount = {};
  allTxs.filter(t => !t.transfer_id && t.account_id).forEach(t => {
    if (!balanceByAccount[t.account_id]) balanceByAccount[t.account_id] = 0;
    balanceByAccount[t.account_id] += t.type === 'income' ? Number(t.amount) : -Number(t.amount);
  });

  const accountAssets = accounts.map(acc => ({
    id:      acc.id,
    name:    acc.name,
    icon:    acc.icon || '🏦',
    color:   acc.color || 'var(--indigo)',
    balance: Math.max(0, balanceByAccount[acc.id] || 0), // não conta saldo negativo como ativo
  }));
  const totalAccounts = accountAssets.reduce((s, a) => s + a.balance, 0);

  // 2. Carteira de investimentos
  const invAssets = investments.map(inv => {
    const isFixed = ['fixed_income', 'treasury'].includes(inv.type);
    const value   = isFixed
      ? Number(inv.calculated_current_value || inv.initial_amount || 0)
      : Number(inv.quantity || 0) * Number(inv.avg_price || 0);
    return { name: inv.name, type: inv.type, value };
  });
  const totalInvestments = invAssets.reduce((s, i) => s + i.value, 0);

  // ── PASSIVOS ──────────────────────────────────────────────────────────

  // 3. Dívidas restantes
  const debtLiabilities = debts
    .filter(d => d.paid_installments < d.installments)
    .map(d => ({
      name:      d.name,
      remaining: (d.installments - d.paid_installments) * Number(d.installment_value),
    }));
  const totalDebts = debtLiabilities.reduce((s, d) => s + d.remaining, 0);

  // 4. Faturas de cartão (mês atual)
  const month  = today.getMonth() + 1;
  const year   = today.getFullYear();
  const start  = `${year}-${String(month).padStart(2,'0')}-01`;
  const end    = new Date(year, month, 0).toISOString().split('T')[0];

  const cardLiabilities = [];
  for (const card of cards) {
    const { data: cardTxs } = await supabase.from('transactions')
      .select('amount').eq('user_id', req.user.id)
      .eq('credit_card_id', card.id).gte('date', start).lte('date', end);
    const invoice = (cardTxs || []).reduce((s, t) => s + Number(t.amount), 0);
    if (invoice > 0) cardLiabilities.push({ name: card.name, invoice });
  }
  const totalCards = cardLiabilities.reduce((s, c) => s + c.invoice, 0);

  // ── TOTAIS ─────────────────────────────────────────────────────────────
  const totalAssets      = totalAccounts + totalInvestments;
  const totalLiabilities = totalDebts + totalCards;
  const netWorth         = totalAssets - totalLiabilities;

  // ── EVOLUÇÃO (últimos 6 meses) ─────────────────────────────────────────
  const evolution = [];
  for (let i = 5; i >= 0; i--) {
    const d     = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const m     = d.getMonth() + 1;
    const y     = d.getFullYear();
    const mEnd  = new Date(y, m, 0).toISOString().split('T')[0];
    const mStart = `${y}-${String(m).padStart(2,'0')}-01`;

    const { data: mTxs } = await supabase.from('transactions')
      .select('amount,type,transfer_id').eq('user_id', req.user.id).lte('date', mEnd);

    const real     = (mTxs || []).filter(t => !t.transfer_id);
    const totalInc = real.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const totalExp = real.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
    const balance  = totalInc - totalExp;

    evolution.push({
      label:  d.toLocaleString('pt-BR', { month: 'short', year: 'numeric' }),
      assets: Math.max(0, balance) + totalInvestments, // aproximação
      balance,
    });
  }

  res.json({
    net_worth:    Math.round(netWorth * 100) / 100,
    total_assets: Math.round(totalAssets * 100) / 100,
    total_liabilities: Math.round(totalLiabilities * 100) / 100,
    assets: {
      accounts:    accountAssets,
      investments: invAssets,
      totals: { accounts: totalAccounts, investments: totalInvestments },
    },
    liabilities: {
      debts: debtLiabilities,
      cards: cardLiabilities,
      totals: { debts: totalDebts, cards: totalCards },
    },
    evolution,
  });
});

module.exports = router;
