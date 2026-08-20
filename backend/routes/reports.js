const express = require('express');
const router  = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { Resend }       = require('resend');
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

// ── Coleta dados do mês para o relatório ──────────────────────────────────
async function getMonthData(supabase, userId, month, year) {
  const start = `${year}-${String(month).padStart(2,'0')}-01`;
  const end   = new Date(year, month, 0).toISOString().split('T')[0];

  const [txs, goals, budgets] = await Promise.all([
    safeQuery(supabase.from('transactions').select('amount,type,category_id,description,categories(name,color),transfer_id').eq('user_id',userId).gte('date',start).lte('date',end)),
    safeQuery(supabase.from('goals').select('name,current_amount,target_amount').eq('user_id',userId)),
    safeQuery(supabase.from('budgets').select('amount,category_id,categories(name)').eq('user_id',userId)),
  ]);

  const real    = txs.filter(t=>!t.transfer_id);
  const income  = real.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0);
  const expense = real.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);
  const balance = income - expense;
  const savingRate = income > 0 ? Math.round((income-expense)/income*100) : 0;

  const byCat = {};
  real.filter(t=>t.type==='expense').forEach(t => {
    const name  = t.categories?.name || 'Sem categoria';
    const color = t.categories?.color || '#6b7280';
    if (!byCat[name]) byCat[name] = { total:0, color };
    byCat[name].total += Number(t.amount);
  });
  const topCats = Object.entries(byCat)
    .sort((a,b)=>b[1].total-a[1].total).slice(0,5)
    .map(([name,{total,color}])=>({ name, total: Math.round(total*100)/100, color, pct: expense>0?Math.round(total/expense*100):0 }));

  // Tetos: quais foram respeitados e quais estouraram
  const budgetStatus = budgets.map(b => {
    const spent = byCat[b.categories?.name]?.total || 0;
    const pct   = b.amount>0?Math.round(spent/b.amount*100):0;
    return { name: b.categories?.name, spent, limit: Number(b.amount), pct, ok: pct <= 100 };
  });

  return { income, expense, balance, savingRate, topCats, budgetStatus, goals, txCount: real.length };
}

