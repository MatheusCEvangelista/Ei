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

const fmt     = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);
const fmtPct  = v => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
const monthName = () => new Date().toLocaleString('pt-BR',{month:'long'});

function getCurrentPeriod() {
  const today = new Date();
  const month = today.getMonth() + 1;
  const year  = today.getFullYear();
  return {
    today, month, year,
    start: `${year}-${String(month).padStart(2,'0')}-01`,
    end:   new Date(year, month, 0).toISOString().split('T')[0],
    daysLeft: new Date(year, month, 0).getDate() - today.getDate(),
    daysTotal: new Date(year, month, 0).getDate(),
  };
}

// ── Perguntas disponíveis ─────────────────────────────────────────────────
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

// ── Estado do Leon ────────────────────────────────────────────────────────
router.get('/state', async (req, res) => {
  const supabase = db(req.token);
  const { start, end, today } = getCurrentPeriod();

  const [txs, budgets, debts] = await Promise.all([
    safeQuery(supabase.from('transactions').select('amount,type,category_id,transfer_id').eq('user_id',req.user.id).gte('date',start).lte('date',end)),
    safeQuery(supabase.from('budgets').select('amount,category_id').eq('user_id',req.user.id)),
    safeQuery(supabase.from('debts').select('paid_installments,installments,due_day,start_date').eq('user_id',req.user.id)),
  ]);

  const real    = txs.filter(t=>!t.transfer_id);
  const income  = real.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0);
  const expense = real.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);

  const byCat = {};
  real.filter(t=>t.type==='expense'&&t.category_id).forEach(t=>{ byCat[t.category_id]=(byCat[t.category_id]||0)+Number(t.amount); });

  const budgetExceeded = budgets.some(b=>(byCat[b.category_id]||0)>=Number(b.amount));
  const hasOverdue     = debts.some(d=>{
    if(d.paid_installments>=d.installments||!d.start_date||!d.due_day) return false;
    const dt=new Date(d.start_date);
    dt.setMonth(dt.getMonth()+d.paid_installments); dt.setDate(d.due_day);
    return dt<today;
  });

  let state = 'happy';
  if (hasOverdue||(income>0&&expense>income)||budgetExceeded) state='stressed';
  else if (income===0&&expense===0) state='curious';
  else if (income>0&&expense/income>0.7) state='curious';

  res.json({ state });
});

