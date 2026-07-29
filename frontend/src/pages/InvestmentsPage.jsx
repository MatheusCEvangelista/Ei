import { useState, useEffect } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import api from '../lib/api';
import Navbar from '../components/Navbar';
import InvestmentModal from '../components/InvestmentModal';
import EntryModal from '../components/EntryModal';

const fmt    = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v);
const fmtQty = v => new Intl.NumberFormat('pt-BR',{maximumFractionDigits:8}).format(v);
const fmtPct = v => `${v>=0?'+':''}${v.toFixed(2)}%`;
const fmtDate= d => new Date(d+'T00:00:00').toLocaleDateString('pt-BR');
const fmtK   = v => Math.abs(v)>=1000?`R$${(v/1000).toFixed(1)}k`:fmt(v);

const TYPE_META = {
  stocks:       { label:'Ações',     icon:'📈', color:'#7c7ff7' },
  fiis:         { label:'FIIs',      icon:'🏢', color:'#06b6d4' },
  crypto:       { label:'Cripto',    icon:'₿',  color:'#f5a623' },
  fixed_income: { label:'Renda Fixa',icon:'🏦', color:'#2dd4a0' },
  treasury:     { label:'Tesouro',   icon:'🏛',  color:'#a78bfa' },
};

async function fetchPrice(ticker, type) {
  try {
    if (type==='crypto') {
      const map={BTC:'bitcoin',ETH:'ethereum',BNB:'binancecoin',SOL:'solana',USDT:'tether'};
      const id=map[ticker?.toUpperCase()]||ticker?.toLowerCase();
      const r=await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=brl`);
      const d=await r.json(); return d[id]?.brl||null;
    } else if (['stocks','fiis'].includes(type)&&ticker) {
      const r=await fetch(`https://brapi.dev/api/quote/${ticker}?token=demo`);
      const d=await r.json(); return d.results?.[0]?.regularMarketPrice||null;
    }
  } catch { return null; }
  return null;
}

