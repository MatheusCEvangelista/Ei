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

// Wrapper para queries opcionais que podem não existir
async function safeQuery(queryPromise) {
  try {
    const { data } = await queryPromise;
    return data || [];
  } catch (_) {
    return [];
  }
}

router.get('/', async (req, res) => {
  const supabase = db(req.token);
  const today    = new Date();
  const month    = today.getMonth() + 1;
  const year     = today.getFullYear();
  const start    = `${year}-${String(month).padStart(2,'0')}-01`;
  const end      = new Date(year, month, 0).toISOString().split('T')[0];

  const insights = [];

  // Busca paralela com safeQuery para tabelas opcionais
  const [txs, budgets, debts, cards, goals, recurrings] = await Promise.all([
    safeQuery(supabase.from('transactions').select('amount,type,category_id,categories(name,color),transfer_id').eq('user_id', req.user.id).gte('date', start).lte('date', end)),
    safeQuery(supabase.from('budgets').select('amount,category_id,categories(name)').eq('user_id', req.user.id)),
    safeQuery(supabase.from('debts').select('id,name,paid_installments,installments,installment_value,due_day,start_date').eq('user_id', req.user.id).eq('done', false)),
    safeQuery(supabase.from('credit_cards').select('id,name,closing_day,due_day').eq('user_id', req.user.id)),
    safeQuery(supabase.from('goals').select('id,name,current_amount,target_amount').eq('user_id', req.user.id)),
    safeQuery(supabase.from('recurring_transactions').select('id,description,last_created_at,frequency').eq('user_id', req.user.id).eq('active', true)),
  ]);

  const realTxs = txs.filter(t => !t.transfer_id);
  const income  = realTxs.filter(t => t.type==='income').reduce((s,t)=>s+Number(t.amount),0);
  const expense = realTxs.filter(t => t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);

  // Gastos por categoria no mês
  const spentByCat = {};
  realTxs.filter(t=>t.type==='expense').forEach(t => {
    if (!t.category_id) return;
    if (!spentByCat[t.category_id]) spentByCat[t.category_id] = { spent:0, name:t.categories?.name||'Categoria' };
    spentByCat[t.category_id].spent += Number(t.amount);
  });

  // ── Regra 1 & 2: Tetos ──────────────────────────────────────────────
  for (const budget of budgets) {
    const cat = spentByCat[budget.category_id];
    if (!cat) continue;
    const pct  = Math.round(cat.spent / budget.amount * 100);
    const name = budget.categories?.name || cat.name;

    if (pct >= 100) {
      insights.push({
        priority: 9, type:'critical', icon:'🔴',
        title: `Teto estourado: ${name}`,
        body:  `Você gastou R$${cat.spent.toFixed(2)} de R$${Number(budget.amount).toFixed(2)} neste mês (${pct}%).`,
        action: { label:'Ver tetos', url:'/budgets' },
      });
    } else if (pct >= 80) {
      insights.push({
        priority: 6, type:'warning', icon:'🟡',
        title: `Atenção: ${name} em ${pct}%`,
        body:  `Você já usou ${pct}% do teto. Restam R$${(Number(budget.amount) - cat.spent).toFixed(2)}.`,
        action: { label:'Ver tetos', url:'/budgets' },
      });
    }
  }

  // ── Regra 3: Dívidas vencidas / vencendo ────────────────────────────
  for (const debt of debts) {
    if (!debt.start_date || !debt.due_day) continue;
    const nextDue = new Date(debt.start_date);
    nextDue.setMonth(nextDue.getMonth() + debt.paid_installments);
    nextDue.setDate(debt.due_day);
    const diff = Math.ceil((nextDue - today) / (1000*60*60*24));

    if (diff < 0) {
      insights.push({
        priority: 10, type:'critical', icon:'🔴',
        title: `Parcela vencida: ${debt.name}`,
        body:  `A parcela ${debt.paid_installments+1}/${debt.installments} de R$${Number(debt.installment_value).toFixed(2)} está vencida há ${Math.abs(diff)} dia(s).`,
        action: { label:'Ver dívidas', url:'/debts' },
      });
    } else if (diff <= 5) {
      insights.push({
        priority: 7, type:'warning', icon:'⚠️',
        title: `Parcela vence em ${diff} dia(s): ${debt.name}`,
        body:  `Parcela ${debt.paid_installments+1}/${debt.installments} de R$${Number(debt.installment_value).toFixed(2)} vence em ${nextDue.toLocaleDateString('pt-BR')}.`,
        action: { label:'Ver dívidas', url:'/debts' },
      });
    }
  }

  // ── Regra 4: Fatura de cartão fechando ──────────────────────────────
  for (const card of cards) {
    if (!card.closing_day) continue;
    const closingDate = new Date(year, month - 1, card.closing_day);
    const diff = Math.ceil((closingDate - today) / (1000*60*60*24));
    if (diff >= 0 && diff <= 3) {
      insights.push({
        priority: 8, type:'critical', icon:'💳',
        title: `Fatura ${card.name} fecha em ${diff===0?'hoje':`${diff} dia(s)`}`,
        body:  `Verifique os lançamentos pendentes antes do fechamento.`,
        action: { label:'Ver cartões', url:'/credit-cards' },
      });
    }
  }

  // ── Regra 5: Saldo negativo ──────────────────────────────────────────
  if (income > 0 && expense > income) {
    insights.push({
      priority: 5, type:'warning', icon:'📉',
      title: `Despesas superam receitas este mês`,
      body:  `Você gastou R$${(expense-income).toFixed(2)} a mais do que recebeu.`,
      action: { label:'Ver dashboard', url:'/' },
    });
  }

  // ── Regra 6: Sem receita lançada ────────────────────────────────────
  if (income === 0 && expense > 0) {
    insights.push({
      priority: 1, type:'info', icon:'💡',
      title: `Nenhuma receita lançada este mês`,
      body:  `Você tem R$${expense.toFixed(2)} em despesas mas nenhuma receita registrada.`,
      action: { label:'Adicionar receita', url:'/' },
    });
  }

  // ── Regra 7: Recorrentes não geradas ────────────────────────────────
  const pendingRec = recurrings.filter(r => {
    if (r.frequency !== 'monthly') return false;
    if (!r.last_created_at) return true;
    const last = new Date(r.last_created_at);
    return !(last.getMonth()+1 === month && last.getFullYear() === year);
  });
  if (pendingRec.length > 0) {
    insights.push({
      priority: 4, type:'attention', icon:'🔄',
      title: `${pendingRec.length} recorrente(s) pendente(s)`,
      body:  `${pendingRec.slice(0,3).map(r=>r.description||'Sem nome').join(', ')}${pendingRec.length>3?' e mais...':''} ainda não foram geradas.`,
      action: { label:'Ver recorrentes', url:'/recurring' },
    });
  }

  // ── Regra 8: Meta quase concluída ───────────────────────────────────
  for (const goal of goals) {
    const pct = goal.target_amount > 0 ? Math.round(goal.current_amount / goal.target_amount * 100) : 0;
    if (pct >= 90 && pct < 100) {
      insights.push({
        priority: 3, type:'attention', icon:'🎯',
        title: `Meta "${goal.name}" quase concluída (${pct}%)`,
        body:  `Faltam R$${(Number(goal.target_amount)-Number(goal.current_amount)).toFixed(2)} para concluir esta meta.`,
        action: { label:'Ver metas', url:'/goals' },
      });
    }
  }

  // ── Regra 9: Categoria dominante ────────────────────────────────────
  if (expense > 0) {
    const topCat = Object.entries(spentByCat).sort((a,b)=>b[1].spent-a[1].spent)[0];
    if (topCat && topCat[1].spent / expense > 0.4) {
      const pct = Math.round(topCat[1].spent / expense * 100);
      insights.push({
        priority: 2, type:'info', icon:'📊',
        title: `${topCat[1].name} representa ${pct}% das despesas`,
        body:  `Você gastou R$${topCat[1].spent.toFixed(2)} em ${topCat[1].name} este mês.`,
        action: { label:'Ver categorias', url:'/categories' },
      });
    }
  }

  insights.sort((a, b) => b.priority - a.priority);
  res.json(insights);
});

module.exports = router;
