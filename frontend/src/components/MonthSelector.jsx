// MonthSelector — seletor de mês/ano reutilizável
// Uso: <MonthSelector month={month} year={year} onChange={(m,y)=>{...}}/>

const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

export default function MonthSelector({ month, year, onChange }) {
  function prev() {
    if (month === 1) onChange(12, year - 1);
    else             onChange(month - 1, year);
  }
  function next() {
    if (month === 12) onChange(1, year + 1);
    else              onChange(month + 1, year);
  }

  const isCurrentMonth = (() => {
    const now = new Date();
    return month === now.getMonth()+1 && year === now.getFullYear();
  })();

  return (
    <div style={{display:'flex',alignItems:'center',gap:'var(--space-1)',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'var(--radius-md)',padding:'3px'}}>
      <button onClick={prev}
        style={{width:30,height:30,borderRadius:'var(--radius-sm)',border:'none',background:'transparent',color:'var(--text3)',cursor:'pointer',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center',transition:'all var(--transition)'}}
        onMouseOver={e=>{e.currentTarget.style.background='var(--bg2)';e.currentTarget.style.color='var(--text)';}}
        onMouseOut={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color='var(--text3)';}}>
        ‹
      </button>

      <span style={{fontSize:'var(--text-sm)',fontWeight:'var(--font-semibold)',color:'var(--text)',minWidth:90,textAlign:'center',userSelect:'none'}}>
        {MONTHS[month-1]} {year}
      </span>

      <button onClick={next}
        style={{width:30,height:30,borderRadius:'var(--radius-sm)',border:'none',background:'transparent',color:'var(--text3)',cursor:'pointer',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center',transition:'all var(--transition)'}}
        onMouseOver={e=>{e.currentTarget.style.background='var(--bg2)';e.currentTarget.style.color='var(--text)';}}
        onMouseOut={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color='var(--text3)';}}>
        ›
      </button>

      {!isCurrentMonth && (
        <button onClick={()=>{ const n=new Date(); onChange(n.getMonth()+1,n.getFullYear()); }}
          style={{fontSize:10,color:'var(--indigo)',background:'var(--indigo-dim)',border:'none',borderRadius:'var(--radius-sm)',padding:'3px 8px',cursor:'pointer',fontFamily:'var(--font)',fontWeight:'var(--font-medium)',whiteSpace:'nowrap',transition:'all var(--transition)'}}
          onMouseOver={e=>e.currentTarget.style.filter='brightness(1.1)'}
          onMouseOut={e=>e.currentTarget.style.filter='none'}>
          Hoje
        </button>
      )}
    </div>
  );
}