const ChartTooltip = ({active,payload,label}) => {
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

export default function InvestmentsPage() {
  const [investments,   setInvestments]   = useState([]);
  const [prices,        setPrices]        = useState({});
  const [evolution,     setEvolution]     = useState(null);
  const [evoMonths,     setEvoMonths]     = useState(12);
  const [loading,       setLoading]       = useState(true);
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [loadingEvo,    setLoadingEvo]    = useState(false);
  const [showModal,     setShowModal]     = useState(false);
  const [showEntry,     setShowEntry]     = useState(false);
  const [editing,       setEditing]       = useState(null);
  const [selectedInv,   setSelectedInv]   = useState(null);
  const [expandedId,    setExpandedId]    = useState(null);

  async function load() {
    setLoading(true);
    const { data } = await api.get('/api/investments');
    setInvestments(data);
    setLoading(false);
    loadPrices(data);
  }

  async function loadPrices(invs) {
    setLoadingPrices(true);
    const newPrices = {};
    await Promise.all(
      invs.filter(i=>i.ticker&&['stocks','fiis','crypto'].includes(i.type)).map(async inv=>{
        const price = await fetchPrice(inv.ticker, inv.type);
        if (price) newPrices[inv.id] = price;
      })
    );
    setPrices(newPrices);
    setLoadingPrices(false);
  }

  async function loadEvolution() {
    setLoadingEvo(true);
    try {
      const { data } = await api.get(`/api/investments/evolution?months=${evoMonths}`);
      setEvolution(data);
    } catch(e){ console.error(e); }
    setLoadingEvo(false);
  }

  useEffect(()=>{ load(); },[]);
  useEffect(()=>{ loadEvolution(); },[evoMonths]);

  async function handleDelete(id) {
    if (!confirm('Excluir este investimento e todos os aportes?')) return;
    await api.delete(`/api/investments/${id}`);
    load(); loadEvolution();
  }

  async function handleDeleteEntry(invId, entryId) {
    if (!confirm('Excluir este aporte?')) return;
    await api.delete(`/api/investments/${invId}/entries/${entryId}`);
    load(); loadEvolution();
  }

  // Totais
  const totalInvested = investments.reduce((s,i)=>{
    if(['fixed_income','treasury'].includes(i.type)) return s+Number(i.initial_amount||0);
    return s+Number(i.quantity)*Number(i.avg_price);
  },0);
  const totalCurrent = investments.reduce((s,i)=>{
    if(['fixed_income','treasury'].includes(i.type)) return s+Number(i.calculated_current_value||i.initial_amount||0);
    const price=prices[i.id];
    return s+(price?Number(i.quantity)*price:Number(i.quantity)*Number(i.avg_price));
  },0);
  const totalPnl = totalCurrent-totalInvested;
  const totalPct = totalInvested>0?(totalPnl/totalInvested)*100:0;

  const byType = {};
  investments.forEach(inv=>{ if(!byType[inv.type]) byType[inv.type]=[]; byType[inv.type].push(inv); });

  return (
    <div style={{minHeight:'100vh',background:'var(--bg)'}}>
      <Navbar/>
      <main className="page-main" style={{maxWidth:860,margin:'0 auto',padding:'24px 16px 80px'}}>

        {/* Header */}
        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:24,flexWrap:'wrap',gap:12}}>
          <div>
            <h1 style={{fontSize:20,fontWeight:600,letterSpacing:'-0.03em'}}>Investimentos</h1>
            <p style={{color:'var(--text3)',fontSize:13,marginTop:4}}>Carteira consolidada</p>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={()=>loadPrices(investments)} disabled={loadingPrices}
              style={{padding:'9px 14px',borderRadius:10,border:'1px solid var(--border)',background:'var(--bg2)',color:'var(--text2)',fontFamily:'var(--font)',fontSize:13,cursor:'pointer'}}>
              {loadingPrices?'⏳':'↺'} Cotações
            </button>
            <button onClick={()=>setShowModal(true)}
              style={{padding:'9px 16px',borderRadius:10,border:'none',background:'linear-gradient(135deg,var(--indigo),#a78bfa)',color:'#fff',fontFamily:'var(--font)',fontSize:13,fontWeight:600,cursor:'pointer'}}>
              ＋ Novo
            </button>
          </div>
        </div>

        {/* Cards resumo */}
        <div className="summary-grid" style={{display:'grid',gap:12,marginBottom:20}}>
          {[
            {label:'Total investido', value:fmt(totalInvested), color:'var(--text)'},
            {label:'Valor atual',     value:fmt(totalCurrent),  color:'var(--indigo)'},
            {label:'Rentabilidade',   value:`${fmt(totalPnl)} (${fmtPct(totalPct)})`, color:totalPnl>=0?'var(--green)':'var(--red)'},
          ].map(c=>(
            <div key={c.label} style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:14,padding:'16px 18px'}}>
              <p style={{fontSize:11,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8}}>{c.label}</p>
              <p style={{fontFamily:'var(--mono)',fontSize:16,fontWeight:600,color:c.color}}>{c.value}</p>
            </div>
          ))}
        </div>

        {/* ── Gráfico de evolução ── */}
        <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:14,padding:'20px 18px',marginBottom:20}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16,flexWrap:'wrap',gap:8}}>
            <p style={{fontSize:11,color:'var(--text3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.07em'}}>Evolução da carteira</p>
            <div style={{display:'flex',background:'var(--bg3)',borderRadius:8,padding:2,border:'1px solid var(--border)'}}>
              {[6,12,24].map(m=>(
                <button key={m} onClick={()=>setEvoMonths(m)} style={{padding:'5px 12px',borderRadius:6,fontSize:12,fontWeight:500,border:'none',cursor:'pointer',fontFamily:'var(--font)',transition:'all 0.15s',background:evoMonths===m?'var(--bg2)':'transparent',color:evoMonths===m?'var(--indigo)':'var(--text3)'}}>
                  {m}m
                </button>
              ))}
            </div>
          </div>

          {loadingEvo ? (
            <div className="skeleton" style={{height:200}}/>
          ) : !evolution?.points?.length ? (
            <div style={{height:200,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text3)',fontSize:13}}>
              Adicione aportes para ver a evolução
            </div>
          ) : (<>
            {/* Mini cards de evolução */}
            {evolution.gain !== 0 && (
              <div style={{display:'flex',gap:12,marginBottom:16,flexWrap:'wrap'}}>
                {[
                  {label:'Investido (custo)',    value:fmt(evolution.total_invested),  color:'var(--text2)'},
                  {label:'Valor estimado',       value:fmt(evolution.total_estimated), color:'var(--indigo)'},
                  {label:'Rendimento (RF)',       value:`${fmt(evolution.gain)} (${evolution.gain_pct}%)`, color:evolution.gain>=0?'var(--green)':'var(--red)'},
                ].map(c=>(
                  <div key={c.label} style={{flex:1,minWidth:140,background:'var(--bg3)',borderRadius:9,padding:'10px 12px'}}>
                    <p style={{fontSize:10,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:4}}>{c.label}</p>
                    <p style={{fontFamily:'var(--mono)',fontSize:13,fontWeight:600,color:c.color}}>{c.value}</p>
                  </div>
                ))}
              </div>
            )}

            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={evolution.points} margin={{top:4,right:4,left:0,bottom:0}}>
                <defs>
                  <linearGradient id="gradInvested" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--text3)" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="var(--text3)" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="gradEstimated" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--indigo)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--indigo)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
                <XAxis dataKey="label" tick={{fill:'var(--text3)',fontSize:10}} axisLine={false} tickLine={false}/>
                <YAxis tickFormatter={fmtK} tick={{fill:'var(--text3)',fontSize:10}} axisLine={false} tickLine={false} width={52}/>
                <Tooltip content={<ChartTooltip/>}/>
                <Legend wrapperStyle={{fontSize:11,color:'var(--text2)'}}/>
                <Area dataKey="invested"  name="Investido"  stroke="var(--text3)"  strokeWidth={1.5} fill="url(#gradInvested)"  strokeDasharray="4 2"/>
                <Area dataKey="estimated" name="Estimado"   stroke="var(--indigo)" strokeWidth={2}   fill="url(#gradEstimated)"/>
              </AreaChart>
            </ResponsiveContainer>
            <p style={{fontSize:10,color:'var(--text3)',marginTop:8,textAlign:'center'}}>
              * Estimado = custo para ativos variáveis (sem dados históricos de preço) + juros compostos para Renda Fixa/Tesouro
            </p>
          </>)}
        </div>

        {/* ── Lista de ativos ── */}
        {loading ? (
          [1,2,3].map(i=><div key={i} className="skeleton" style={{height:72,borderRadius:14,marginBottom:10}}/>)
        ) : investments.length===0 ? (
          <div style={{textAlign:'center',padding:'50px 0',color:'var(--text3)'}}>
            <div style={{fontSize:40,marginBottom:12}}>📈</div>
            <p style={{fontSize:14}}>Nenhum investimento cadastrado.</p>
            <button onClick={()=>setShowModal(true)} style={{marginTop:12,background:'none',border:'none',color:'var(--indigo)',fontSize:13,cursor:'pointer',fontFamily:'var(--font)'}}>Adicionar →</button>
          </div>
        ) : (
          Object.entries(byType).map(([type,invs])=>{
            const meta=TYPE_META[type]||{label:type,icon:'💰',color:'#7c7ff7'};
            return(
              <div key={type} style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:14,overflow:'hidden',marginBottom:14}}>
                <div style={{display:'flex',alignItems:'center',gap:8,padding:'12px 18px',borderBottom:'1px solid var(--border)',background:'var(--bg3)'}}>
                  <span style={{fontSize:16}}>{meta.icon}</span>
                  <span style={{fontSize:12,fontWeight:600,color:meta.color,textTransform:'uppercase',letterSpacing:'0.06em'}}>{meta.label}</span>
                  <span style={{fontSize:11,color:'var(--text3)',marginLeft:4}}>{invs.length} ativo{invs.length!==1?'s':''}</span>
                </div>
                {invs.map(inv=>{
                  const isFixed=['fixed_income','treasury'].includes(inv.type);
                  const invested=isFixed?Number(inv.initial_amount||0):Number(inv.quantity)*Number(inv.avg_price);
                  const current=isFixed?Number(inv.calculated_current_value||inv.initial_amount||0):(prices[inv.id]?Number(inv.quantity)*prices[inv.id]:invested);
                  const pnl=current-invested;
                  const pct=invested>0?(pnl/invested)*100:0;
                  const isExpanded=expandedId===inv.id;
                  return(
                    <div key={inv.id}>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 18px',borderBottom:'1px solid var(--border)',cursor:'pointer',transition:'background 0.15s'}}
                        onMouseOver={e=>e.currentTarget.style.background='var(--bg3)'}
                        onMouseOut={e=>e.currentTarget.style.background='transparent'}
                        onClick={()=>setExpandedId(isExpanded?null:inv.id)}>
                        <div style={{display:'flex',alignItems:'center',gap:12,minWidth:0}}>
                          <div style={{width:36,height:36,borderRadius:9,background:meta.color+'22',border:`1px solid ${meta.color}44`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:meta.color,fontFamily:'var(--mono)',flexShrink:0}}>
                            {inv.ticker?inv.ticker.slice(0,3):meta.icon}
                          </div>
                          <div style={{minWidth:0}}>
                            <p className="text-truncate" style={{fontSize:13,fontWeight:500,color:'var(--text)'}}>{inv.name}</p>
                            <p style={{fontSize:11,color:'var(--text3)',marginTop:1}}>
                              {isFixed
                                ?`${inv.rate}% ${inv.rate_period==='yearly'?'a.a.':'a.m.'} · Invest.: ${fmt(inv.initial_amount)}`
                                :`${fmtQty(inv.quantity)} un · PM ${fmt(inv.avg_price)}${prices[inv.id]?` · Atual ${fmt(prices[inv.id])}`:loadingPrices&&inv.ticker?' · ⏳':''}`}
                            </p>
                          </div>
                        </div>
                        <div style={{display:'flex',alignItems:'center',gap:10,flexShrink:0,marginLeft:8}}>
                          <div style={{textAlign:'right'}}>
                            <p style={{fontFamily:'var(--mono)',fontSize:13,fontWeight:600,color:'var(--text)'}}>{fmt(current)}</p>
                            <p style={{fontFamily:'var(--mono)',fontSize:11,color:pnl>=0?'var(--green)':'var(--red)'}}>
                              {pnl>=0?'+':''}{fmt(pnl)} ({fmtPct(pct)})
                            </p>
                          </div>
                          <div style={{display:'flex',gap:5}} onClick={e=>e.stopPropagation()}>
                            {!isFixed&&(
                              <button onClick={()=>{setSelectedInv(inv);setShowEntry(true);}} style={{fontSize:11,color:'var(--green)',background:'var(--green-dim)',border:'none',borderRadius:6,padding:'4px 9px',cursor:'pointer',fontFamily:'var(--font)'}}>+Aporte</button>
                            )}
                            <button onClick={()=>{setEditing(inv);setShowModal(true);}} style={{fontSize:11,color:'var(--indigo)',background:'var(--indigo-dim)',border:'none',borderRadius:6,padding:'4px 9px',cursor:'pointer',fontFamily:'var(--font)'}}>Editar</button>
                            <button onClick={()=>handleDelete(inv.id)} style={{fontSize:11,color:'var(--red)',background:'var(--red-dim)',border:'none',borderRadius:6,padding:'4px 9px',cursor:'pointer',fontFamily:'var(--font)'}}>Excluir</button>
                          </div>
                        </div>
                      </div>

                      {/* Detalhes expandidos */}
                      {isExpanded&&(
                        <div style={{background:'var(--bg)',borderBottom:'1px solid var(--border)',padding:'12px 18px'}}>
                          {isFixed&&inv.maturity_date&&(
                            <div style={{display:'flex',gap:20,marginBottom:10,flexWrap:'wrap'}}>
                              <div><p style={{fontSize:10,color:'var(--text3)'}}>Vencimento</p><p style={{fontSize:13,color:'var(--text)',marginTop:2}}>{fmtDate(inv.maturity_date)}</p></div>
                              <div><p style={{fontSize:10,color:'var(--text3)'}}>Investido</p><p style={{fontFamily:'var(--mono)',fontSize:13,color:'var(--text)',marginTop:2}}>{fmt(inv.initial_amount)}</p></div>
                              <div><p style={{fontSize:10,color:'var(--text3)'}}>Valor atual</p><p style={{fontFamily:'var(--mono)',fontSize:13,color:'var(--green)',marginTop:2}}>{fmt(inv.calculated_current_value||inv.initial_amount)}</p></div>
                              <div><p style={{fontSize:10,color:'var(--text3)'}}>Rendimento</p><p style={{fontFamily:'var(--mono)',fontSize:13,color:'var(--green)',marginTop:2}}>+{fmt((inv.calculated_current_value||0)-(inv.initial_amount||0))}</p></div>
                            </div>
                          )}
                          {!isFixed&&(
                            <>
                              <p style={{fontSize:11,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8}}>Histórico de aportes</p>
                              {!inv.investment_entries?.length?(
                                <p style={{fontSize:12,color:'var(--text3)',textAlign:'center',padding:'8px 0'}}>Nenhum aporte registrado.</p>
                              ):(
                                <div style={{display:'flex',flexDirection:'column',gap:4}}>
                                  {[...inv.investment_entries].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(entry=>(
                                    <div key={entry.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'6px 8px',borderRadius:8,background:'var(--bg2)'}}>
                                      <div style={{display:'flex',gap:12,fontSize:12,flexWrap:'wrap'}}>
                                        <span style={{color:'var(--text3)',fontFamily:'var(--mono)'}}>{fmtDate(entry.date)}</span>
                                        <span style={{color:'var(--text2)'}}>{fmtQty(entry.quantity)} un</span>
                                        <span style={{color:'var(--text2)'}}>@ {fmt(entry.price)}</span>
                                        <span style={{color:'var(--indigo)',fontFamily:'var(--mono)',fontWeight:500}}>{fmt(entry.quantity*entry.price)}</span>
                                      </div>
                                      <button onClick={()=>handleDeleteEntry(inv.id,entry.id)} style={{fontSize:11,color:'var(--red)',background:'var(--red-dim)',border:'none',borderRadius:5,padding:'3px 8px',cursor:'pointer',fontFamily:'var(--font)',flexShrink:0}}>Excluir</button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </main>

      {showModal&&<InvestmentModal investment={editing} onClose={()=>{setShowModal(false);setEditing(null);}} onSave={()=>{setShowModal(false);setEditing(null);load();loadEvolution();}}/>}
      {showEntry&&selectedInv&&<EntryModal investment={selectedInv} onClose={()=>{setShowEntry(false);setSelectedInv(null);}} onSave={()=>{setShowEntry(false);setSelectedInv(null);load();loadEvolution();}}/>}
    </div>
  );
}
