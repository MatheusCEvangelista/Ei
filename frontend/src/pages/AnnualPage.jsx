import { useState, useEffect } from 'react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { PageShell, PageHeader, Card, StatCard, EmptyState, SkeletonList, SectionLabel, Badge } from '../components/ui';
import api from '../lib/api';

const fmt  = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);
const fmtK = v => Math.abs(v)>=1000?`R$${(v/1000).toFixed(1)}k`:fmt(v);

const CustomTooltip = ({active,payload,label}) => {
  if(!active||!payload?.length) return null;
  return(
    <div style={{background:'var(--bg2)',border:'1px solid var(--border-md)',borderRadius:'var(--radius-md)',padding:'var(--space-3) var(--space-4)',boxShadow:'var(--shadow)'}}>
      <p style={{fontSize:'var(--text-sm)',fontWeight:'var(--font-semibold)',color:'var(--text)',marginBottom:'var(--space-2)'}}>{label}</p>
      {payload.map(p=>(
        <div key={p.name} style={{display:'flex',justifyContent:'space-between',gap:'var(--space-4)',marginBottom:2}}>
          <span style={{fontSize:'var(--text-sm)',color:p.color}}>{p.name}</span>
          <span style={{fontFamily:'var(--mono)',fontSize:'var(--text-sm)',fontWeight:'var(--font-semibold)',color:p.color}}>{fmt(p.value)}</span>
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
  const [tab,     setTab]     = useState('overview');

  async function load() {
    setLoading(true);
    try { const { data: res } = await api.get(`/api/annual?year=${year}`); setData(res); }
    catch(e){ console.error(e); }
    setLoading(false);
  }

  useEffect(()=>{ load(); },[year]);

  const years = Array.from({length:5},(_,i)=>currentYear-i);
  const TABS  = [
    {id:'overview',    label:'📊 Receitas vs Despesas'},
    {id:'accumulated', label:'📈 Acumulado'},
    {id:'categories',  label:'🏷️ Categorias'},
    {id:'months',      label:'📋 Meses'},
  ];

  const YearSelector = (
    <div style={{display:'flex',background:'var(--bg3)',borderRadius:'var(--radius-sm)',padding:3,border:'1px solid var(--border)'}}>
      {years.map(y=>(
        <button key={y} onClick={()=>setYear(y)} style={{padding:'6px 14px',borderRadius:'var(--radius-sm)',fontSize:'var(--text-sm)',fontWeight:'var(--font-medium)',border:'none',cursor:'pointer',fontFamily:'var(--font)',background:y===year?'var(--bg2)':'transparent',color:y===year?'var(--indigo)':'var(--text3)',transition:'all var(--transition)'}}>
          {y}
        </button>
      ))}
    </div>
  );

  return (
    <PageShell maxWidth={900}>
      <PageHeader
        title="Visão Anual"
        subtitle={data?`${data.months_with_data} meses com dados em ${year}`:'Resumo do ano'}
        action={YearSelector}
      />

      {loading ? (
        <SkeletonList n={4} h={100} gap={12}/>
      ) : !data ? null : (<>

        {/* Cards de totais */}
        <div className="summary-grid" style={{gap:'var(--space-3)',marginBottom:'var(--space-5)'}}>
          <StatCard label="Receitas"      value={fmt(data.total_income)}  color="var(--green)"  icon="↑"/>
          <StatCard label="Despesas"      value={fmt(data.total_expense)} color="var(--red)"    icon="↓"/>
          <StatCard label="Saldo"         value={fmt(data.total_balance)} color={data.total_balance>=0?'var(--indigo)':'var(--red)'} icon="="/>
          <StatCard label="Taxa poupança" value={`${data.saving_rate}%`}  color={data.saving_rate>=20?'var(--green)':data.saving_rate>=0?'var(--amber)':'var(--red)'} icon="💰"/>
        </div>

        {/* Melhor e pior mês */}
        {(data.best_month||data.worst_month) && (
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'var(--space-3)',marginBottom:'var(--space-5)'}}>
            {data.best_month && (
              <div style={{background:'var(--green-dim)',border:'1px solid rgba(45,212,160,0.2)',borderRadius:'var(--radius-lg)',padding:'var(--space-4)'}}>
                <SectionLabel style={{color:'var(--green)'}}>🏆 Melhor mês</SectionLabel>
                <p style={{fontSize:'var(--text-lg)',fontWeight:'var(--font-bold)',color:'var(--text)'}}>{data.best_month.label}</p>
                <p style={{fontFamily:'var(--mono)',fontSize:'var(--text-sm)',color:'var(--green)',marginTop:'var(--space-1)'}}>{fmt(data.best_month.balance)} de saldo</p>
              </div>
            )}
            {data.worst_month && (
              <div style={{background:'var(--red-dim)',border:'1px solid rgba(240,94,110,0.2)',borderRadius:'var(--radius-lg)',padding:'var(--space-4)'}}>
                <SectionLabel style={{color:'var(--red)'}}>📉 Mês mais apertado</SectionLabel>
                <p style={{fontSize:'var(--text-lg)',fontWeight:'var(--font-bold)',color:'var(--text)'}}>{data.worst_month.label}</p>
                <p style={{fontFamily:'var(--mono)',fontSize:'var(--text-sm)',color:'var(--red)',marginTop:'var(--space-1)'}}>{fmt(data.worst_month.balance)} de saldo</p>
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        <div style={{display:'flex',gap:'var(--space-1)',marginBottom:'var(--space-4)',background:'var(--bg3)',borderRadius:'var(--radius-sm)',padding:3,border:'1px solid var(--border)',width:'fit-content',overflowX:'auto'}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:'7px 14px',borderRadius:'var(--radius-sm)',fontSize:'var(--text-sm)',fontWeight:'var(--font-medium)',border:'none',cursor:'pointer',fontFamily:'var(--font)',background:tab===t.id?'var(--bg2)':'transparent',color:tab===t.id?'var(--indigo)':'var(--text3)',whiteSpace:'nowrap',transition:'all var(--transition)'}}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Gráfico receitas vs despesas */}
        {tab==='overview' && (
          <Card>
            <div style={{padding:'var(--space-5)'}}>
              <SectionLabel style={{marginBottom:'var(--space-4)'}}>Receitas vs Despesas — {year}</SectionLabel>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.months} barGap={3} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
                  <XAxis dataKey="label" tick={{fill:'var(--text3)',fontSize:11}} axisLine={false} tickLine={false}/>
                  <YAxis tickFormatter={fmtK} tick={{fill:'var(--text3)',fontSize:11}} axisLine={false} tickLine={false} width={56}/>
                  <Tooltip content={<CustomTooltip/>}/>
                  <Legend wrapperStyle={{fontSize:12,color:'var(--text2)'}}/>
                  <Bar dataKey="income" name="Receitas" fill="var(--green)" radius={[5,5,0,0]} maxBarSize={32}/>
                  <Bar dataKey="expense" name="Despesas" fill="var(--red)" radius={[5,5,0,0]} maxBarSize={32}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {/* Acumulado */}
        {tab==='accumulated' && (
          <Card>
            <div style={{padding:'var(--space-5)'}}>
              <SectionLabel style={{marginBottom:'var(--space-4)'}}>Saldo acumulado — {year}</SectionLabel>
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
          </Card>
        )}

        {/* Categorias */}
        {tab==='categories' && (
          <Card>
            <div style={{padding:'var(--space-5)'}}>
              <SectionLabel style={{marginBottom:'var(--space-4)'}}>Gastos por categoria — {year}</SectionLabel>
              {data.by_category.length===0 ? (
                <EmptyState icon="🏷️" title="Nenhum gasto categorizado ainda."/>
              ) : (
                <div style={{display:'flex',flexDirection:'column',gap:'var(--space-3)'}}>
                  {data.by_category.slice(0,10).map(cat=>(
                    <div key={cat.name}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'var(--space-1)'}}>
                        <div style={{display:'flex',alignItems:'center',gap:'var(--space-2)'}}>
                          <span style={{width:8,height:8,borderRadius:'50%',background:cat.color,display:'inline-block',flexShrink:0}}/>
                          <span style={{fontSize:'var(--text-base)',color:'var(--text)'}}>{cat.name}</span>
                          <span style={{fontSize:'var(--text-xs)',color:'var(--text3)'}}>{cat.pct}%</span>
                        </div>
                        <span style={{fontFamily:'var(--mono)',fontSize:'var(--text-sm)',fontWeight:'var(--font-semibold)',color:'var(--red)'}}>{fmt(cat.total)}</span>
                      </div>
                      <div style={{height:6,background:'var(--bg3)',borderRadius:'var(--radius-full)',overflow:'hidden'}}>
                        <div style={{height:'100%',width:`${cat.pct}%`,background:cat.color,borderRadius:'var(--radius-full)',transition:'width 0.4s'}}/>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Tabela de meses */}
        {tab==='months' && (
          <Card>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:'var(--text-sm)'}}>
                <thead>
                  <tr style={{background:'var(--bg3)'}}>
                    {['Mês','Receitas','Despesas','Saldo','Acumulado'].map(h=>(
                      <th key={h} style={{padding:'var(--space-3) var(--space-4)',textAlign:'right',fontSize:'var(--text-xs)',color:'var(--text3)',fontWeight:'var(--font-semibold)',textTransform:'uppercase',letterSpacing:'0.05em',whiteSpace:'nowrap'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.months.map((m,i)=>{
                    const hasData=m.income>0||m.expense>0;
                    return(
                      <tr key={i} style={{borderTop:'1px solid var(--border)',opacity:hasData?1:0.35}}
                        onMouseOver={e=>{if(hasData)e.currentTarget.style.background='var(--bg3)';}}
                        onMouseOut={e=>e.currentTarget.style.background='transparent'}>
                        <td style={{padding:'var(--space-3) var(--space-4)',color:'var(--text)',fontWeight:'var(--font-semibold)'}}>{m.label}</td>
                        <td style={{padding:'var(--space-3) var(--space-4)',textAlign:'right',fontFamily:'var(--mono)',color:'var(--green)'}}>{m.income>0?fmt(m.income):'—'}</td>
                        <td style={{padding:'var(--space-3) var(--space-4)',textAlign:'right',fontFamily:'var(--mono)',color:'var(--red)'}}>{m.expense>0?fmt(m.expense):'—'}</td>
                        <td style={{padding:'var(--space-3) var(--space-4)',textAlign:'right',fontFamily:'var(--mono)',fontWeight:'var(--font-semibold)',color:m.balance>=0?'var(--indigo)':'var(--red)'}}>{hasData?fmt(m.balance):'—'}</td>
                        <td style={{padding:'var(--space-3) var(--space-4)',textAlign:'right',fontFamily:'var(--mono)',color:m.accumulated>=0?'var(--text)':'var(--red)'}}>{hasData?fmt(m.accumulated):'—'}</td>
                      </tr>
                    );
                  })}
                  <tr style={{borderTop:'2px solid var(--border)',background:'var(--bg3)'}}>
                    <td style={{padding:'var(--space-3) var(--space-4)',fontWeight:'var(--font-bold)',color:'var(--text)'}}>Total {year}</td>
                    <td style={{padding:'var(--space-3) var(--space-4)',textAlign:'right',fontFamily:'var(--mono)',fontWeight:'var(--font-bold)',color:'var(--green)'}}>{fmt(data.total_income)}</td>
                    <td style={{padding:'var(--space-3) var(--space-4)',textAlign:'right',fontFamily:'var(--mono)',fontWeight:'var(--font-bold)',color:'var(--red)'}}>{fmt(data.total_expense)}</td>
                    <td style={{padding:'var(--space-3) var(--space-4)',textAlign:'right',fontFamily:'var(--mono)',fontWeight:'var(--font-bold)',color:data.total_balance>=0?'var(--indigo)':'var(--red)'}}>{fmt(data.total_balance)}</td>
                    <td style={{padding:'var(--space-3) var(--space-4)',textAlign:'right',fontFamily:'var(--mono)',fontWeight:'var(--font-bold)',color:'var(--text3)'}}>—</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </>)}
    </PageShell>
  );
}
