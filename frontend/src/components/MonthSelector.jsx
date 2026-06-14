const ML = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const btn = { width:32, height:32, borderRadius:8, background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--text2)', cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s' };

export default function MonthSelector({ month, year, onChange }) {
  function prev() { month===1 ? onChange(12,year-1) : onChange(month-1,year); }
  function next() {
    const t=new Date(); if(year>t.getFullYear()||(year===t.getFullYear()&&month>=t.getMonth()+1)) return;
    month===12 ? onChange(1,year+1) : onChange(month+1,year);
  }
  return (
    <div style={{display:'flex',alignItems:'center',gap:10}}>
      <button style={btn} onClick={prev}
        onMouseOver={e=>e.currentTarget.style.borderColor='var(--border-md)'}
        onMouseOut={e=>e.currentTarget.style.borderColor='var(--border)'}>‹</button>
      <span style={{fontSize:15,fontWeight:600,letterSpacing:'-0.02em',minWidth:90,textAlign:'center'}}>
        {ML[month-1]} <span style={{color:'var(--text3)'}}>{year}</span>
      </span>
      <button style={btn} onClick={next}
        onMouseOver={e=>e.currentTarget.style.borderColor='var(--border-md)'}
        onMouseOut={e=>e.currentTarget.style.borderColor='var(--border)'}>›</button>
    </div>
  );
}
