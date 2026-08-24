import { useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';
import api from '../lib/api';
import Navbar from '../components/Navbar';

const fmt  = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);
const fmtK = v => Math.abs(v)>=1000?`R$${(v/1000).toFixed(1)}k`:fmt(v);

const CustomTooltip = ({active,payload,label}) => {
  if(!active||!payload?.length) return null;
  return(
    <div style={{background:'var(--bg2)',border:'1px solid var(--border-md)',borderRadius:10,padding:'12px 14px',boxShadow:'var(--shadow)'}}>
      <p style={{fontSize:12,color:'var(--text3)',marginBottom:8,fontWeight:600}}>{label}</p>
      {payload.map(p=>(
        <div key={p.name} style={{display:'flex',justifyContent:'space-between',gap:16,marginBottom:3}}>
          <span style={{fontSize:12,color:p.color}}>{p.name}</span>
          <span style={{fontFamily:'var(--mono)',fontSize:12,fontWeight:600,color:p.color}}>{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

const SCENARIO_INFO = {
  pessimistic: { label:'Pessimista',   desc:'Receitas −15% / Despesas +15%', color:'var(--red)'    },
  realistic:   { label:'Realista',     desc:'Baseado na média histórica',     color:'var(--indigo)' },
  optimistic:  { label:'Otimista',     desc:'Receitas +10% / Despesas −10%', color:'var(--green)'  },
};

export default function ProjectionsPage() {
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [months,   setMonths]   = useState(6);
  const [scenario, setScenario] = useState('realistic');

  async function load() {
    setLoading(true);
    try {
      const { data: res } = await api.get(`/api/projections?months=${months}`);
      setData(res);
    } catch(e){ console.error(e); }
    setLoading(false);
  }

  useEffect(()=>{ load(); },[months]);

  // Monta chartData ajustado pelo cenário selecionado
  const chartData = (data?.projection||[]).map(p => {
    if (scenario === 'pessimistic') return {
      label:     p.label,
      Receita:   p.pess_income,
      Despesa:   p.pess_expense,
      Saldo:     p.pessimistic,
      Acumulado: p.pess_accumulated,
    };
    if (scenario === 'optimistic') return {
      label:     p.label,
      Receita:   p.opt_income,
      Despesa:   p.opt_expense,
      Saldo:     p.optimistic,
      Acumulado: p.opt_accumulated,
    };
    return {
      label:     p.label,
      Receita:   p.income,
      Despesa:   p.expense,
      Saldo:     p.balance,
      Acumulado: p.accumulated,
    };
  });

  const si = SCENARIO_INFO[scenario];

  return (
    <div style={{minHeight:'100vh',background:'var(--bg)'}}>
      <Navbar/>
      <main className="page-main" style={{maxWidth:900,margin:'0 auto',padding:'24px 16px 80px'}}>

        {/* Header */}
        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:24,flexWrap:'wrap',gap:12}}>
          <div>
            <h1 style={{fontSize:20,fontWeight:600,letterSpacing:'-0.03em'}}>Projeção financeira</h1>
            <p style={{color:'var(--text3)',fontSize:13,marginTop:4}}>
              {data?`Baseado em ${data.months_analyzed} mês(es) de histórico`:'Estimativa baseada no histórico'}
            </p>
          </div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {/* Período */}
            <div style={{display:'flex',background:'var(--bg3)',borderRadius:9,padding:3,border:'1px solid var(--border)'}}>
              {[3,6,12].map(m=>(
                <button key={m} onClick={()=>setMonths(m)} style={{padding:'6px 14px',borderRadius:7,fontSize:13,fontWeight:500,border:'none',cursor:'pointer',fontFamily:'var(--font)',transition:'all 0.15s',background:months===m?'var(--bg2)':'transparent',color:months===m?'var(--indigo)':'var(--text3)'}}>
                  {m}m
                </button>
              ))}
            </div>
            {/* Cenário */}
            <select value={scenario} onChange={e=>setScenario(e.target.value)}
              style={{padding:'7px 12px',borderRadius:9,border:'1px solid var(--border)',background:'var(--bg2)',color:'var(--text)',fontSize:13,cursor:'pointer'}}>
              <option value="pessimistic">📉 Pessimista</option>
              <option value="realistic">📊 Realista</option>
              <option value="optimistic">📈 Otimista</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
              {[1,2,3,4].map(i=><div key={i} className="skeleton" style={{height:80,borderRadius:12}}/>)}
            </div>
            <div className="skeleton" style={{height:260,borderRadius:14}}/>
          </div>
        ) : !data ? (
          <div style={{textAlign:'center',padding:'60px 0',color:'var(--text3)'}}>
            <div style={{fontSize:40,marginBottom:12}}>📊</div>
            <p>Dados insuficientes. Registre transações por pelo menos 1 mês.</p>
          </div>
        ) : (<>

          {/* Cards de resumo */}
          <div style={{display:'grid',gap:12,marginBottom:20}} className="summary-grid">
            {[
              {label:'Receita média/mês',   value:fmt(data.avg_income),  color:'var(--green)'},
              {label:'Despesa média/mês',   value:fmt(data.avg_expense), color:'var(--red)'},
              {label:'Saldo projetado/mês', value:fmt(data.avg_balance), color:data.avg_balance>=0?'var(--indigo)':'var(--red)'},
              {label:'Fixos mensais',       value:fmt(data.fixed_expense),color:'var(--amber)'},
            ].map(c=>(
              <div key={c.label} style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:14,padding:'16px 18px'}}>
                <p style={{fontSize:11,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:8}}>{c.label}</p>
                <p style={{fontFamily:'var(--mono)',fontSize:16,fontWeight:600,color:c.color}}>{c.value}</p>
              </div>
            ))}
          </div>

          {/* Badge cenário */}
          {scenario !== 'realistic' && (
            <div style={{background:`${si.color}15`,border:`1px solid ${si.color}44`,borderRadius:10,padding:'10px 14px',marginBottom:14,fontSize:12,color:si.color,display:'flex',alignItems:'center',gap:8}}>
              <strong>{si.label}:</strong> {si.desc}
            </div>
          )}

          {/* Gráfico Receita vs Despesa */}
          <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:14,padding:'20px 16px',marginBottom:12}}>
            <p style={{fontSize:11,color:'var(--text3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:16}}>
              Receita vs Despesa — {si.label}
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
                <XAxis dataKey="label" tick={{fill:'var(--text3)',fontSize:11}} axisLine={false} tickLine={false}/>
                <YAxis tickFormatter={fmtK} tick={{fill:'var(--text3)',fontSize:11}} axisLine={false} tickLine={false} width={56}/>
                <Tooltip content={<CustomTooltip/>}/>
                <Legend wrapperStyle={{fontSize:12,color:'var(--text2)'}}/>
                <Bar dataKey="Receita" fill="var(--green)" radius={[5,5,0,0]} maxBarSize={40}/>
                <Bar dataKey="Despesa" fill="var(--red)"   radius={[5,5,0,0]} maxBarSize={40}/>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Gráfico Acumulado */}
          <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:14,padding:'20px 16px',marginBottom:12}}>
            <p style={{fontSize:11,color:'var(--text3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:16}}>
              Saldo acumulado — {si.label}
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="projGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={si.color} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={si.color} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
                <XAxis dataKey="label" tick={{fill:'var(--text3)',fontSize:11}} axisLine={false} tickLine={false}/>
                <YAxis tickFormatter={fmtK} tick={{fill:'var(--text3)',fontSize:11}} axisLine={false} tickLine={false} width={56}/>
                <Tooltip content={<CustomTooltip/>}/>
                <Area dataKey="Acumulado" stroke={si.color} strokeWidth={2} fill="url(#projGrad)"/>
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Tabela detalhada */}
          <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:14,overflow:'hidden'}}>
            <div style={{padding:'14px 18px',borderBottom:'1px solid var(--border)'}}>
              <p style={{fontSize:11,color:'var(--text3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.07em'}}>
                Detalhamento — {si.label}
              </p>
            </div>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                <thead>
                  <tr style={{background:'var(--bg3)'}}>
                    {['Mês','Receita','Despesa','Saldo mês','Acumulado'].map(h=>(
                      <th key={h} style={{padding:'10px 16px',textAlign:'right',fontSize:11,color:'var(--text3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em',whiteSpace:'nowrap'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {chartData.map((p,i)=>(
                    <tr key={i} style={{borderTop:'1px solid var(--border)'}}
                      onMouseOver={e=>e.currentTarget.style.background='var(--bg3)'}
                      onMouseOut={e=>e.currentTarget.style.background='transparent'}>
                      <td style={{padding:'12px 16px',color:'var(--text)',fontWeight:500}}>{p.label}</td>
                      <td style={{padding:'12px 16px',textAlign:'right',fontFamily:'var(--mono)',color:'var(--green)'}}>{fmt(p.Receita)}</td>
                      <td style={{padding:'12px 16px',textAlign:'right',fontFamily:'var(--mono)',color:'var(--red)'}}>{fmt(p.Despesa)}</td>
                      <td style={{padding:'12px 16px',textAlign:'right',fontFamily:'var(--mono)',color:p.Saldo>=0?'var(--indigo)':'var(--red)',fontWeight:600}}>{fmt(p.Saldo)}</td>
                      <td style={{padding:'12px 16px',textAlign:'right',fontFamily:'var(--mono)',color:p.Acumulado>=0?'var(--text)':'var(--red)'}}>{fmt(p.Acumulado)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Top categorias */}
          {data.by_category?.length>0 && (
            <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:14,padding:'18px 20px',marginTop:12}}>
              <p style={{fontSize:11,color:'var(--text3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:14}}>
                Maiores despesas projetadas/mês
              </p>
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {data.by_category.slice(0,5).map(cat=>{
                  const pct = data.avg_expense>0?Math.round(cat.avg_monthly/data.avg_expense*100):0;
                  return(
                    <div key={cat.category_id}>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <span style={{width:8,height:8,borderRadius:'50%',background:cat.color,display:'inline-block',flexShrink:0}}/>
                          <span style={{fontSize:13,color:'var(--text)'}}>{cat.name}</span>
                          <span style={{fontSize:11,color:'var(--text3)'}}>{pct}%</span>
                        </div>
                        <span style={{fontFamily:'var(--mono)',fontSize:13,fontWeight:500,color:'var(--red)'}}>{fmt(cat.avg_monthly)}</span>
                      </div>
                      <div style={{height:5,background:'var(--bg3)',borderRadius:99,overflow:'hidden'}}>
                        <div style={{height:'100%',width:`${pct}%`,background:cat.color,borderRadius:99,transition:'width 0.4s'}}/>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>)}
      </main>
    </div>
  );
}