// ── Template HTML do e-mail ───────────────────────────────────────────────
function buildEmailHTML({ data, month, year, userName }) {
  const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const monthName   = MONTH_NAMES[month-1];
  const balanceColor = data.balance >= 0 ? '#22c55e' : '#ef4444';
  const statusEmoji  = data.savingRate >= 20 ? '😎' : data.savingRate >= 0 ? '🦎' : '😬';

  const topCatRows = data.topCats.map(c => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;">
        <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${c.color};margin-right:8px;vertical-align:middle;"></span>
        <span style="font-size:13px;color:#374151;">${c.name}</span>
      </td>
      <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;text-align:right;font-family:monospace;font-size:13px;color:#ef4444;">${fmt(c.total)}</td>
      <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;text-align:right;font-size:12px;color:#9ca3af;">${c.pct}%</td>
    </tr>
  `).join('');

  const budgetRows = data.budgetStatus.map(b => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:13px;color:#374151;">${b.name}</td>
      <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;text-align:center;">
        <span style="background:${b.ok?'#dcfce7':'#fee2e2'};color:${b.ok?'#16a34a':'#dc2626'};padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;">
          ${b.pct}% ${b.ok?'✓':'⚠️'}
        </span>
      </td>
      <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;text-align:right;font-family:monospace;font-size:12px;color:#6b7280;">${fmt(b.spent)} / ${fmt(b.limit)}</td>
    </tr>
  `).join('');

  const goalRows = data.goals.map(g => {
    const pct = g.target_amount > 0 ? Math.min(100, Math.round(g.current_amount/g.target_amount*100)) : 0;
    return `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:13px;color:#374151;">${g.name}</td>
      <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;">
        <div style="background:#f1f5f9;border-radius:99px;height:6px;overflow:hidden;">
          <div style="background:${pct>=100?'#22c55e':'#7c3aed'};height:100%;width:${pct}%;border-radius:99px;"></div>
        </div>
      </td>
      <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;text-align:right;font-family:monospace;font-size:12px;color:#6b7280;">${pct}%</td>
    </tr>
  `}).join('');

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Relatório ${monthName} ${year} — Ei!</title></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px;">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#7c3aed,#a78bfa);border-radius:16px;padding:32px;text-align:center;margin-bottom:20px;">
      <div style="font-size:48px;margin-bottom:8px;">${statusEmoji}</div>
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">Relatório de ${monthName}</h1>
      <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">Olá, ${userName}! Aqui está seu resumo de ${monthName} ${year}.</p>
    </div>

    <!-- Cards de resumo -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
      <div style="background:#fff;border-radius:12px;padding:16px;border:1px solid #e2e8f0;">
        <p style="margin:0 0 4px;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;">Receitas</p>
        <p style="margin:0;font-family:monospace;font-size:18px;font-weight:700;color:#22c55e;">${fmt(data.income)}</p>
      </div>
      <div style="background:#fff;border-radius:12px;padding:16px;border:1px solid #e2e8f0;">
        <p style="margin:0 0 4px;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;">Despesas</p>
        <p style="margin:0;font-family:monospace;font-size:18px;font-weight:700;color:#ef4444;">${fmt(data.expense)}</p>
      </div>
      <div style="background:#fff;border-radius:12px;padding:16px;border:1px solid #e2e8f0;">
        <p style="margin:0 0 4px;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;">Saldo</p>
        <p style="margin:0;font-family:monospace;font-size:18px;font-weight:700;color:${balanceColor};">${fmt(data.balance)}</p>
      </div>
      <div style="background:#fff;border-radius:12px;padding:16px;border:1px solid #e2e8f0;">
        <p style="margin:0 0 4px;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;">Poupança</p>
        <p style="margin:0;font-family:monospace;font-size:18px;font-weight:700;color:${data.savingRate>=20?'#22c55e':data.savingRate>=0?'#7c3aed':'#ef4444'};">${data.savingRate}%</p>
      </div>
    </div>

    <!-- Top categorias -->
    ${data.topCats.length > 0 ? `
    <div style="background:#fff;border-radius:12px;padding:20px;margin-bottom:16px;border:1px solid #e2e8f0;">
      <h2 style="margin:0 0 16px;font-size:14px;font-weight:600;color:#111827;">📊 Maiores gastos</h2>
      <table style="width:100%;border-collapse:collapse;">
        <tbody>${topCatRows}</tbody>
      </table>
    </div>` : ''}

    <!-- Tetos -->
    ${data.budgetStatus.length > 0 ? `
    <div style="background:#fff;border-radius:12px;padding:20px;margin-bottom:16px;border:1px solid #e2e8f0;">
      <h2 style="margin:0 0 16px;font-size:14px;font-weight:600;color:#111827;">💰 Tetos de gastos</h2>
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr>
          <th style="text-align:left;font-size:11px;color:#9ca3af;font-weight:600;padding-bottom:8px;text-transform:uppercase;letter-spacing:0.05em;">Categoria</th>
          <th style="text-align:center;font-size:11px;color:#9ca3af;font-weight:600;padding-bottom:8px;text-transform:uppercase;">Status</th>
          <th style="text-align:right;font-size:11px;color:#9ca3af;font-weight:600;padding-bottom:8px;text-transform:uppercase;">Uso</th>
        </tr></thead>
        <tbody>${budgetRows}</tbody>
      </table>
    </div>` : ''}

    <!-- Metas -->
    ${data.goals.length > 0 ? `
    <div style="background:#fff;border-radius:12px;padding:20px;margin-bottom:16px;border:1px solid #e2e8f0;">
      <h2 style="margin:0 0 16px;font-size:14px;font-weight:600;color:#111827;">🎯 Progresso das metas</h2>
      <table style="width:100%;border-collapse:collapse;">
        <tbody>${goalRows}</tbody>
      </table>
    </div>` : ''}

    <!-- CTA -->
    <div style="text-align:center;margin:24px 0;">
      <a href="${process.env.FRONTEND_URL||'https://ei-financas.vercel.app'}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#a78bfa);color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-size:14px;font-weight:600;">
        Ver detalhes no app →
      </a>
    </div>

    <!-- Footer -->
    <p style="text-align:center;font-size:12px;color:#9ca3af;margin-top:24px;">
      Ei! Finanças • Relatório gerado automaticamente<br>
      ${data.txCount} transações registradas em ${monthName} ${year}
    </p>
  </div>
</body>
</html>`;
}

// ── Envia relatório para o usuário autenticado ────────────────────────────
router.post('/send-monthly', async (req, res) => {
  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM || 'Leon <onboarding@resend.dev>';
  if (!resendKey) return res.status(500).json({ error: 'RESEND_API_KEY não configurada' });

  const resend  = new Resend(resendKey);
  const supabase = db(req.token);

  // Mês anterior
  const today    = new Date();
  const month    = today.getMonth() === 0 ? 12 : today.getMonth();
  const year     = today.getMonth() === 0 ? today.getFullYear()-1 : today.getFullYear();

  // Busca e-mail do usuário
  const { data: userInfo } = await supabase.auth.getUser();
  const userEmail = userInfo?.user?.email;
  const userName  = userInfo?.user?.user_metadata?.name || userEmail?.split('@')[0] || 'usuário';

  if (!userEmail) return res.status(400).json({ error: 'E-mail do usuário não encontrado' });

  try {
    const data = await getMonthData(supabase, req.user.id, month, year);
    const html = buildEmailHTML({ data, month, year, userName });

    const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

    const result = await resend.emails.send({
      from:    fromEmail,
      to:      userEmail,
      subject: `🦎 Seu relatório de ${MONTH_NAMES[month-1]} ${year} — Ei! Finanças`,
      html,
    });

    res.json({ message: 'E-mail enviado com sucesso!', email: userEmail, id: result.id });
  } catch(err) {
    console.error('Resend error:', err);
    res.status(500).json({ error: 'Erro ao enviar e-mail: ' + (err.message||'desconhecido') });
  }
});

// ── Preview do relatório (retorna HTML sem enviar) ────────────────────────
router.get('/preview', async (req, res) => {
  const supabase = db(req.token);
  const today    = new Date();
  const month    = today.getMonth() === 0 ? 12 : today.getMonth();
  const year     = today.getMonth() === 0 ? today.getFullYear()-1 : today.getFullYear();
  const { data: userInfo } = await supabase.auth.getUser();
  const userName = userInfo?.user?.user_metadata?.name || 'usuário';

  const data = await getMonthData(supabase, req.user.id, month, year);
  const html = buildEmailHTML({ data, month, year, userName });
  res.setHeader('Content-Type','text/html');
  res.send(html);
});

module.exports = router;
