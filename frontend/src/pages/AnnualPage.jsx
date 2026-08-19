import { useState, useEffect } from 'react';
import {
  BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell
} from 'recharts';
import api from '../lib/api';
import Navbar from '../components/Navbar';

const fmt  = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);
const fmtK = v => Math.abs(v) >= 1000 ? `R$${(v/1000).toFixed(1)}k` : fmt(v);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{background:'var(--bg2)',border:'1px solid var(--border-md)',borderRadius:10,padding:'12px 14px',boxShadow:'var(--shadow)'}}>
      <p style={{fontSize:12,fontWeight:600,color:'var(--text)',marginBottom:8}}>{label}</p>
      {payload.map(p => (
        <div key={p.name} style={{display:'flex',justifyContent:'space-between',gap:16,marginBottom:3}}>
          <span style={{fontSize:12,color:p.color}}>{p.name}</span>
          <span style={{fontFamily:'var(--mono)',fontSize:12,fontWeight:600,color:p.color}}>{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

export default function AnnualPage() {
  const currentYear = new Date().getFullYear();
  const [year,    setYear]    = useState(currentYear);
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState('overview'); // 'overview' | 'categories' | 'months'

  async function load() {
    setLoading(true);
    try {
      const { data: res } = await api.get(`/api/annual?year=${year}`);
      setData(res);
    } catch(e) { console.error(e); }
    setLoading(false);
  }

  useEffect(() => { load(); }, [year]);

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <div style={{minHeight:'100vh',background:'var(--bg)'}}>
      <Navbar/>
      <main className="page-main" style={{maxWidth:900,margin:'0 auto',padding:'24px 16px 80px'}}>

        {/* Header */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24,flexWrap:'wrap',gap:12}}>
          <div>
            <h1 style={{fontSize:20,fontWeight:600,letterSpacing:'-0.03em'}}>Visão Anual</h1>
            <p style={{color:'var(--text3)',fontSize:13,marginTop:4}}>
              {data ? `${data.months_with_data} meses com dados em ${year}` : 'Resumo do ano'}
            </p>
          </div>
          <div style={{display:'flex',background:'var(--bg3)',borderRadius:9,padding:3,border:'1px solid var(--border)'}}>
            {years.map(y => (
              <button key={y} onClick={() => setYear(y)} style={{
                padding:'6px 14px', borderRadius:7, fontSize:13, fontWeight:500,
                border:'none', cursor:'pointer', fontFamily:'var(--font)',
                background: y===year ? 'var(--bg2)' : 'transparent',
                color:      y===year ? 'var(--indigo)' : 'var(--text3)',
                transition:'all 0.15s',
              }}>{y}</button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            {[1,2,3].map(i=><div key={i} className="skeleton" style={{height:120,borderRadius:14}}/>)}
          </div>
        ) : !data ? null : (<>

          {/* Cards de totais */}
          <div style={{display:'grid',gap:12,marginBottom:20}} className="summary-grid">
            {[
              {label:'Receitas totais',    value:fmt(data.total_income),  color:'var(--green)',  icon:'↑'},
              {label:'Despesas totais',    value:fmt(data.total_expense), color:'var(--red)',    icon:'↓'},
              {label:'Saldo do ano',       value:fmt(data.total_balance), color:data.total_balance>=0?'var(--indigo)':'var(--red)', icon:'='},
              {label:'Taxa de poupança',   value:`${data.saving_rate}%`,  color:data.saving_rate>=20?'var(--green)':data.saving_rate>=0?'var(--amber)':'var(--red)', icon:'💰'},
            ].map(c => (
              <div key={c.label} style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:14,padding:'16px 18px',display:'flex',alignItems:'center',gap:14}}>
                <div style={{width:38,height:38,borderRadius:10,background:`${c.color}22`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,fontWeight:700,color:c.color,flexShrink:0}}>{c.icon}</div>
                <div>
                  <p style={{fontSize:11,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:4}}>{c.label}</p>
                  <p style={{fontFamily:'var(--mono)',fontSize:15,fontWeight:700,color:c.color}}>{c.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Melhor e pior mês */}
          {(data.best_month || data.worst_month) && (
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:20}}>
              {data.best_month && (
                <div style={{background:'rgba(45,212,160,0.08)',border:'1px solid rgba(45,212,160,0.2)',borderRadius:12,padding:'14px 16px'}}>
                  <p style={{fontSize:11,color:'var(--green)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:6}}>🏆 Melhor mês</p>
                  <p style={{fontSize:16,fontWeight:700,color:'var(--text)'}}>{data.best_month.label}</p>
                  <p style={{fontFamily:'var(--mono)',fontSize:13,color:'var(--green)',marginTop:4}}>{fmt(data.best_month.balance)} de saldo</p>
                </div>
              )}
              {data.worst_month && (
                <div style={{background:'rgba(240,94,110,0.08)',border:'1px solid rgba(240,94,110,0.2)',borderRadius:12,padding:'14px 16px'}}>
                  <p style={{fontSize:11,color:'var(--red)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:6}}>📉 Mês mais apertado</p>
                  <p style={{fontSize:16,fontWeight:700,color:'var(--text)'}}>{data.worst_month.label}</p>
                  <p style={{fontFamily:'var(--mono)',fontSize:13,color:'var(--red)',marginTop:4}}>{fmt(data.worst_month.balance)} de saldo</p>
                </div>
              )}
            </div>
          )}

          {/* Tabs */}
          <div style={{display:'flex',gap:4,marginBottom:16,background:'var(--bg3)',borderRadius:10,padding:3,border:'1px solid var(--border)',width:'fit-content'}}>
            {[
              {id:'overview',    label:'📊 Receitas vs Despesas'},
              {id:'accumulated', label:'📈 Acumulado'},
              {id:'categories',  label:'🏷️ Categorias'},
              {id:'months',      label:'📋 Meses'},
            ].map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)} style={{
                padding:'7px 14px',borderRadius:8,fontSize:12,fontWeight:500,
                border:'none',cursor:'pointer',fontFamily:'var(--font)',
                background:tab===t.id?'var(--bg2)':'transparent',
                color:tab===t.id?'var(--indigo)':'var(--text3)',
                whiteSpace:'nowrap',transition:'all 0.15s',
              }}>{t.label}</button>
            ))}
          </div>

          {/* Gráfico receitas vs despesas */}
          {tab === 'overview' && (
            <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:14,padding:'20px 16px'}}>
              <p style={{fontSize:11,color:'var(--text3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:16}}>Receitas vs Despesas — {year}</p>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.months} barGap={3} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
                  <XAxis dataKey="label" tick={{fill:'var(--text3)',fontSize:11}} axisLine={false} tickLine={false}/>
                  <YAxis tickFormatter={fmtK} tick={{fill:'var(--text3)',fontSize:11}} axisLine={false} tickLine={false} width={56}/>
                  <Tooltip content={<CustomTooltip/>}/>
                  <Legend wrapperStyle={{fontSize:12,color:'var(--text2)'}}/>
                  <Bar dataKey="income"  name="Receitas" fill="var(--green)" radius={[5,5,0,0]} maxBarSize={32}/>
                  <Bar dataKey="expense" name="Despesas" fill="var(--red)"   radius={[5,5,0,0]} maxBarSize={32}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Gráfico acumulado */}
          {tab === 'accumulated' && (
            <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:14,padding:'20px 16px'}}>
              <p style={{fontSize:11,color:'var(--text3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:16}}>Saldo acumulado no ano — {year}</p>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={data.months}>
                  <defs>
                    <linearGradient id="annualGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="var(--indigo)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--indigo)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
                  <XAxis dataKey="label" tick={{fill:'var(--text3)',fontSize:11}} axisLine={false} tickLine={false}/>
                  <YAxis tickFormatter={fmtK} tick={{fill:'var(--text3)',fontSize:11}} axisLine={false} tickLine={false} width={56}/>
                  <Tooltip content={<CustomTooltip/>}/>
                  <Area dataKey="accumulated" name="Acumulado" stroke="var(--indigo)" strokeWidth={2} fill="url(#annualGrad)"/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Categorias do ano */}
          {tab === 'categories' && (
            <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:14,padding:'20px'}}>
              <p style={{fontSize:11,color:'var(--text3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:16}}>Gastos por categoria — {year}</p>
              {data.by_category.length === 0 ? (
                <p style={{color:'var(--text3)',fontSize:13,textAlign:'center',padding:'24px 0'}}>Nenhum gasto categorizado ainda.</p>
              ) : (
                <div style={{display:'flex',flexDirection:'column',gap:12}}>
                  {data.by_category.slice(0,10).map(cat=>(
                    <div key={cat.name}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:5}}>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <span style={{width:8,height:8,borderRadius:'50%',background:cat.color,display:'inline-block',flexShrink:0}}/>
                          <span style={{fontSize:13,color:'var(--text)'}}>{cat.name}</span>
                          <span style={{fontSize:11,color:'var(--text3)'}}>{cat.pct}%</span>
                        </div>
                        <span style={{fontFamily:'var(--mono)',fontSize:13,fontWeight:600,color:'var(--red)'}}>{fmt(cat.total)}</span>
                      </div>
                      <div style={{height:6,background:'var(--bg3)',borderRadius:99,overflow:'hidden'}}>
                        <div style={{height:'100%',width:`${cat.pct}%`,background:cat.color,borderRadius:99,transition:'width 0.4s'}}/>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tabela mensal */}
          {tab === 'months' && (
            <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:14,overflow:'hidden'}}>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                  <thead>
                    <tr style={{background:'var(--bg3)'}}>
                      {['Mês','Receitas','Despesas','Saldo','Acumulado'].map(h=>(
                        <th key={h} style={{padding:'12px 16px',textAlign:'right',fontSize:11,color:'var(--text3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em',whiteSpace:'nowrap',':first-child':{textAlign:'left'}}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.months.map((m,i) => {
                      const hasData = m.income > 0 || m.expense > 0;
                      return (
                        <tr key={i} style={{borderTop:'1px solid var(--border)',opacity:hasData?1:0.35}}
                          onMouseOver={e=>{if(hasData)e.currentTarget.style.background='var(--bg3)';}}
                          onMouseOut={e=>e.currentTarget.style.background='transparent'}>
                          <td style={{padding:'12px 16px',color:'var(--text)',fontWeight:600}}>{m.label}</td>
                          <td style={{padding:'12px 16px',textAlign:'right',fontFamily:'var(--mono)',color:'var(--green)'}}>{m.income>0?fmt(m.income):'—'}</td>
                          <td style={{padding:'12px 16px',textAlign:'right',fontFamily:'var(--mono)',color:'var(--red)'}}>{m.expense>0?fmt(m.expense):'—'}</td>
                          <td style={{padding:'12px 16px',textAlign:'right',fontFamily:'var(--mono)',fontWeight:600,color:m.balance>=0?'var(--indigo)':'var(--red)'}}>{hasData?fmt(m.balance):'—'}</td>
                          <td style={{padding:'12px 16px',textAlign:'right',fontFamily:'var(--mono)',color:m.accumulated>=0?'var(--text)':'var(--red)'}}>{hasData?fmt(m.accumulated):'—'}</td>
                        </tr>
                      );
                    })}
                    {/* Totais */}
                    <tr style={{borderTop:'2px solid var(--border)',background:'var(--bg3)'}}>
                      <td style={{padding:'12px 16px',fontWeight:700,color:'var(--text)'}}>Total {year}</td>
                      <td style={{padding:'12px 16px',textAlign:'right',fontFamily:'var(--mono)',fontWeight:700,color:'var(--green)'}}>{fmt(data.total_income)}</td>
                      <td style={{padding:'12px 16px',textAlign:'right',fontFamily:'var(--mono)',fontWeight:700,color:'var(--red)'}}>{fmt(data.total_expense)}</td>
                      <td style={{padding:'12px 16px',textAlign:'right',fontFamily:'var(--mono)',fontWeight:700,color:data.total_balance>=0?'var(--indigo)':'var(--red)'}}>{fmt(data.total_balance)}</td>
                      <td style={{padding:'12px 16px',textAlign:'right',fontFamily:'var(--mono)',fontWeight:700,color:'var(--text3)'}}>—</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </>)}
      </main>
    </div>
  );
}
