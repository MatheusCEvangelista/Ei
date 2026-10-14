import { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Navbar from '../components/Navbar';
import api from '../lib/api';

const fmt     = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v);
const fmtCompact = v => {
  if (Math.abs(v)>=1000) return (v/1000).toFixed(1)+'k';
  return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(v);
};
const MONTHS  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

// ── Gráfico de barras puro (SVG) ────────────────────────────────────────────
function BarChart({ months }) {
  if (!months?.length) return null;
  const last6 = months.slice(-6);
  const maxVal = Math.max(...last6.map(m => Math.max(m.income||0, m.expense||0)), 1);
  const W = 100, BAR_W = 30, GAP = (W - last6.length * BAR_W) / (last6.length + 1);
  const H = 120, PAD_TOP = 12, PAD_BOT = 32;
  const chartH = H - PAD_TOP - PAD_BOT;

  return (
    <div style={{overflowX:'auto',marginBottom:'var(--space-4)'}}>
      <svg viewBox={`0 0 ${W * last6.length + GAP * (last6.length+1)} ${H}`}
        style={{width:'100%',minWidth:320,display:'block'}}>
        {last6.map((m, i) => {
          const x       = GAP + i * (BAR_W + GAP);
          const incH    = (m.income||0) / maxVal * chartH;
          const expH    = (m.expense||0) / maxVal * chartH;
          const incY    = PAD_TOP + chartH - incH;
          const expY    = PAD_TOP + chartH - expH;
          const barW4   = BAR_W / 2 - 1;
          const isGood  = (m.balance||0) >= 0;
          return (
            <g key={m.month}>
              {/* Receita */}
              <rect x={x} y={incY} width={barW4} height={incH} rx="2"
                fill="var(--green)" opacity="0.85"/>
              {/* Despesa */}
              <rect x={x + barW4 + 2} y={expY} width={barW4} height={expH} rx="2"
                fill="var(--red)" opacity="0.85"/>
              {/* Label mês */}
              <text x={x + barW4} y={H - 18}
                textAnchor="middle" fontSize="7" fill="var(--text3)">
                {m.label?.slice(0,3)||''}
              </text>
              {/* Balanço */}
              <text x={x + barW4} y={H - 8}
                textAnchor="middle" fontSize="6.5"
                fill={isGood ? 'var(--green)' : 'var(--red)'}>
                {fmtCompact(m.balance||0)}
              </text>
            </g>
          );
        })}
        {/* Linha de zero */}
        <line x1={GAP} y1={PAD_TOP + chartH} x2="100%" y2={PAD_TOP + chartH}
          stroke="var(--border)" strokeWidth="0.5"/>
      </svg>
      {/* Legenda */}
      <div style={{display:'flex',gap:16,justifyContent:'center',marginTop:4}}>
        <span style={{fontSize:11,display:'flex',alignItems:'center',gap:4,color:'var(--text3)'}}>
          <span style={{width:10,height:10,borderRadius:2,background:'var(--green)',display:'inline-block'}}/>Receitas
        </span>
        <span style={{fontSize:11,display:'flex',alignItems:'center',gap:4,color:'var(--text3)'}}>
          <span style={{width:10,height:10,borderRadius:2,background:'var(--red)',display:'inline-block'}}/>Despesas
        </span>
      </div>
    </div>
  );
}