// ── Resposta de cada pergunta (100% rule-based) ───────────────────────────
router.post('/ask', async (req, res) => {
  const { question_id } = req.body;
  const supabase = db(req.token);
  const { start, end, daysLeft, daysTotal, today, month, year } = getCurrentPeriod();

  try {
    let answer = '';

    // ── 1. Finanças do mês ───────────────────────────────────────────
    if (question_id === 'finances') {
      const txs  = await safeQuery(supabase.from('transactions').select('amount,type,transfer_id').eq('user_id',req.user.id).gte('date',start).lte('date',end));
      const real = txs.filter(t=>!t.transfer_id);
      const income  = real.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0);
      const expense = real.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);
      const balance = income - expense;
      const rate    = income>0 ? Math.round((income-expense)/income*100) : 0;

      if (income===0 && expense===0) {
        answer = `Ainda não há movimentações em ${monthName()} 🦎 Que tal lançar suas primeiras transações para eu poder te ajudar melhor?`;
      } else if (balance >= 0) {
        answer = `Em ${monthName()} você recebeu ${fmt(income)} e gastou ${fmt(expense)}, sobrando ${fmt(balance)} 💚 Sua taxa de poupança é de ${rate}% — ${rate>=20?'ótimo resultado!':rate>=10?'bom trabalho!':'ainda há espaço para melhorar.'}`;
      } else {
        answer = `Em ${monthName()} você recebeu ${fmt(income)} mas gastou ${fmt(expense)}, ficando ${fmt(Math.abs(balance))} no negativo 😬 Ainda restam ${daysLeft} dias — tente segurar os gastos.`;
      }
    }

    // ── 2. Maiores gastos ────────────────────────────────────────────
    else if (question_id === 'spending') {
      const txs  = await safeQuery(supabase.from('transactions').select('amount,type,transfer_id,categories(name)').eq('user_id',req.user.id).gte('date',start).lte('date',end));
      const real = txs.filter(t=>!t.transfer_id&&t.type==='expense');
      const total = real.reduce((s,t)=>s+Number(t.amount),0);

      if (!real.length) {
        answer = `Nenhuma despesa registrada em ${monthName()} ainda 🦎`;
      } else {
        const byCat = {};
        real.forEach(t=>{ const n=t.categories?.name||'Sem categoria'; byCat[n]=(byCat[n]||0)+Number(t.amount); });
        const top = Object.entries(byCat).sort((a,b)=>b[1]-a[1]).slice(0,3);
        const list = top.map(([name,val],i)=>`${i+1}º ${name}: ${fmt(val)} (${Math.round(val/total*100)}%)`).join(' • ');
        answer = `Seus maiores gastos em ${monthName()}: ${list}. Total de despesas: ${fmt(total)} 📊`;
      }
    }

    // ── 3. Alertas ───────────────────────────────────────────────────
    else if (question_id === 'alerts') {
      const [txs, budgets, debts, cards] = await Promise.all([
        safeQuery(supabase.from('transactions').select('amount,type,category_id,transfer_id').eq('user_id',req.user.id).gte('date',start).lte('date',end)),
        safeQuery(supabase.from('budgets').select('amount,category_id,categories(name)').eq('user_id',req.user.id)),
        safeQuery(supabase.from('debts').select('name,paid_installments,installments,installment_value,due_day,start_date').eq('user_id',req.user.id)),
        safeQuery(supabase.from('credit_cards').select('name,closing_day').eq('user_id',req.user.id)),
      ]);

      const real = txs.filter(t=>!t.transfer_id);
      const byCat = {};
      real.filter(t=>t.type==='expense'&&t.category_id).forEach(t=>{ byCat[t.category_id]=(byCat[t.category_id]||0)+Number(t.amount); });

      const alertas = [];

      // Tetos
      budgets.forEach(b=>{
        const spent = byCat[b.category_id]||0;
        const pct   = b.amount>0?Math.round(spent/b.amount*100):0;
        if (pct>=100) alertas.push(`🔴 Teto de ${b.categories?.name} estourado (${pct}%)`);
        else if (pct>=80) alertas.push(`🟡 ${b.categories?.name} em ${pct}% do teto`);
      });

      // Dívidas vencidas/vencendo
      debts.filter(d=>d.paid_installments<d.installments).forEach(d=>{
        if(!d.start_date||!d.due_day) return;
        const dt=new Date(d.start_date);
        dt.setMonth(dt.getMonth()+d.paid_installments); dt.setDate(d.due_day);
        const diff=Math.ceil((dt-today)/(1000*60*60*24));
        if (diff<0)     alertas.push(`🔴 Parcela de ${d.name} vencida há ${Math.abs(diff)} dia(s)`);
        else if(diff<=5) alertas.push(`⚠️ Parcela de ${d.name} vence em ${diff} dia(s) — ${fmt(d.installment_value)}`);
      });

      // Cartões fechando
      cards.forEach(c=>{
        if(!c.closing_day) return;
        const dt=new Date(year,month-1,c.closing_day);
        const diff=Math.ceil((dt-today)/(1000*60*60*24));
        if(diff>=0&&diff<=3) alertas.push(`💳 Fatura ${c.name} fecha em ${diff===0?'hoje':`${diff} dia(s)`}`);
      });

      answer = alertas.length
        ? `Encontrei ${alertas.length} ponto(s) de atenção:\n${alertas.join('\n')}`
        : `Tudo tranquilo por aqui! 😎 Nenhum alerta crítico no momento. Continue assim!`;
    }

    // ── 4. Metas ─────────────────────────────────────────────────────
    else if (question_id === 'goals') {
      const goals = await safeQuery(supabase.from('goals').select('name,current_amount,target_amount').eq('user_id',req.user.id));

      if (!goals.length) {
        answer = `Você ainda não tem metas cadastradas 🎯 Que tal criar uma? Metas ajudam muito a focar nos seus objetivos!`;
      } else {
        const sorted = [...goals].sort((a,b)=>(b.current_amount/b.target_amount)-(a.current_amount/a.target_amount));
        const list = sorted.map(g=>{
          const pct=g.target_amount>0?Math.round(g.current_amount/g.target_amount*100):0;
          const bar='█'.repeat(Math.round(pct/10))+'░'.repeat(10-Math.round(pct/10));
          return `${g.name}: ${bar} ${pct}% (${fmt(g.current_amount)} de ${fmt(g.target_amount)})`;
        }).join('\n');
        const nearest = sorted[0];
        const nearPct = nearest.target_amount>0?Math.round(nearest.current_amount/nearest.target_amount*100):0;
        answer = `Suas metas em ${monthName()}:\n${list}\n\n${nearPct>=90?`🎉 "${nearest.name}" está quase lá — faltam apenas ${fmt(nearest.target_amount-nearest.current_amount)}!`:`A mais avançada é "${nearest.name}" com ${nearPct}%.`}`;
      }
    }

    // ── 5. Quanto posso gastar ───────────────────────────────────────
    else if (question_id === 'budget') {
      const [txs, budgets] = await Promise.all([
        safeQuery(supabase.from('transactions').select('amount,type,category_id,transfer_id').eq('user_id',req.user.id).gte('date',start).lte('date',end)),
        safeQuery(supabase.from('budgets').select('amount,category_id,categories(name)').eq('user_id',req.user.id)),
      ]);

      const real    = txs.filter(t=>!t.transfer_id);
      const income  = real.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0);
      const expense = real.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);
      const balance = income - expense;
      const perDay  = daysLeft>0 ? balance/daysLeft : 0;

      const byCat = {};
      real.filter(t=>t.type==='expense'&&t.category_id).forEach(t=>{ byCat[t.category_id]=(byCat[t.category_id]||0)+Number(t.amount); });

      const budgetLines = budgets.map(b=>{
        const spent     = byCat[b.category_id]||0;
        const remaining = Math.max(0, Number(b.amount)-spent);
        return `  • ${b.categories?.name}: ${fmt(remaining)} restantes`;
      });

      if (balance<=0) {
        answer = `Atenção! Você já gastou mais do que recebeu em ${monthName()} 😬 Saldo atual: ${fmt(balance)}. Evite novas despesas não essenciais nos próximos ${daysLeft} dias.`;
      } else {
        answer = `Você ainda tem ${fmt(balance)} disponível em ${monthName()} 💚 Isso dá aproximadamente ${fmt(perDay)}/dia pelos próximos ${daysLeft} dias.${budgetLines.length?'\n\nPor categoria:\n'+budgetLines.join('\n'):''}`;
      }
    }

    // ── 6. Investimentos ─────────────────────────────────────────────
    else if (question_id === 'investments') {
      const invs = await safeQuery(supabase.from('investments').select('name,type,quantity,avg_price,initial_amount,calculated_current_value').eq('user_id',req.user.id));

      if (!invs.length) {
        answer = `Você ainda não tem investimentos cadastrados 📈 Que tal começar a registrar sua carteira? Até a renda fixa conta!`;
      } else {
        const totalInvested = invs.reduce((s,i)=>{
          return s+(['fixed_income','treasury'].includes(i.type)?Number(i.initial_amount||0):Number(i.quantity||0)*Number(i.avg_price||0));
        },0);
        const totalCurrent = invs.reduce((s,i)=>{
          const curr=['fixed_income','treasury'].includes(i.type)?Number(i.calculated_current_value||i.initial_amount||0):Number(i.quantity||0)*Number(i.avg_price||0);
          return s+curr;
        },0);
        const gain    = totalCurrent-totalInvested;
        const gainPct = totalInvested>0?(gain/totalInvested*100):0;

        const byType = {};
        invs.forEach(i=>{ byType[i.type]=(byType[i.type]||0)+1; });
        const typeMap = {stocks:'Ações',fiis:'FIIs',crypto:'Cripto',fixed_income:'Renda Fixa',treasury:'Tesouro'};
        const typeSummary = Object.entries(byType).map(([t,n])=>`${typeMap[t]||t}(${n})`).join(', ');

        answer = `Sua carteira tem ${invs.length} ativo(s): ${typeSummary} 📈\nInvestido: ${fmt(totalInvested)} • Valor atual: ${fmt(totalCurrent)}\nRendimento: ${fmt(gain)} (${fmtPct(gainPct)})${gain>=0?' 💚':' 😬'}`;
      }
    }

    // ── 7. Dívidas/parcelas ──────────────────────────────────────────
    else if (question_id === 'debts') {
      const debts = await safeQuery(supabase.from('debts').select('name,paid_installments,installments,installment_value,due_day,start_date').eq('user_id',req.user.id));
      const active = debts.filter(d=>d.paid_installments<d.installments);

      if (!active.length) {
        answer = `Nenhuma dívida ativa no momento! 🎉 Você está completamente livre de parcelamentos. Ótimo trabalho!`;
      } else {
        const withDays = active.map(d=>{
          if(!d.start_date||!d.due_day) return { ...d, diff:null };
          const dt=new Date(d.start_date);
          dt.setMonth(dt.getMonth()+d.paid_installments); dt.setDate(d.due_day);
          return { ...d, diff:Math.ceil((dt-today)/(1000*60*60*24)) };
        }).sort((a,b)=>(a.diff??999)-(b.diff??999));

        const list = withDays.map(d=>{
          const status = d.diff===null?'':d.diff<0?` ⚠️ VENCIDA há ${Math.abs(d.diff)}d`:d.diff<=5?` ⚠️ vence em ${d.diff}d`:` • vence em ${d.diff}d`;
          return `${d.name}: parcela ${d.paid_installments+1}/${d.installments} — ${fmt(d.installment_value)}${status}`;
        }).join('\n');

        const overdue = withDays.filter(d=>d.diff!==null&&d.diff<0).length;
        const soon    = withDays.filter(d=>d.diff!==null&&d.diff>=0&&d.diff<=5).length;

        answer = `Você tem ${active.length} dívida(s) ativa(s):\n${list}${overdue?`\n\n🔴 ${overdue} parcela(s) vencida(s) — pague o quanto antes!`:soon?`\n\n⚠️ ${soon} parcela(s) vencendo nos próximos 5 dias!`:''}`;
      }
    }

    else {
      answer = `Hmm, não reconheci essa pergunta 🦎 Tente uma das opções abaixo!`;
    }

    res.json({ answer });

  } catch (err) {
    console.error('Leon error:', err);
    res.status(500).json({ error: 'Não consegui buscar os dados agora. Tente novamente!' });
  }
});

module.exports = router;
