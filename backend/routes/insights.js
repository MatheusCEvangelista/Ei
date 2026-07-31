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

// Seed determinístico pelo dia — garante os mesmos 2 insights o dia inteiro
function dailySeed() {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth()+1) * 100 + d.getDate();
}

function seededPick(arr, seed, n) {
  if (!arr.length) return [];
  const a = [...arr];
  let s = seed;
  for (let i = a.length-1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) | 0;
    const j = Math.abs(s) % (i+1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

router.get('/', async (req, res) => {
  const supabase  = db(req.token);
  const today     = new Date();
  const month     = today.getMonth() + 1;
  const year      = today.getFullYear();
  const dayOfMonth = today.getDate();
  const daysTotal = new Date(year, month, 0).getDate();
  const start     = `${year}-${String(month).padStart(2,'0')}-01`;
  const end       = new Date(year, month, 0).toISOString().split('T')[0];

  // Mês anterior
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear  = month === 1 ? year - 1 : year;
  const prevStart = `${prevYear}-${String(prevMonth).padStart(2,'0')}-01`;
  const prevEnd   = new Date(prevYear, prevMonth, 0).toISOString().split('T')[0];

  // Busca tudo de uma vez
  const [txs, prevTxs, budgets, debts, cards, investments, recurrings] = await Promise.all([
    safeQuery(supabase.from('transactions').select('amount,type,category_id,description,categories(name),transfer_id').eq('user_id',req.user.id).gte('date',start).lte('date',end)),
    safeQuery(supabase.from('transactions').select('amount,type,category_id,description,categories(name),transfer_id').eq('user_id',req.user.id).gte('date',prevStart).lte('date',prevEnd)),
    safeQuery(supabase.from('budgets').select('amount,category_id,categories(name)').eq('user_id',req.user.id)),
    safeQuery(supabase.from('debts').select('name,paid_installments,installments,installment_value,due_day,start_date').eq('user_id',req.user.id)),
    safeQuery(supabase.from('credit_cards').select('id,name,closing_day').eq('user_id',req.user.id)),
    safeQuery(supabase.from('investments').select('type,initial_amount,quantity,avg_price,calculated_current_value').eq('user_id',req.user.id)),
    safeQuery(supabase.from('recurring_transactions').select('amount,type,description,active').eq('user_id',req.user.id).eq('active',true)),
  ]);

  const real      = txs.filter(t=>!t.transfer_id);
  const prevReal  = prevTxs.filter(t=>!t.transfer_id);
  const income    = real.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0);
  const expense   = real.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);
  const prevIncome= prevReal.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0);

  // Gastos por categoria (mês atual e anterior)
  const byCat     = {};
  const prevByCat = {};
  real.filter(t=>t.type==='expense').forEach(t=>{
    const name = t.categories?.name||'Sem categoria';
    const id   = t.category_id||'sem';
    if(!byCat[id]) byCat[id]={name,total:0};
    byCat[id].total += Number(t.amount);
  });
  prevReal.filter(t=>t.type==='expense').forEach(t=>{
    const id=t.category_id||'sem';
    if(!prevByCat[id]) prevByCat[id]={total:0};
    prevByCat[id].total += Number(t.amount);
  });

  // Fatura dos cartões no mês
  let cardInvoiceTotal = 0;
  for (const card of cards) {
    const cardTxs = await safeQuery(
      supabase.from('transactions').select('amount').eq('user_id',req.user.id).eq('credit_card_id',card.id).gte('date',start).lte('date',end)
    );
    cardInvoiceTotal += cardTxs.reduce((s,t)=>s+Number(t.amount),0);
  }

  // Pool de todos os insights possíveis
  const pool = [];    // insights normais (rotativos)
  const urgent = [];  // insights críticos (sempre mostram)

  // ── 1. REGRA 50/30/20 ────────────────────────────────────────────────
  // Simplificado: verifica se despesas > 80% da receita (sem classificar categorias)
  if (income > 0 && expense/income > 0.8) {
    const pct = Math.round(expense/income*100);
    pool.push({
      icon:'⚖️',
      title:'Seus gastos estão altos este mês',
      body:`Você já usou ${pct}% da sua renda em despesas. A regra 50/30/20 sugere que o ideal é manter abaixo de 80%. Ainda dá tempo de equilibrar!`,
      action:{ label:'Ver projeção', url:'/projections' },
    });
  }

  // ── 2. RITMO DE GASTOS (projeção por categoria) ──────────────────────
  if (dayOfMonth >= 10) {
    for (const budget of budgets) {
      const spent = byCat[budget.category_id]?.total || 0;
      const limit = Number(budget.amount);
      if (limit <= 0 || spent <= 0) continue;
      const pctDay   = dayOfMonth / daysTotal;
      const pctSpent = spent / limit;
      // Ritmo muito acima do esperado para o dia do mês
      if (pctSpent > pctDay * 1.5 && pctSpent < 1.0) {
        const projDay = Math.floor((spent / dayOfMonth) * daysTotal);
        const estDay  = Math.min(daysTotal, Math.floor(limit / (spent / dayOfMonth)));
        const name    = budget.categories?.name || byCat[budget.category_id]?.name || 'categoria';
        pool.push({
          icon:'📈',
          title:`No ritmo atual, ${name} vai estourar cedo`,
          body:`Você já gastou ${Math.round(pctSpent*100)}% do limite de ${name} e o mês mal começou. Se continuar assim, o orçamento acaba por volta do dia ${estDay}.`,
          action:{ label:'Ver tetos', url:'/budgets' },
        });
        break; // Um insight desse tipo por dia é suficiente
      }
    }
  }

  // ── 3. PERTO DO LIMITE (80% ou 90%) ─────────────────────────────────
  for (const budget of budgets) {
    const spent = byCat[budget.category_id]?.total || 0;
    const limit = Number(budget.amount);
    const pct   = limit > 0 ? Math.round(spent/limit*100) : 0;
    const name  = budget.categories?.name || 'categoria';
    const left  = Math.max(0, limit - spent);

    if (pct >= 90 && pct < 100) {
      urgent.push({
        icon:'🚨',
        title:`Quase no limite de ${name}`,
        body:`Restam apenas ${fmt(left)} no seu orçamento de ${name}. Considere segurar os próximos gastos nessa categoria.`,
        action:{ label:'Ver tetos', url:'/budgets' },
      });
    } else if (pct >= 80 && pct < 90) {
      pool.push({
        icon:'⚠️',
        title:`${name} chegando perto do limite`,
        body:`Você usou ${pct}% do orçamento de ${name} este mês. Ainda tem ${fmt(left)} — mas vale ficar de olho.`,
        action:{ label:'Ver tetos', url:'/budgets' },
      });
    }
  }

  // ── 4. COMPROMETIMENTO DE RENDA COM CARTÃO ───────────────────────────
  if (income > 0 && cardInvoiceTotal > 0) {
    const pct = Math.round(cardInvoiceTotal / income * 100);
    if (pct > 30) {
      pool.push({
        icon:'💳',
        title:'Seu cartão está pesando no orçamento',
        body:`Sua fatura já compromete ${pct}% da sua renda mensal. Especialistas recomendam manter abaixo de 30% pra não apertar no fim do mês.`,
        action:{ label:'Ver cartões', url:'/credit-cards' },
      });
    }
  }

  // ── 5. RISCO DE SALDO NEGATIVO ───────────────────────────────────────
  if (income > 0 && dayOfMonth <= 25) {
    const fixedMonthly = recurrings.filter(r=>r.type==='expense'&&r.frequency==='monthly').reduce((s,r)=>s+Number(r.amount),0);
    const balance      = income - expense;
    if (fixedMonthly > 0 && balance < fixedMonthly && balance > 0) {
      urgent.push({
        icon:'🔴',
        title:'Saldo pode não cobrir seus fixos',
        body:`Seu saldo atual (${fmt(balance)}) é menor que o total de recorrentes fixas (${fmt(fixedMonthly)}). Cuidado para não ficar no negativo!`,
        action:{ label:'Ver recorrentes', url:'/recurring' },
      });
    }
  }

  // ── 6. PICO DE GASTOS (spike vs média 3 meses) ───────────────────────
  // Busca média dos últimos 3 meses para categorias com pico
  const prevMonths = [0,1,2].map(i => {
    const d = new Date(year, month-1-i-1, 1);
    return { month: d.getMonth()+1, year: d.getFullYear() };
  });

  // Calcula média dos últimos 3 meses por categoria (usa prevByCat como proxy do mês anterior)
  // Para simplicidade, compara com o mês anterior x2 como estimativa de 3 meses
  for (const [catId, cat] of Object.entries(byCat)) {
    const prev = prevByCat[catId]?.total || 0;
    if (prev <= 0 || cat.total <= 0) continue;
    const ratio = cat.total / prev;
    if (ratio >= 1.5 && cat.total > 100) { // >50% maior que mês anterior
      const pctMore = Math.round((ratio-1)*100);
      pool.push({
        icon:'📊',
        title:`Gasto em ${cat.name} subiu muito`,
        body:`Você está gastando ${pctMore}% a mais em ${cat.name} comparado ao mês passado. Vale entender o que mudou?`,
        action:{ label:'Ver dashboard', url:'/' },
      });
      break;
    }
  }

  // ── 7. EFEITO CAFÉZINHO (microgastos) ────────────────────────────────
  const microTxs   = real.filter(t=>t.type==='expense'&&Number(t.amount)<=25);
  const microTotal = microTxs.reduce((s,t)=>s+Number(t.amount),0);
  if (microTxs.length >= 8 && microTotal >= 100) {
    pool.push({
      icon:'☕',
      title:'Os pequenos gastos estão somando',
      body:`Você fez ${microTxs.length} compras de até R$25 este mês, que juntas somam ${fmt(microTotal)}. Pequenos valores somados fazem grande diferença!`,
      action:{ label:'Ver transações', url:'/' },
    });
  }

  // ── 8. AUMENTO DE ASSINATURA/RECORRENTE ──────────────────────────────
  // Compara gastos recorrentes com descrições similares entre meses
  for (const rec of recurrings.filter(r=>r.type==='expense')) {
    const currSpend = real.filter(t=>t.type==='expense'&&t.description&&rec.description&&
      t.description.toLowerCase().includes(rec.description.toLowerCase().slice(0,6))).reduce((s,t)=>s+Number(t.amount),0);
    const prevSpend = prevReal.filter(t=>t.type==='expense'&&t.description&&rec.description&&
      t.description.toLowerCase().includes(rec.description.toLowerCase().slice(0,6))).reduce((s,t)=>s+Number(t.amount),0);
    if (prevSpend > 0 && currSpend > prevSpend * 1.05) {
      const diff = currSpend - prevSpend;
      pool.push({
        icon:'🔔',
        title:`${rec.description} ficou mais caro`,
        body:`Esse gasto veio ${fmt(diff)} mais alto que o mês passado. Pode ser reajuste ou uma cobrança extra — vale conferir.`,
        action:{ label:'Ver recorrentes', url:'/recurring' },
      });
      break;
    }
  }

  // ── 9. RESERVA DE EMERGÊNCIA ─────────────────────────────────────────
  const invTotal = investments.reduce((s,i)=>{
    return s+(['fixed_income','treasury'].includes(i.type)
      ?Number(i.calculated_current_value||i.initial_amount||0)
      :Number(i.quantity||0)*Number(i.avg_price||0));
  },0);
  if (invTotal > 0 && expense > 0) {
    const months = invTotal / Math.max(expense, 1);
    if (months < 6) {
      pool.push({
        icon:'🛡️',
        title:'Sua reserva de emergência merece atenção',
        body:`Com o ritmo atual de gastos, sua reserva cobre ${months.toFixed(1)} meses. O ideal é ter pelo menos 6 meses guardados pra dormir tranquilo.`,
        action:{ label:'Ver investimentos', url:'/investments' },
      });
    } else if (months >= 6) {
      pool.push({
        icon:'🏆',
        title:'Reserva de emergência sólida!',
        body:`Sua reserva cobre ${months.toFixed(1)} meses dos seus gastos. Você está bem protegido — que tal começar a diversificar os investimentos?`,
        action:{ label:'Ver investimentos', url:'/investments' },
      });
    }
  }

  // ── 10. SOBRA DE CAIXA (oportunidade) ───────────────────────────────
  if (daysTotal - dayOfMonth <= 7 && income > 0) {
    const balance = income - expense;
    const fixedLeft = recurrings.filter(r=>r.type==='expense'&&r.frequency==='monthly').reduce((s,r)=>s+Number(r.amount),0);
    const free = balance - fixedLeft;
    if (free > 200) {
      pool.push({
        icon:'🎉',
        title:'Você vai fechar o mês no positivo!',
        body:`Faltam ${daysTotal-dayOfMonth} dias e você tem ${fmt(free)} livres após os fixos. Que tal guardar uma parte na sua reserva ou investir?`,
        action:{ label:'Ver metas', url:'/goals' },
      });
    }
  }

  // ── Seleção diária: 1 urgente (se houver) + 1 da pool rotativa ──────
  const seed     = dailySeed();
  const result   = [];

  // Críticos sempre aparecem (máx 1)
  if (urgent.length > 0) {
    const picked = seededPick(urgent, seed, 1);
    result.push(...picked);
  }

  // Completa até 2 com insights da pool (rotativo pelo dia)
  const remaining = 2 - result.length;
  if (pool.length > 0 && remaining > 0) {
    const picked = seededPick(pool, seed + 1, remaining);
    result.push(...picked);
  }

  res.json(result);
});

module.exports = router;
