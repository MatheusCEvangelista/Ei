import { useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';
import api from '../lib/api';
import Navbar from '../components/Navbar';

const fmt = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v);
const fmtK = v => {
  if(Math.abs(v)>=1000) return `R$${(v/1000).toFixed(1)}k`;
  return fmt(v);
};

const CustomTooltip = ({active,payload,label}) => {
  if(!active||!payload?.length) return null;
  return(
    <div style={{background:'var(--bg2)',border:'1px solid var(--border-md)',borderRadius:10,padding:'12px 14px',boxShadow:'var(--shadow)'}}>
      <p style={{fontSize:12,color:'var(--text3)',marginBottom:8,fontWeight:600}}>{label}</p>
      {payload.map(p=>(
        <p key={p.name} style={{fontSize:13,color:p.color,marginBottom:2}}>
          {p.name}: <span style={{fontFamily:'var(--mono)',fontWeight:600}}>{fmt(p.value)}</span>
        </p>
      ))}
    </div>
  );
};

export default function ProjectionsPage() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [months,  setMonths]  = useState(6);
  const [scenario,setScenario]= useState('realistic'); // realistic | pessimistic | optimistic

  async function load() {
    setLoading(true);
    try {
      const { data: res } = await api.get(`/api/projections?months=${months}`);
      setData(res);
    } catch(e){ console.error(e); }
    setLoading(false);
  }

  useEffect(()=>{ load(); },[months]);

  const chartData = data?.projection?.map(p => ({
    label: p.label,
    Receita:  p.income,
    Despesa:  p.expense,
    Saldo:    scenario==='pessimistic'?p.pessimistic:scenario==='optimistic'?p.optimistic:p.balance,
    Acumulado:p.accumulated,
  })) || [];

  const summaryCards = data ? [
    { label:'Receita média/mês',   value:fmt(data.avg_income),   color:'var(--green)',  icon:'↑' },
    { label:'Despesa média/mês',   value:fmt(data.avg_expense),  color:'var(--red)',    icon:'↓' },
    { label:'Saldo projetado/mês', value:fmt(data.avg_balance),  color:data.avg_balance>=0?'var(--indigo)':'var(--red)', icon:'≈' },
    { label:'Fixos mensais',       value:fmt(data.fixed_expense),color:'var(--amber)',  icon:'🔄' },
  ] : [];

  return (
    <div style={{minHeight:'100vh',background:'var(--bg)'}}>
      <Navbar/>
      <main className="page-main" style={{maxWidth:900,margin:'0 auto',padding:'24px 16px 80px'}}>

        {/* Header */}
        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:24,flexWrap:'wrap',gap:12}}>
          <div>
            <h1 style={{fontSize:20,fontWeight:600,letterSpacing:'-0.03em'}}>Projeção financeira</h1>
            <p style={{color:'var(--text3)',fontSize:13,marginTop:4}}>Estimativa baseada na sua média dos últimos 3 meses</p>
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
              <option value="pessimistic">📉 Pessimista (-15%)</option>
              <option value="realistic">📊 Realista</option>
              <option value="optimistic">📈 Otimista (+10%)</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}} className="summary-grid">
              {[1,2,3,4].map(i=><div key={i} className="skeleton" style={{height:80}}/>)}
            </div>
            <div className="skeleton" style={{height:260}}/>
            <div className="skeleton" style={{height:200}}/>
          </div>
        ) : !data ? (
          <div style={{textAlign:'center',padding:'60px 0',color:'var(--text3)'}}>
            <div style={{fontSize:40,marginBottom:12}}>📊</div>
            <p style={{fontSize:14}}>Dados insuficientes. Registre transações por pelo menos 1 mês.</p>
          </div>
        ) : (<>

          {/* Cards resumo */}
          <div className="summary-grid" style={{display:'grid',gap:12,marginBottom:20}}>
            {summaryCards.map(c=>(
              <div key={c.label} style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:14,padding:'16px 18px'}}>
                <p style={{fontSize:11,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:8}}>{c.label}</p>
                <p style={{fontFamily:'var(--mono)',fontSize:16,fontWeight:600,color:c.color}}>{c.value}</p>
              </div>
            ))}
          </div>

          {/* Aviso cenário */}
          {scenario!=='realistic'&&(
            <div style={{background:'var(--amber-dim,rgba(245,166,35,0.1))',border:'1px solid rgba(245,166,35,0.25)',borderRadius:10,padding:'10px 14px',marginBottom:16,fontSize:12,color:'var(--amber)'}}>
              {scenario==='pessimistic'
                ?'📉 Cenário pessimista: receitas 15% menores, despesas 15% maiores que a média'
                :'📈 Cenário otimista: receitas 10% maiores, despesas 10% menores que a média'}
            </div>
          )}

          {/* Gráfico de barras — receita vs despesa */}
          <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:14,padding:'20px 16px',marginBottom:14}}>
            <p style={{fontSize:11,color:'var(--text3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:16}}>
              Receita vs Despesa projetada
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
                <XAxis dataKey="label" tick={{fill:'var(--text3)',fontSize:11}} axisLine={false} tickLine={false}/>
                <YAxis tickFormatter={fmtK} tick={{fill:'var(--text3)',fontSize:11}} axisLine={false} tickLine={false} width={56}/>
                <Tooltip content={<CustomTooltip/>}/>
                <Legend wrapperStyle={{fontSize:12,color:'var(--text2)'}}/>
                <Bar dataKey="Receita"  fill="var(--green)" radius={[5,5,0,0]} maxBarSize={40}/>
                <Bar dataKey="Despesa"  fill="var(--red)"   radius={[5,5,0,0]} maxBarSize={40}/>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Gráfico de área — saldo acumulado */}
          <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:14,padding:'20px 16px',marginBottom:14}}>
            <p style={{fontSize:11,color:'var(--text3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:16}}>
              Evolução do saldo acumulado
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="gradBalance" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--indigo)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--indigo)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
                <XAxis dataKey="label" tick={{fill:'var(--text3)',fontSize:11}} axisLine={false} tickLine={false}/>
                <YAxis tickFormatter={fmtK} tick={{fill:'var(--text3)',fontSize:11}} axisLine={false} tickLine={false} width={56}/>
                <Tooltip content={<CustomTooltip/>}/>
                <Area dataKey="Acumulado" stroke="var(--indigo)" strokeWidth={2} fill="url(#gradBalance)" name="Acumulado"/>
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Tabela projetada mês a mês */}
          <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:14,overflow:'hidden',marginBottom:14}}>
            <div style={{padding:'14px 18px',borderBottom:'1px solid var(--border)'}}>
              <p style={{fontSize:11,color:'var(--text3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.07em'}}>Detalhamento mensal</p>
            </div>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                <thead>
                  <tr style={{background:'var(--bg3)'}}>
                    {['Mês','Receita proj.','Despesa proj.','Saldo mês','Acumulado'].map(h=>(
                      <th key={h} style={{padding:'10px 16px',textAlign:'right',fontSize:11,color:'var(--text3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em',whiteSpace:'nowrap',':first-child':{textAlign:'left'}}}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.projection.map((p,i)=>{
                    const bal = scenario==='pessimistic'?p.pessimistic:scenario==='optimistic'?p.optimistic:p.balance;
                    return(
                      <tr key={i} style={{borderTop:'1px solid var(--border)',transition:'background 0.15s'}}
                        onMouseOver={e=>e.currentTarget.style.background='var(--bg3)'}
                        onMouseOut={e=>e.currentTarget.style.background='transparent'}>
                        <td style={{padding:'12px 16px',color:'var(--text)',fontWeight:500}}>{p.label}</td>
                        <td style={{padding:'12px 16px',textAlign:'right',fontFamily:'var(--mono)',color:'var(--green)'}}>{fmt(p.income)}</td>
                        <td style={{padding:'12px 16px',textAlign:'right',fontFamily:'var(--mono)',color:'var(--red)'}}>{fmt(p.expense)}</td>
                        <td style={{padding:'12px 16px',textAlign:'right',fontFamily:'var(--mono)',color:bal>=0?'var(--indigo)':'var(--red)',fontWeight:600}}>{fmt(bal)}</td>
                        <td style={{padding:'12px 16px',textAlign:'right',fontFamily:'var(--mono)',color:p.accumulated>=0?'var(--text)':'var(--red)'}}>{fmt(p.accumulated)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Top categorias de gasto */}
          {data.by_category?.length>0&&(
            <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:14,padding:'18px 20px'}}>
              <p style={{fontSize:11,color:'var(--text3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:16}}>
                Maiores despesas projetadas/mês
              </p>
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {data.by_category.slice(0,5).map(cat=>{
                  const pct=data.avg_expense>0?Math.round(cat.avg_monthly/data.avg_expense*100):0;
                  return(
                    <div key={cat.category_id}>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <span style={{width:8,height:8,borderRadius:'50%',background:cat.color,display:'inline-block',flexShrink:0}}/>
                          <span style={{fontSize:13,color:'var(--text)'}}>{cat.name}</span>
                        </div>
                        <div style={{display:'flex',gap:12,alignItems:'center'}}>
                          <span style={{fontSize:11,color:'var(--text3)'}}>{pct}%</span>
                          <span style={{fontFamily:'var(--mono)',fontSize:13,fontWeight:500,color:'var(--red)'}}>{fmt(cat.avg_monthly)}</span>
                        </div>
                      </div>
                      <div style={{height:5,background:'var(--bg3)',borderRadius:99,overflow:'hidden'}}>
                        <div style={{height:'100%',width:`${pct}%`,background:cat.color,borderRadius:99,transition:'width 0.4s'}}/>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p style={{fontSize:11,color:'var(--text3)',marginTop:14,lineHeight:1.5}}>
                ⚠️ Projeção baseada na média dos últimos 3 meses + recorrentes ativas. Valores podem variar.
              </p>
            </div>
          )}

        </>)}
      </main>
    </div>
  );
}
