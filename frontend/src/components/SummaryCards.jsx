const fmt = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v);
export default function SummaryCards({ summary, loading }) {
  const cards = [
    { label:'Receitas', value:summary.income,  color:'var(--green)', dim:'var(--green-dim)', icon:'↑', border:'rgba(45,212,160,0.15)' },
    { label:'Despesas', value:summary.expense, color:'var(--red)',   dim:'var(--red-dim)',   icon:'↓', border:'rgba(240,94,110,0.15)' },
    { label:'Saldo', value:summary.balance, color:summary.balance>=0?'var(--indigo)':'var(--red)', dim:summary.balance>=0?'var(--indigo-dim)':'var(--red-dim)', icon:'=', border:summary.balance>=0?'rgba(124,127,247,0.15)':'rgba(240,94,110,0.15)' },
  ];
  return (
    <div className="summary-grid fade-up" style={{display:'grid',gap:12}}>
      {cards.map((c,i)=>(
        <div key={c.label} style={{background:'var(--bg2)',border:`1px solid ${c.border}`,borderRadius:'var(--radius)',padding:'18px 20px',animationDelay:`${i*60}ms`}} className="fade-up">
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
            <span style={{fontSize:11,color:'var(--text3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em'}}>{c.label}</span>
            <div style={{width:26,height:26,borderRadius:7,background:c.dim,display:'flex',alignItems:'center',justifyContent:'center',color:c.color,fontSize:13,fontWeight:700}}>{c.icon}</div>
          </div>
          {loading ? <div className="skeleton" style={{height:28,width:'60%'}}/> :
            <p style={{fontSize:22,fontWeight:600,color:c.color,letterSpacing:'-0.03em',fontFamily:'var(--mono)'}}>{fmt(c.value)}</p>}
        </div>
      ))}
    </div>
  );
}
