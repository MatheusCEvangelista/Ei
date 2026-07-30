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

function daysDiff(dateStr) {
  return Math.ceil((new Date(dateStr+'T00:00:00') - new Date()) / (1000*60*60*24));
}

router.get('/', async (req, res) => {
  const supabase = db(req.token);
  const today    = new Date();
  const month    = today.getMonth() + 1;
  const year     = today.getFullYear();
  const start    = `${year}-${String(month).padStart(2,'0')}-01`;
  const end      = new Date(year, month, 0).toISOString().split('T')[0];

  const insights = [];

  // Busca paralela de todos os dados necessários
  const [
    { data: txs },
    { data: budgets },
    { data: debts },
    { data: cards },
    { data: goals },
    { data: recurrings },
  ] = await Promise.all([
    supabase.from('transactions').select('amount,type,category_id,categories(name,color),transfer_id')
      .eq('user_id', req.user.id).gte('date', start).lte('date', end),
    supabase.from('budgets').select('amount,category_id,categories(name)')
      .eq('user_id', req.user.id),
    supabase.from('debts').select('id,name,paid_installments,installments,installment_value,due_day,start_date,done')
      .eq('user_id', req.user.id),
    supabase.from('credit_cards').select('id,name,closing_day,due_day,color')
      .eq('user_id', req.user.id).catch(()=>({data:[]})),
    supabase.from('goals').select('id,name,current_amount,target_amount')
      .eq('user_id', req.user.id),
    supabase.from('recurring_transactions').select('id,description,last_created_at,frequency,active')
      .eq('user_id', req.user.id).eq('active', true),
  ]);

  const realTxs   = (txs||[]).filter(t=>!t.transfer_id);
  const income    = realTxs.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0);
  const expense   = realTxs.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);

  // ── Gastos por categoria no mês ─────────────────────────────────────
  const spentByCat = {};
  realTxs.filter(t=>t.type==='expense').forEach(t=>{
    if (!t.category_id) return;
    if (!spentByCat[t.category_id]) spentByCat[t.category_id] = { spent:0, name:t.categories?.name||'Categoria' };
    spentByCat[t.category_id].spent += Number(t.amount);
  });

  // ── Regra 1 & 2: Tetos ──────────────────────────────────────────────
  for (const budget of (budgets||[])) {
    const cat   = spentByCat[budget.category_id];
    if (!cat) continue;
    const pct   = Math.round(cat.spent / budget.amount * 100);
    const name  = budget.categories?.name || cat.name;

    if (pct >= 100) {
      insights.push({
        priority: 9, type:'critical', icon:'🔴',
        title: `Teto estourado: ${name}`,
        body:  `Você gastou R$${cat.spent.toFixed(2)} de R$${Number(budget.amount).toFixed(2)} neste mês (${pct}%). Considere revisar seus gastos nesta categoria.`,
        action: { label:'Ver tetos', url:'/budgets' },
      });
    } else if (pct >= 80) {
      insights.push({
        priority: 6, type:'warning', icon:'🟡',
        title: `Atenção: ${name} em ${pct}%`,
        body:  `Você já usou ${pct}% do teto de ${name}. Restam R$${(budget.amount - cat.spent).toFixed(2)}.`,
        action: { label:'Ver tetos', url:'/budgets' },
      });
    }
  }

  // ── Regra 3: Dívidas vencidas / vencendo ────────────────────────────
  for (const debt of (debts||[])) {
    if (debt.done || debt.paid_installments >= debt.installments) continue;
    if (!debt.start_date || !debt.due_day) continue;

    const start = new Date(debt.start_date);
    const nextDue = new Date(start.getFullYear(), start.getMonth() + debt.paid_installments, debt.due_day);
    const diff    = Math.ceil((nextDue - today) / (1000*60*60*24));

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
  for (const card of (cards||[])) {
    if (!card.closing_day) continue;
    const closingDate = new Date(year, month-1, card.closing_day);
    const diff = Math.ceil((closingDate - today) / (1000*60*60*24));
    if (diff >= 0 && diff <= 3) {
      insights.push({
        priority: 8, type:'critical', icon:'💳',
        title: `Fatura ${card.name} fecha em ${diff===0?'hoje':`${diff} dia(s)`}`,
        body:  `A fatura do cartão ${card.name} fecha ${diff===0?'hoje':'dia '+card.closing_day}. Verifique os lançamentos pendentes.`,
        action: { label:'Ver cartões', url:'/credit-cards' },
      });
    }
  }

  // ── Regra 5: Saldo negativo ──────────────────────────────────────────
  if (income > 0 && expense > income) {
    const diff = expense - income;
    insights.push({
      priority: 5, type:'warning', icon:'📉',
      title: `Despesas superam receitas este mês`,
      body:  `Você gastou R$${diff.toFixed(2)} a mais do que recebeu. Revise suas despesas para fechar o mês no positivo.`,
      action: { label:'Ver dashboard', url:'/' },
    });
  }

  // ── Regra 6: Sem receita lançada ────────────────────────────────────
  if (income === 0 && expense > 0) {
    insights.push({
      priority: 1, type:'info', icon:'💡',
      title: `Nenhuma receita lançada em ${today.toLocaleString('pt-BR',{month:'long'})}`,
      body:  `Você tem R$${expense.toFixed(2)} em despesas mas nenhuma receita registrada. Lembre-se de lançar seus ganhos.`,
      action: { label:'Adicionar receita', url:'/' },
    });
  }

  // ── Regra 7: Recorrentes não geradas ────────────────────────────────
  const pendingRecurrings = (recurrings||[]).filter(r => {
    if (r.frequency !== 'monthly') return false;
    if (!r.last_created_at) return true;
    const last = new Date(r.last_created_at);
    return !(last.getMonth()+1 === month && last.getFullYear() === year);
  });
  if (pendingRecurrings.length > 0) {
    insights.push({
      priority: 4, type:'attention', icon:'🔄',
      title: `${pendingRecurrings.length} recorrente(s) pendente(s)`,
      body:  `${pendingRecurrings.slice(0,3).map(r=>r.description||'Sem nome').join(', ')}${pendingRecurrings.length>3?' e mais...':''} ainda não foram geradas este mês.`,
      action: { label:'Ver recorrentes', url:'/recurring' },
    });
  }

  // ── Regra 8: Meta quase concluída ───────────────────────────────────
  for (const goal of (goals||[])) {
    const pct = goal.target_amount > 0 ? Math.round(goal.current_amount/goal.target_amount*100) : 0;
    if (pct >= 90 && pct < 100) {
      const missing = Number(goal.target_amount) - Number(goal.current_amount);
      insights.push({
        priority: 3, type:'attention', icon:'🎯',
        title: `Meta "${goal.name}" quase concluída (${pct}%)`,
        body:  `Faltam apenas R$${missing.toFixed(2)} para concluir esta meta. Um último esforço!`,
        action: { label:'Ver metas', url:'/goals' },
      });
    }
  }

  // ── Regra 9: Categoria dominante ────────────────────────────────────
  if (expense > 0) {
    const topCat = Object.entries(spentByCat).sort((a,b)=>b[1].spent-a[1].spent)[0];
    if (topCat && topCat[1].spent / expense > 0.4) {
      const pct = Math.round(topCat[1].spent/expense*100);
      insights.push({
        priority: 2, type:'info', icon:'📊',
        title: `${topCat[1].name} representa ${pct}% das despesas`,
        body:  `Você gastou R$${topCat[1].spent.toFixed(2)} em ${topCat[1].name}, que é ${pct}% de todas as suas despesas do mês.`,
        action: { label:'Ver categorias', url:'/categories' },
      });
    }
  }

  // Ordena por prioridade decrescente
  insights.sort((a,b) => b.priority - a.priority);

  res.json(insights);
});

module.exports = router;
