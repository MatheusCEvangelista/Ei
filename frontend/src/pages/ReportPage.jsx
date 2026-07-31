import { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Navbar from '../components/Navbar';
import api from '../lib/api';

const fmt     = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v);
const fmtDate = d => new Date(d+'T00:00:00').toLocaleDateString('pt-BR');
const MONTHS  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

export default function ReportPage() {
  const today = new Date();
  const [month,   setMonth]   = useState(today.getMonth()+1);
  const [year,    setYear]    = useState(today.getFullYear());
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [options, setOptions] = useState({ categories:true, transactions:true, investments:true, debts:true });

  async function loadPreview() {
    setLoading(true);
    try {
      const [sumRes, txRes, invRes, debtRes] = await Promise.all([
        api.get(`/api/summary?month=${month}&year=${year}`),
        api.get(`/api/transactions?month=${month}&year=${year}`),
        api.get('/api/investments').catch(()=>({ data:[] })),
        api.get('/api/debts').catch(()=>({ data:[] })),
      ]);
      setPreview({
        summary:      sumRes.data,
        transactions: txRes.data,
        investments:  invRes.data,
        debts:        debtRes.data,
      });
    } catch(e){ console.error(e); }
    setLoading(false);
  }

  useEffect(()=>{ loadPreview(); },[month, year]);

  function generatePDF() {
    if (!preview) return;
    setLoading(true);

    try {
      const doc    = new jsPDF({ unit:'mm', format:'a4' });
      const W      = 210;
      const mL     = 14;
      const mR     = 14;
      let y        = 0;

      // Paleta
      const DARK   = [31,  41,  55];
      const INDIGO = [100, 103, 247];
      const GREEN  = [34,  197, 94];
      const RED    = [239, 68,  68];
      const GRAY   = [107, 114, 128];
      const LGRAY  = [243, 244, 246];
      const AMBER  = [245, 158, 11];
      const WHITE  = [255, 255, 255];

      // ── Cabeçalho ──────────────────────────────────────────────────
      doc.setFillColor(...DARK);
      doc.rect(0, 0, W, 36, 'F');

      doc.setFillColor(...INDIGO);
      doc.roundedRect(mL, 8, 20, 20, 4, 4, 'F');

      doc.setFontSize(18); doc.setTextColor(...WHITE); doc.setFont('helvetica','bold');
      doc.text('FinanceApp', mL+24, 20);

      doc.setFontSize(10); doc.setFont('helvetica','normal');
      doc.setTextColor(200,200,200);
      doc.text('Relatório Financeiro', mL+24, 27);

      doc.setTextColor(...WHITE);
      doc.text(`${MONTHS[month-1]} ${year}`, W-mR, 20, { align:'right' });
      doc.setTextColor(180,180,180);
      doc.setFontSize(9);
      doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')}`, W-mR, 27, { align:'right' });

      y = 46;

      // ── Cards de resumo ────────────────────────────────────────────
      const { income=0, expense=0, balance=0 } = preview.summary || {};
      const savingRate = income>0 ? Math.round((income-expense)/income*100) : 0;
      const cardW = (W - mL - mR - 9) / 4;

      [
        { label:'Receitas',      value:fmt(income),      color:GREEN  },
        { label:'Despesas',      value:fmt(expense),     color:RED    },
        { label:'Saldo',         value:fmt(balance),     color:balance>=0?INDIGO:RED },
        { label:'Taxa poupança', value:`${savingRate}%`, color:AMBER  },
      ].forEach((c,i) => {
        const x = mL + i*(cardW+3);
        doc.setFillColor(...LGRAY);
        doc.roundedRect(x, y, cardW, 22, 3, 3, 'F');
        doc.setFillColor(...c.color);
        doc.rect(x, y, 3, 22, 'F');
        doc.setFontSize(7.5); doc.setTextColor(...GRAY); doc.setFont('helvetica','normal');
        doc.text(c.label.toUpperCase(), x+5.5, y+7);
        doc.setFontSize(10); doc.setTextColor(...DARK); doc.setFont('helvetica','bold');
        doc.text(c.value, x+5.5, y+16);
      });

      y += 30;

      // ── Categorias ─────────────────────────────────────────────────
      if (options.categories && preview.summary?.byCategory?.length) {
        doc.setFontSize(13); doc.setFont('helvetica','bold'); doc.setTextColor(...DARK);
        doc.text('Gastos por Categoria', mL, y);
        y += 4;

        autoTable(doc, {
          startY: y,
          head: [['Categoria','Valor','% do Total']],
          body: [...preview.summary.byCategory]
            .sort((a,b)=>b.value-a.value)
            .map(c=>[c.name, fmt(c.value), expense>0?`${Math.round(c.value/expense*100)}%`:'-']),
          styles:            { fontSize:9, cellPadding:3 },
          headStyles:        { fillColor:DARK, textColor:WHITE, fontStyle:'bold' },
          alternateRowStyles:{ fillColor:LGRAY },
          columnStyles:      { 1:{ halign:'right' }, 2:{ halign:'center' } },
          margin:            { left:mL, right:mR },
        });
        y = doc.lastAutoTable.finalY + 10;
      }

      // ── Transações ─────────────────────────────────────────────────
      if (options.transactions && preview.transactions?.length) {
        if (y > 220) { doc.addPage(); y = 20; }
        doc.setFontSize(13); doc.setFont('helvetica','bold'); doc.setTextColor(...DARK);
        doc.text('Transações do Mês', mL, y);
        y += 4;

        const txList = preview.transactions
          .filter(t=>!t.transfer_id)
          .sort((a,b)=>new Date(b.date)-new Date(a.date));

        autoTable(doc, {
          startY: y,
          head: [['Data','Descrição','Categoria','Receita','Despesa']],
          body: txList.map(t=>[
            fmtDate(t.date),
            t.description || '-',
            t.categories?.name || '-',
            t.type==='income'  ? fmt(t.amount) : '',
            t.type==='expense' ? fmt(t.amount) : '',
          ]),
          styles:            { fontSize:8, cellPadding:2.5, overflow:'ellipsize' },
          headStyles:        { fillColor:DARK, textColor:WHITE, fontStyle:'bold' },
          alternateRowStyles:{ fillColor:LGRAY },
          columnStyles: {
            0:{ cellWidth:22 },
            1:{ cellWidth:62 },
            2:{ cellWidth:32 },
            3:{ halign:'right', textColor:GREEN },
            4:{ halign:'right', textColor:RED },
          },
          margin: { left:mL, right:mR },
        });
        y = doc.lastAutoTable.finalY + 10;
      }

      // ── Investimentos ──────────────────────────────────────────────
      if (options.investments && preview.investments?.length) {
        if (y > 220) { doc.addPage(); y = 20; }
        doc.setFontSize(13); doc.setFont('helvetica','bold'); doc.setTextColor(...DARK);
        doc.text('Carteira de Investimentos', mL, y);
        y += 4;

        const TYPE_LABEL = { stocks:'Ações', fiis:'FIIs', crypto:'Cripto', fixed_income:'Renda Fixa', treasury:'Tesouro' };

        autoTable(doc, {
          startY: y,
          head: [['Nome','Tipo','Investido','Valor Atual','Retorno']],
          body: preview.investments.map(inv => {
            const invested = ['fixed_income','treasury'].includes(inv.type)
              ? Number(inv.initial_amount||0)
              : Number(inv.quantity||0)*Number(inv.avg_price||0);
            const current  = Number(inv.calculated_current_value||invested);
            const retPct   = invested>0 ? ((current-invested)/invested*100).toFixed(1) : '0.0';
            return [ inv.name, TYPE_LABEL[inv.type]||inv.type, fmt(invested), fmt(current), `${retPct}%` ];
          }),
          styles:            { fontSize:8, cellPadding:2.5 },
          headStyles:        { fillColor:DARK, textColor:WHITE, fontStyle:'bold' },
          alternateRowStyles:{ fillColor:LGRAY },
          columnStyles: {
            2:{ halign:'right' },
            3:{ halign:'right' },
            4:{ halign:'center' },
          },
          margin: { left:mL, right:mR },
        });
        y = doc.lastAutoTable.finalY + 10;
      }

      // ── Dívidas ────────────────────────────────────────────────────
      const activeDebts = (preview.debts||[]).filter(d=>!d.done);
      if (options.debts && activeDebts.length) {
        if (y > 220) { doc.addPage(); y = 20; }
        doc.setFontSize(13); doc.setFont('helvetica','bold'); doc.setTextColor(...DARK);
        doc.text('Dívidas em Aberto', mL, y);
        y += 4;

        autoTable(doc, {
          startY: y,
          head: [['Nome','Parcelas','Valor/Parcela','Restante','Progresso']],
          body: activeDebts.map(d=>[
            d.name,
            `${d.paid_installments}/${d.installments}`,
            fmt(d.installment_value),
            fmt(d.remaining||0),
            `${d.pct||0}%`,
          ]),
          styles:            { fontSize:8, cellPadding:2.5 },
          headStyles:        { fillColor:DARK, textColor:WHITE, fontStyle:'bold' },
          alternateRowStyles:{ fillColor:LGRAY },
          columnStyles: {
            2:{ halign:'right' },
            3:{ halign:'right' },
            4:{ halign:'center' },
          },
          margin: { left:mL, right:mR },
        });
      }

      // ── Rodapé ─────────────────────────────────────────────────────
      const total = doc.getNumberOfPages();
      for (let p=1; p<=total; p++) {
        doc.setPage(p);
        doc.setFillColor(...LGRAY);
        doc.rect(0, 285, W, 12, 'F');
        doc.setFontSize(8); doc.setTextColor(...GRAY); doc.setFont('helvetica','normal');
        doc.text('FinanceApp — Relatório gerado automaticamente', mL, 292);
        doc.text(`Página ${p} de ${total}`, W-mR, 292, { align:'right' });
      }

      doc.save(`relatorio-${MONTHS[month-1].toLowerCase()}-${year}.pdf`);
    } catch(err) {
      console.error('Erro ao gerar PDF:', err);
      alert(`Erro ao gerar PDF: ${err.message}`);
    }

    setLoading(false);
  }

  const s = preview?.summary;

  return (
    <div style={{minHeight:'100vh',background:'var(--bg)'}}>
      <Navbar/>
      <main className="page-main" style={{maxWidth:700,margin:'0 auto',padding:'24px 16px 80px'}}>

        <div style={{marginBottom:28}}>
          <h1 style={{fontSize:20,fontWeight:600,letterSpacing:'-0.03em'}}>Relatório em PDF</h1>
          <p style={{color:'var(--text3)',fontSize:13,marginTop:4}}>Gere um resumo financeiro completo do período</p>
        </div>

        {/* Período */}
        <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:14,padding:'20px',marginBottom:14}}>
          <p style={{fontSize:12,color:'var(--text3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:14}}>Período</p>
          <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
            <select value={month} onChange={e=>setMonth(Number(e.target.value))}
              style={{flex:1,minWidth:140,padding:'10px 14px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:8,color:'var(--text)'}}>
              {MONTHS.map((m,i)=><option key={i} value={i+1}>{m}</option>)}
            </select>
            <select value={year} onChange={e=>setYear(Number(e.target.value))}
              style={{flex:1,minWidth:100,padding:'10px 14px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:8,color:'var(--text)'}}>
              {[2023,2024,2025,2026,2027].map(y=><option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {/* Opções */}
        <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:14,padding:'20px',marginBottom:14}}>
          <p style={{fontSize:12,color:'var(--text3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:14}}>Incluir no relatório</p>
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {[
              ['categories',   '📊 Gastos por categoria',      `${preview?.summary?.byCategory?.length||0} categorias`],
              ['transactions', '📋 Lista de transações',       `${(preview?.transactions||[]).filter(t=>!t.transfer_id).length} transações`],
              ['investments',  '📈 Carteira de investimentos', `${preview?.investments?.length||0} ativos`],
              ['debts',        '💳 Dívidas em aberto',         `${(preview?.debts||[]).filter(d=>!d.done).length} dívidas`],
            ].map(([key,label,count])=>(
              <label key={key} style={{display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer',padding:'10px 14px',borderRadius:9,background:'var(--bg3)',border:`1px solid ${options[key]?'var(--indigo)':'var(--border)'}`,transition:'border 0.15s'}}>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <input type="checkbox" checked={options[key]} onChange={e=>setOptions({...options,[key]:e.target.checked})}
                    style={{width:16,height:16,accentColor:'var(--indigo)',cursor:'pointer'}}/>
                  <span style={{fontSize:13,color:'var(--text)',fontWeight:500}}>{label}</span>
                </div>
                <span style={{fontSize:11,color:'var(--text3)',background:'var(--bg2)',borderRadius:5,padding:'2px 8px'}}>{count}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Preview */}
        {s && (
          <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:14,padding:'20px',marginBottom:20}}>
            <p style={{fontSize:12,color:'var(--text3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:14}}>
              Preview — {MONTHS[month-1]} {year}
            </p>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}} className="grid-2col">
              {[
                {label:'Receitas',      value:fmt(s.income||0),      color:'var(--green)'},
                {label:'Despesas',      value:fmt(s.expense||0),     color:'var(--red)'},
                {label:'Saldo',         value:fmt(s.balance||0),     color:(s.balance||0)>=0?'var(--indigo)':'var(--red)'},
                {label:'Taxa poupança', value:`${s.income>0?Math.round((s.income-s.expense)/s.income*100):0}%`, color:'var(--amber)'},
              ].map(c=>(
                <div key={c.label} style={{background:'var(--bg3)',borderRadius:10,padding:'12px 14px',borderLeft:`3px solid ${c.color}`}}>
                  <p style={{fontSize:11,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:4}}>{c.label}</p>
                  <p style={{fontFamily:'var(--mono)',fontSize:15,fontWeight:600,color:c.color}}>{c.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <button onClick={generatePDF} disabled={loading||!preview}
          style={{width:'100%',padding:'16px',borderRadius:12,border:'none',fontSize:15,fontWeight:600,cursor:loading||!preview?'not-allowed':'pointer',fontFamily:'var(--font)',background:loading?'var(--bg3)':'linear-gradient(135deg,var(--indigo),#a78bfa)',color:loading?'var(--text3)':'#fff',transition:'all 0.2s',boxShadow:loading?'none':'0 4px 20px rgba(124,127,247,0.3)'}}>
          {loading ? '⏳ Aguarde...' : '⬇️ Gerar e baixar PDF'}
        </button>

        <p style={{fontSize:11,color:'var(--text3)',textAlign:'center',marginTop:10}}>
          O PDF é gerado localmente — nenhum dado é enviado para terceiros.
        </p>
      </main>
    </div>
  );
}
