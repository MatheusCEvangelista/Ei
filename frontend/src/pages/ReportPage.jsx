import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import api from '../lib/api';

const fmt     = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v);
const fmtDate = d => new Date(d+'T00:00:00').toLocaleDateString('pt-BR');
const MONTHS  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

export default function ReportPage() {
  const today = new Date();
  const [month,    setMonth]    = useState(today.getMonth()+1);
  const [year,     setYear]     = useState(today.getFullYear());
  const [loading,  setLoading]  = useState(false);
  const [preview,  setPreview]  = useState(null);
  const [options,  setOptions]  = useState({ transactions:true, categories:true, investments:true, debts:true });

  async function loadPreview() {
    setLoading(true);
    try {
      const [sumRes, txRes, invRes, debtRes] = await Promise.all([
        api.get(`/api/summary?month=${month}&year=${year}`),
        api.get(`/api/transactions?month=${month}&year=${year}`),
        api.get('/api/investments').catch(()=>({data:[]})),
        api.get('/api/debts').catch(()=>({data:[]})),
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

  useEffect(()=>{ loadPreview(); },[month,year]);

  async function generatePDF() {
    if (!preview) return;
    setLoading(true);

    try {
      const { default: jsPDF }    = await import('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
      const { default: autoTable } = await import('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js');

      const doc = new jsPDF.jsPDF({ unit:'mm', format:'a4' });
      const W = 210, marginL = 14, marginR = 14;
      const usableW = W - marginL - marginR;
      let y = 0;

      // ── Cores ──────────────────────────────────────────────────────────
      const C = {
        indigo: [100,103,247], green: [34,197,94], red: [239,68,68],
        gray: [107,114,128], lightGray: [243,244,246], darkGray: [31,41,55],
        amber: [245,158,11], white: [255,255,255],
      };

      // ── Cabeçalho ──────────────────────────────────────────────────────
      doc.setFillColor(...C.darkGray);
      doc.rect(0, 0, W, 36, 'F');
      doc.setFillColor(...C.indigo);
      doc.roundedRect(marginL, 8, 20, 20, 4, 4, 'F');
      doc.setFontSize(16); doc.setTextColor(...C.white);
      doc.text('💰', marginL+3.5, 22);
      doc.setFontSize(18); doc.setFont('helvetica','bold');
      doc.text('FinanceApp', marginL+24, 20);
      doc.setFontSize(10); doc.setFont('helvetica','normal');
      doc.setTextColor(200,200,200);
      doc.text('Relatório Financeiro', marginL+24, 27);
      doc.setFontSize(10); doc.setTextColor(...C.white);
      doc.text(`${MONTHS[month-1]} ${year}`, W-marginR, 20, { align:'right' });
      doc.setFontSize(9); doc.setTextColor(180,180,180);
      doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')}`, W-marginR, 27, { align:'right' });
      y = 46;

      // ── Cards de resumo ─────────────────────────────────────────────────
      const { income, expense, balance } = preview.summary;
      const savingRate = income>0?Math.round((income-expense)/income*100):0;
      const cardW = (usableW-9)/4;
      const cards = [
        { label:'Receitas',      value:fmt(income),   color:C.green  },
        { label:'Despesas',      value:fmt(expense),  color:C.red    },
        { label:'Saldo',         value:fmt(balance),  color:balance>=0?C.indigo:C.red },
        { label:'Taxa poupança', value:`${savingRate}%`, color:C.amber },
      ];
      cards.forEach((c,i)=>{
        const x = marginL + i*(cardW+3);
        doc.setFillColor(...C.lightGray);
        doc.roundedRect(x, y, cardW, 22, 3, 3, 'F');
        doc.setFillColor(...c.color);
        doc.rect(x, y, 2.5, 22, 'F');
        doc.setFontSize(8); doc.setTextColor(...C.gray); doc.setFont('helvetica','normal');
        doc.text(c.label.toUpperCase(), x+5, y+7);
        doc.setFontSize(11); doc.setTextColor(...C.darkGray); doc.setFont('helvetica','bold');
        doc.text(c.value, x+5, y+16);
      });
      y += 28;

      // ── Categorias ──────────────────────────────────────────────────────
      if (options.categories && preview.summary.byCategory?.length) {
        doc.setFontSize(13); doc.setFont('helvetica','bold'); doc.setTextColor(...C.darkGray);
        doc.text('Gastos por Categoria', marginL, y); y += 6;

        const catData = preview.summary.byCategory
          .sort((a,b)=>b.value-a.value)
          .map(c=>[ c.name, fmt(c.value), expense>0?`${Math.round(c.value/expense*100)}%`:'-' ]);

        autoTable(doc, {
          startY: y,
          head: [['Categoria','Valor','% do Total']],
          body: catData,
          styles: { fontSize:9, cellPadding:3 },
          headStyles: { fillColor:C.darkGray, textColor:C.white, fontStyle:'bold' },
          alternateRowStyles: { fillColor:C.lightGray },
          columnStyles: { 1:{ halign:'right', font:'courier' }, 2:{ halign:'center' } },
          margin: { left:marginL, right:marginR },
        });
        y = doc.lastAutoTable.finalY + 10;
      }

      // ── Transações ───────────────────────────────────────────────────────
      if (options.transactions && preview.transactions?.length) {
        if (y > 220) { doc.addPage(); y = 20; }
        doc.setFontSize(13); doc.setFont('helvetica','bold'); doc.setTextColor(...C.darkGray);
        doc.text('Transações do Mês', marginL, y); y += 6;
        doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(...C.gray);
        doc.text(`${preview.transactions.filter(t=>!t.transfer_id).length} transações (excluindo transferências)`, marginL, y); y += 4;

        const txData = preview.transactions
          .filter(t=>!t.transfer_id)
          .sort((a,b)=>new Date(b.date)-new Date(a.date))
          .map(t=>[ fmtDate(t.date), t.description||'-', t.categories?.name||'-', t.type==='income'?fmt(t.amount):'', t.type==='expense'?fmt(t.amount):'' ]);

        autoTable(doc, {
          startY: y,
          head: [['Data','Descrição','Categoria','Receita','Despesa']],
          body: txData,
          styles: { fontSize:8, cellPadding:2.5, overflow:'ellipsize' },
          headStyles: { fillColor:C.darkGray, textColor:C.white, fontStyle:'bold' },
          alternateRowStyles: { fillColor:C.lightGray },
          columnStyles: {
            0:{ cellWidth:22 },
            1:{ cellWidth:60 },
            2:{ cellWidth:30 },
            3:{ halign:'right', textColor:C.green, font:'courier' },
            4:{ halign:'right', textColor:C.red,   font:'courier' },
          },
          margin: { left:marginL, right:marginR },
        });
        y = doc.lastAutoTable.finalY + 10;
      }

      // ── Investimentos ────────────────────────────────────────────────────
      if (options.investments && preview.investments?.length) {
        if (y > 220) { doc.addPage(); y = 20; }
        doc.setFontSize(13); doc.setFont('helvetica','bold'); doc.setTextColor(...C.darkGray);
        doc.text('Carteira de Investimentos', marginL, y); y += 6;

        const TYPE_LABEL = { stocks:'Ações', fiis:'FIIs', crypto:'Cripto', fixed_income:'Renda Fixa', treasury:'Tesouro' };
        const invData = preview.investments.map(inv=>{
          const invested = ['fixed_income','treasury'].includes(inv.type)
            ? Number(inv.initial_amount||0)
            : Number(inv.quantity)*Number(inv.avg_price);
          const current  = Number(inv.calculated_current_value||invested);
          return [ inv.name, TYPE_LABEL[inv.type]||inv.type, fmt(invested), fmt(current), `${current>0&&invested>0?((current-invested)/invested*100).toFixed(1):0}%` ];
        });

        autoTable(doc, {
          startY: y,
          head: [['Nome','Tipo','Investido','Valor Atual','Retorno']],
          body: invData,
          styles: { fontSize:8, cellPadding:2.5 },
          headStyles: { fillColor:C.darkGray, textColor:C.white, fontStyle:'bold' },
          alternateRowStyles: { fillColor:C.lightGray },
          columnStyles: {
            2:{ halign:'right', font:'courier' },
            3:{ halign:'right', font:'courier' },
            4:{ halign:'center' },
          },
          margin: { left:marginL, right:marginR },
        });
        y = doc.lastAutoTable.finalY + 10;
      }

      // ── Dívidas ───────────────────────────────────────────────────────────
      if (options.debts && preview.debts?.filter(d=>!d.done).length) {
        if (y > 220) { doc.addPage(); y = 20; }
        doc.setFontSize(13); doc.setFont('helvetica','bold'); doc.setTextColor(...C.darkGray);
        doc.text('Dívidas em Aberto', marginL, y); y += 6;

        const debtData = preview.debts.filter(d=>!d.done).map(d=>[
          d.name,
          `${d.paid_installments}/${d.installments}`,
          fmt(d.installment_value),
          fmt(d.remaining),
          `${d.pct}%`,
        ]);

        autoTable(doc, {
          startY: y,
          head: [['Nome','Parcelas','Valor/Parcela','Restante','Progresso']],
          body: debtData,
          styles: { fontSize:8, cellPadding:2.5 },
          headStyles: { fillColor:C.darkGray, textColor:C.white, fontStyle:'bold' },
          alternateRowStyles: { fillColor:C.lightGray },
          columnStyles: {
            2:{ halign:'right', font:'courier' },
            3:{ halign:'right', font:'courier' },
            4:{ halign:'center' },
          },
          margin: { left:marginL, right:marginR },
        });
        y = doc.lastAutoTable.finalY + 10;
      }

      // ── Rodapé em todas as páginas ─────────────────────────────────────
      const totalPages = doc.getNumberOfPages();
      for (let i=1; i<=totalPages; i++) {
        doc.setPage(i);
        doc.setFillColor(...C.lightGray);
        doc.rect(0, 285, W, 12, 'F');
        doc.setFontSize(8); doc.setTextColor(...C.gray); doc.setFont('helvetica','normal');
        doc.text('FinanceApp — Relatório gerado automaticamente', marginL, 292);
        doc.text(`Página ${i} de ${totalPages}`, W-marginR, 292, { align:'right' });
      }

      doc.save(`relatorio-${MONTHS[month-1].toLowerCase()}-${year}.pdf`);
    } catch(err) {
      console.error(err);
      alert('Erro ao gerar PDF. Tente novamente.');
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

        {/* Seletor de período */}
        <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:14,padding:'20px',marginBottom:16}}>
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

        {/* Opções de conteúdo */}
        <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:14,padding:'20px',marginBottom:16}}>
          <p style={{fontSize:12,color:'var(--text3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:14}}>Incluir no relatório</p>
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            {[
              ['categories',   'Gastos por categoria', `${preview?.summary?.byCategory?.length||0} categorias`],
              ['transactions', 'Lista de transações',  `${preview?.transactions?.filter(t=>!t.transfer_id).length||0} transações`],
              ['investments',  'Carteira de investimentos', `${preview?.investments?.length||0} ativos`],
              ['debts',        'Dívidas em aberto',    `${preview?.debts?.filter(d=>!d.done).length||0} dívidas`],
            ].map(([key,label,count])=>(
              <label key={key} style={{display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer',padding:'10px 12px',borderRadius:9,background:'var(--bg3)',border:`1px solid ${options[key]?'var(--indigo)':'var(--border)'}`,transition:'border 0.15s'}}>
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

        {/* Preview do resumo */}
        {s && (
          <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:14,padding:'20px',marginBottom:20}}>
            <p style={{fontSize:12,color:'var(--text3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:14}}>Preview — {MONTHS[month-1]} {year}</p>
            <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:10}} className="grid-2col">
              {[
                {label:'Receitas',      value:fmt(s.income),                                         color:'var(--green)'},
                {label:'Despesas',      value:fmt(s.expense),                                        color:'var(--red)'},
                {label:'Saldo',         value:fmt(s.balance),                                        color:s.balance>=0?'var(--indigo)':'var(--red)'},
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

        {/* Botão gerar */}
        <button onClick={generatePDF} disabled={loading||!preview}
          style={{width:'100%',padding:'16px',borderRadius:12,border:'none',fontSize:15,fontWeight:600,cursor:'pointer',fontFamily:'var(--font)',background:loading?'var(--bg3)':'linear-gradient(135deg,var(--indigo),#a78bfa)',color:loading?'var(--text3)':'#fff',transition:'all 0.2s',boxShadow:loading?'none':'0 4px 20px rgba(124,127,247,0.3)'}}>
          {loading ? '⏳ Gerando...' : '⬇️ Gerar e baixar PDF'}
        </button>

        <p style={{fontSize:11,color:'var(--text3)',textAlign:'center',marginTop:10}}>
          O PDF será gerado localmente no seu dispositivo — nenhum dado é enviado para terceiros.
        </p>
      </main>
    </div>
  );
}