export default function ReportPage() {
  const today = new Date();
  const [month,    setMonth]    = useState(today.getMonth()+1);
  const [year,     setYear]     = useState(today.getFullYear());
  const [loading,  setLoading]  = useState(false);
  const [preview,  setPreview]  = useState(null);
  const [annual,   setAnnual]   = useState(null);
  const [options,  setOptions]  = useState({ categories:true, transactions:true, investments:true, debts:true });

  async function loadPreview() {
    setLoading(true);
    try {
      const [sumRes, txRes, invRes, debtRes, annualRes] = await Promise.all([
        api.get(`/api/summary?month=${month}&year=${year}`),
        api.get(`/api/transactions?month=${month}&year=${year}`),
        api.get('/api/investments').catch(()=>({ data:[] })),
        api.get('/api/debts').catch(()=>({ data:[] })),
        api.get(`/api/annual?year=${year}`).catch(()=>({ data:null })),
      ]);
      setPreview({
        summary:      sumRes.data,
        transactions: txRes.data,
        investments:  invRes.data,
        debts:        debtRes.data,
      });
      setAnnual(annualRes.data);
    } catch(e){ console.error(e); }
    setLoading(false);
  }

  useEffect(()=>{ loadPreview(); },[month, year]);

  function generatePDF() {
    if (!preview) return;
    setLoading(true);
    try {
      const doc    = new jsPDF({ unit:'mm', format:'a4' });
      const W      = 210, mL = 14, mR = 14;
      let y        = 0;
      const DARK   = [31,  41,  55];
      const INDIGO = [100, 103, 247];
      const GREEN  = [34,  197, 94];
      const RED    = [239, 68,  68];
      const GRAY   = [107, 114, 128];
      const LGRAY  = [243, 244, 246];
      const AMBER  = [245, 158, 11];
      const WHITE  = [255, 255, 255];

      doc.setFillColor(...DARK);
      doc.rect(0, 0, W, 36, 'F');
      doc.setFillColor(...INDIGO);
      doc.roundedRect(mL, 8, 20, 20, 4, 4, 'F');
      doc.setFontSize(18); doc.setTextColor(...WHITE); doc.setFont('helvetica','bold');
      doc.text('Ei!', mL+4, 21);
      doc.setFontSize(16); doc.text('Ei! Finanças', mL+24, 20);
      doc.setFontSize(10); doc.setFont('helvetica','normal');
      doc.setTextColor(200,200,200);
      doc.text('Relatório Financeiro', mL+24, 27);
      doc.setTextColor(...WHITE);
      doc.text(`${MONTHS[month-1]} ${year}`, W-mR, 20, { align:'right' });
      doc.setTextColor(180,180,180); doc.setFontSize(9);
      doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')}`, W-mR, 27, { align:'right' });
      y = 46;

      const { income=0, expense=0, balance=0 } = preview.summary || {};
      const savingRate = income>0 ? Math.round((income-expense)/income*100) : 0;
      const cardW = (W - mL - mR - 9) / 4;
      [{label:'Receitas',value:fmt(income),color:GREEN},{label:'Despesas',value:fmt(expense),color:RED},{label:'Saldo',value:fmt(balance),color:balance>=0?INDIGO:RED},{label:'Taxa poupança',value:`${savingRate}%`,color:AMBER}]
        .forEach((c,i)=>{
          const x=mL+i*(cardW+3);
          doc.setFillColor(...LGRAY); doc.roundedRect(x,y,cardW,22,3,3,'F');
          doc.setFillColor(...c.color); doc.rect(x,y,3,22,'F');
          doc.setFontSize(7.5); doc.setTextColor(...GRAY); doc.setFont('helvetica','normal');
          doc.text(c.label.toUpperCase(),x+5.5,y+7);
          doc.setFontSize(10); doc.setTextColor(...DARK); doc.setFont('helvetica','bold');
          doc.text(c.value,x+5.5,y+16);
        });
      y+=30;

      if (options.categories && preview.summary?.byCategory?.length) {
        doc.setFontSize(13); doc.setFont('helvetica','bold'); doc.setTextColor(...DARK);
        doc.text('Gastos por Categoria',mL,y); y+=4;
        autoTable(doc,{startY:y,head:[['Categoria','Valor','% do Total']],body:[...preview.summary.byCategory].sort((a,b)=>b.value-a.value).map(c=>[c.name,fmt(c.value),expense>0?`${Math.round(c.value/expense*100)}%`:'-']),styles:{fontSize:9,cellPadding:3},headStyles:{fillColor:DARK,textColor:WHITE,fontStyle:'bold'},alternateRowStyles:{fillColor:LGRAY},columnStyles:{1:{halign:'right'},2:{halign:'center'}},margin:{left:mL,right:mR}});
        y=doc.lastAutoTable.finalY+10;
      }

      if (options.transactions && preview.transactions?.length) {
        if(y>220){doc.addPage();y=20;}
        doc.setFontSize(13); doc.setFont('helvetica','bold'); doc.setTextColor(...DARK);
        doc.text('Transações do Mês',mL,y); y+=4;
        const txList=preview.transactions.filter(t=>!t.transfer_id).sort((a,b)=>new Date(b.date)-new Date(a.date));
        autoTable(doc,{startY:y,head:[['Data','Descrição','Categoria','Receita','Despesa']],body:txList.map(t=>[new Date(t.date+'T00:00:00').toLocaleDateString('pt-BR'),t.description||'-',t.categories?.name||'-',t.type==='income'?fmt(t.amount):'',t.type==='expense'?fmt(t.amount):'']),styles:{fontSize:8,cellPadding:2.5,overflow:'ellipsize'},headStyles:{fillColor:DARK,textColor:WHITE,fontStyle:'bold'},alternateRowStyles:{fillColor:LGRAY},columnStyles:{0:{cellWidth:22},1:{cellWidth:62},2:{cellWidth:32},3:{halign:'right',textColor:GREEN},4:{halign:'right',textColor:RED}},margin:{left:mL,right:mR}});
        y=doc.lastAutoTable.finalY+10;
      }

      if (options.investments && preview.investments?.length) {
        if(y>220){doc.addPage();y=20;}
        doc.setFontSize(13); doc.setFont('helvetica','bold'); doc.setTextColor(...DARK);
        doc.text('Carteira de Investimentos',mL,y); y+=4;
        const TYPE_LABEL={stocks:'Ações',fiis:'FIIs',crypto:'Cripto',fixed_income:'Renda Fixa',treasury:'Tesouro'};
        autoTable(doc,{startY:y,head:[['Nome','Tipo','Investido','Valor Atual','Retorno']],body:preview.investments.map(inv=>{const invested=['fixed_income','treasury'].includes(inv.type)?Number(inv.initial_amount||0):Number(inv.quantity||0)*Number(inv.avg_price||0);const current=Number(inv.calculated_current_value||invested);const retPct=invested>0?((current-invested)/invested*100).toFixed(1):'0.0';return[inv.name,TYPE_LABEL[inv.type]||inv.type,fmt(invested),fmt(current),`${retPct}%`];}),styles:{fontSize:8,cellPadding:2.5},headStyles:{fillColor:DARK,textColor:WHITE,fontStyle:'bold'},alternateRowStyles:{fillColor:LGRAY},columnStyles:{2:{halign:'right'},3:{halign:'right'},4:{halign:'center'}},margin:{left:mL,right:mR}});
        y=doc.lastAutoTable.finalY+10;
      }

      const activeDebts=(preview.debts||[]).filter(d=>!d.done);
      if(options.debts&&activeDebts.length){
        if(y>220){doc.addPage();y=20;}
        doc.setFontSize(13); doc.setFont('helvetica','bold'); doc.setTextColor(...DARK);
        doc.text('Dívidas em Aberto',mL,y); y+=4;
        autoTable(doc,{startY:y,head:[['Nome','Parcelas','Valor/Parcela','Restante','Progresso']],body:activeDebts.map(d=>[d.name,`${d.paid_installments}/${d.installments}`,fmt(d.installment_value),fmt(d.remaining||0),`${d.pct||0}%`]),styles:{fontSize:8,cellPadding:2.5},headStyles:{fillColor:DARK,textColor:WHITE,fontStyle:'bold'},alternateRowStyles:{fillColor:LGRAY},columnStyles:{2:{halign:'right'},3:{halign:'right'},4:{halign:'center'}},margin:{left:mL,right:mR}});
      }

      const total=doc.getNumberOfPages();
      for(let p=1;p<=total;p++){doc.setPage(p);doc.setFillColor(...LGRAY);doc.rect(0,285,W,12,'F');doc.setFontSize(8);doc.setTextColor(...GRAY);doc.setFont('helvetica','normal');doc.text('Ei! Finanças — Relatório gerado automaticamente',mL,292);doc.text(`Página ${p} de ${total}`,W-mR,292,{align:'right'});}

      doc.save(`relatorio-${MONTHS[month-1].toLowerCase()}-${year}.pdf`);
    } catch(err){ console.error(err); alert(`Erro ao gerar PDF: ${err.message}`); }
    setLoading(false);
  }

  const s = preview?.summary;
  const annualMonths = annual?.months || [];
  const best  = annual?.best_month;
  const worst = annual?.worst_month;

  return (
    <div style={{minHeight:'100vh',background:'var(--bg)'}}>
      <Navbar/>
      <main className="page-main" style={{maxWidth:700,margin:'0 auto',padding:'24px 16px 80px'}}>

        <div style={{marginBottom:28}}>
          <h1 style={{fontSize:20,fontWeight:600,letterSpacing:'-0.03em'}}>Relatório</h1>
          <p style={{color:'var(--text3)',fontSize:13,marginTop:4}}>Resumo financeiro e comparativo mensal</p>
        </div>

        {/* ── Comparativo 6 meses ── */}
        {annualMonths.length > 1 && (
          <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:14,padding:'20px',marginBottom:14}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
              <p style={{fontSize:12,color:'var(--text3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em'}}>
                Comparativo — {year}
              </p>
              <div style={{display:'flex',gap:12}}>
                {best && <span style={{fontSize:11,background:'var(--green-dim)',color:'var(--green)',borderRadius:20,padding:'2px 10px'}}>🏆 Melhor: {best.label?.slice(0,3)}</span>}
                {worst && <span style={{fontSize:11,background:'var(--red-dim)',color:'var(--red)',borderRadius:20,padding:'2px 10px'}}>📉 Pior: {worst.label?.slice(0,3)}</span>}
              </div>
            </div>

            <BarChart months={annualMonths}/>

            {/* Tabela resumida */}
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead>
                  <tr>
                    {['Mês','Receitas','Despesas','Saldo'].map(h=>(
                      <th key={h} style={{padding:'6px 8px',textAlign:h==='Mês'?'left':'right',color:'var(--text3)',fontWeight:600,borderBottom:'1px solid var(--border)',fontSize:11,textTransform:'uppercase',letterSpacing:'0.04em'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {annualMonths.slice(-6).map((m,i)=>{
                    const isSelected = m.month === month;
                    const isGood     = (m.balance||0) >= 0;
                    return (
                      <tr key={m.month}
                        onClick={()=>setMonth(m.month)}
                        style={{cursor:'pointer',background:isSelected?'var(--indigo-dim)':'transparent',borderRadius:6,transition:'background 0.15s'}}>
                        <td style={{padding:'7px 8px',color:isSelected?'var(--indigo)':'var(--text)',fontWeight:isSelected?600:400,borderBottom:'1px solid var(--border)'}}>{m.label?.slice(0,3)||''}</td>
                        <td style={{padding:'7px 8px',textAlign:'right',color:'var(--green)',fontFamily:'var(--mono)',fontSize:11,borderBottom:'1px solid var(--border)'}}>{fmtCompact(m.income||0)}</td>
                        <td style={{padding:'7px 8px',textAlign:'right',color:'var(--red)',fontFamily:'var(--mono)',fontSize:11,borderBottom:'1px solid var(--border)'}}>{fmtCompact(m.expense||0)}</td>
                        <td style={{padding:'7px 8px',textAlign:'right',color:isGood?'var(--green)':'var(--red)',fontFamily:'var(--mono)',fontSize:11,fontWeight:600,borderBottom:'1px solid var(--border)'}}>{fmtCompact(m.balance||0)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p style={{fontSize:11,color:'var(--text3)',marginTop:8,textAlign:'center'}}>Clique em um mês para gerar o relatório daquele período</p>
          </div>
        )}

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
