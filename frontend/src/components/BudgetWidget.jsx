import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

const fmt = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v);

export default function BudgetWidget({ month, year }) {
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get(`/api/budgets?month=${month}&year=${year}`)
      .then(r => { setBudgets(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [month, year]);

  if (loading) return (
    <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:'20px 18px'}}>
      <div className="skeleton" style={{height:16,width:120,marginBottom:12}}/>
      {[1,2,3].map(i=><div key={i} className="skeleton" style={{height:36,marginBottom:8}}/>)}
    </div>
  );

  if (budgets.length===0) return (
    <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:'20px 18px',textAlign:'center'}}>
      <p style={{fontSize:11,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:12}}>Tetos de gastos</p>
      <p style={{fontSize:13,color:'var(--text3)',marginBottom:12}}>Nenhum teto definido.</p>
      <button onClick={()=>navigate('/budgets')} style={{fontSize:12,color:'var(--indigo)',background:'var(--indigo-dim)',border:'none',borderRadius:7,padding:'6px 14px',cursor:'pointer',fontFamily:'var(--font)'}}>
        Configurar →
      </button>
    </div>
  );

  const overCount = budgets.filter(b=>b.pct>=100).length;

  return (
    <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:'20px 18px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
        <p style={{fontSize:11,color:'var(--text3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.07em'}}>Tetos de gastos</p>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          {overCount>0 && (
            <span style={{fontSize:11,color:'var(--red)',background:'var(--red-dim)',borderRadius:5,padding:'2px 7px',fontWeight:600}}>
              {overCount} acima
            </span>
          )}
          <button onClick={()=>navigate('/budgets')} style={{fontSize:12,color:'var(--indigo)',background:'none',border:'none',cursor:'pointer',fontFamily:'var(--font)'}}>
            Ver todos →
          </button>
        </div>
      </div>

      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {budgets.slice(0,4).map(b => {
          const pct      = b.pct || 0;
          const barColor = pct>=100?'var(--red)':pct>=80?'var(--amber)':(b.categories?.color||'var(--indigo)');
          return (
            <div key={b.id}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
                <span style={{fontSize:13,color:'var(--text)',fontWeight:500}}>{b.categories?.name||'Categoria'}</span>
                <span style={{fontSize:12,fontFamily:'var(--mono)',color:barColor,fontWeight:600}}>{fmt(b.spent)} / {fmt(b.amount)}</span>
              </div>
              <div style={{height:5,background:'var(--bg3)',borderRadius:99,overflow:'hidden'}}>
                <div style={{height:'100%',width:`${Math.min(100,pct)}%`,background:barColor,borderRadius:99,transition:'width 0.4s'}}/>
              </div>
            </div>
          );
        })}
        {budgets.length>4 && (
          <p style={{fontSize:12,color:'var(--text3)',textAlign:'center',marginTop:2}}>+ {budgets.length-4} outras categorias</p>
        )}
      </div>
    </div>
  );
}
