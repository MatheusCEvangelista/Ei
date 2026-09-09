// AnnualExport — exporta os dados da visão anual como CSV ou PDF simples
// Uso: <AnnualExport data={data} year={year}/>

const fmt = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);

function exportCSV(data, year) {
  const rows = [
    ['Mês','Receitas','Despesas','Saldo','Acumulado'],
    ...data.months.map(m => [
      m.label,
      m.income.toFixed(2),
      m.expense.toFixed(2),
      m.balance.toFixed(2),
      m.accumulated.toFixed(2),
    ]),
    ['TOTAL', data.total_income.toFixed(2), data.total_expense.toFixed(2), data.total_balance.toFixed(2), ''],
  ];

  const csv = rows.map(r => r.map(c => `"${c}"`).join(';')).join('\n');
  const bom  = '\uFEFF'; // BOM para Excel reconhecer UTF-8
  const blob = new Blob([bom + csv], { type:'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `ei-visao-anual-${year}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportPDF(data, year) {
  const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  const rows = data.months.map(m => `
    <tr style="border-bottom:1px solid #e2e8f0;${m.income===0&&m.expense===0?'opacity:0.4':''}">
      <td style="padding:8px 12px;font-weight:500;">${m.label}</td>
      <td style="padding:8px 12px;text-align:right;color:#22c55e;font-family:monospace;">${m.income>0?fmt(m.income):'—'}</td>
      <td style="padding:8px 12px;text-align:right;color:#ef4444;font-family:monospace;">${m.expense>0?fmt(m.expense):'—'}</td>
      <td style="padding:8px 12px;text-align:right;font-family:monospace;font-weight:600;color:${m.balance>=0?'#7c3aed':'#ef4444'};">${m.income>0||m.expense>0?fmt(m.balance):'—'}</td>
      <td style="padding:8px 12px;text-align:right;font-family:monospace;color:${m.accumulated>=0?'#374151':'#ef4444'};">${m.income>0||m.expense>0?fmt(m.accumulated):'—'}</td>
    </tr>
  `).join('');

  const catRows = data.by_category.slice(0,10).map(c => `
    <tr style="border-bottom:1px solid #f1f5f9;">
      <td style="padding:6px 12px;display:flex;align-items:center;gap:8px;">
        <span style="width:8px;height:8px;border-radius:50%;background:${c.color};display:inline-block;"></span>
        ${c.name}
      </td>
      <td style="padding:6px 12px;text-align:right;color:#ef4444;font-family:monospace;">${fmt(c.total)}</td>
      <td style="padding:6px 12px;text-align:right;color:#6b7280;">${c.pct}%</td>
    </tr>
  `).join('');

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Visão Anual ${year} — Ei!</title>
  <style>
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827;margin:0;padding:24px;}
    h1{font-size:22px;font-weight:700;margin-bottom:4px;}
    .subtitle{color:#6b7280;font-size:13px;margin-bottom:24px;}
    .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px;}
    .card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;}
    .card-label{font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#9ca3af;margin-bottom:4px;}
    .card-value{font-family:monospace;font-size:18px;font-weight:700;}
    table{width:100%;border-collapse:collapse;font-size:13px;}
    th{background:#f1f5f9;padding:8px 12px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;}
    th:first-child{text-align:left;}
    .section{margin-bottom:28px;}
    .section-title{font-size:14px;font-weight:600;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #7c3aed;color:#7c3aed;}
    @media print{body{padding:0;}}
  </style>
</head>
<body>
  <h1>Visão Anual ${year}</h1>
  <p class="subtitle">Gerado em ${new Date().toLocaleDateString('pt-BR')} • Ei! Finanças</p>

  <div class="grid">
    <div class="card"><div class="card-label">Receitas</div><div class="card-value" style="color:#22c55e;">${fmt(data.total_income)}</div></div>
    <div class="card"><div class="card-label">Despesas</div><div class="card-value" style="color:#ef4444;">${fmt(data.total_expense)}</div></div>
    <div class="card"><div class="card-label">Saldo</div><div class="card-value" style="color:${data.total_balance>=0?'#7c3aed':'#ef4444'};">${fmt(data.total_balance)}</div></div>
    <div class="card"><div class="card-label">Taxa poupança</div><div class="card-value" style="color:${data.saving_rate>=20?'#22c55e':'#f5a623'};">${data.saving_rate}%</div></div>
  </div>

  <div class="section">
    <div class="section-title">Resumo mensal</div>
    <table>
      <thead><tr>
        <th style="text-align:left;">Mês</th>
        <th>Receitas</th><th>Despesas</th><th>Saldo</th><th>Acumulado</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>

  ${data.by_category.length > 0 ? `
  <div class="section">
    <div class="section-title">Gastos por categoria</div>
    <table>
      <thead><tr>
        <th style="text-align:left;">Categoria</th><th>Total</th><th>%</th>
      </tr></thead>
      <tbody>${catRows}</tbody>
    </table>
  </div>` : ''}
</body>
</html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 500);
}

export default function AnnualExport({ data, year }) {
  if (!data) return null;

  return (
    <div style={{display:'flex',gap:'var(--space-2)'}}>
      <button onClick={()=>exportCSV(data,year)}
        style={{padding:'6px 12px',borderRadius:'var(--radius-sm)',border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text2)',fontSize:'var(--text-xs)',fontWeight:'var(--font-medium)',cursor:'pointer',fontFamily:'var(--font)',transition:'all var(--transition)',display:'flex',alignItems:'center',gap:5,whiteSpace:'nowrap'}}
        onMouseOver={e=>{e.currentTarget.style.borderColor='var(--green)';e.currentTarget.style.color='var(--green)';}}
        onMouseOut={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.color='var(--text2)';}}>
        📥 CSV
      </button>
      <button onClick={()=>exportPDF(data,year)}
        style={{padding:'6px 12px',borderRadius:'var(--radius-sm)',border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text2)',fontSize:'var(--text-xs)',fontWeight:'var(--font-medium)',cursor:'pointer',fontFamily:'var(--font)',transition:'all var(--transition)',display:'flex',alignItems:'center',gap:5,whiteSpace:'nowrap'}}
        onMouseOver={e=>{e.currentTarget.style.borderColor='var(--red)';e.currentTarget.style.color='var(--red)';}}
        onMouseOut={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.color='var(--text2)';}}>
        🖨️ PDF
      </button>
    </div>
  );
}
