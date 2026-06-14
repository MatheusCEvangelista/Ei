import { useState, useEffect } from 'react';
import api from '../lib/api';
import Navbar from '../components/Navbar';
import InvestmentModal from '../components/InvestmentModal';
import EntryModal from '../components/EntryModal';

const fmt    = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v);
const fmtQty = v => new Intl.NumberFormat('pt-BR',{maximumFractionDigits:8}).format(v);
const fmtPct = v => `${v>=0?'+':''}${v.toFixed(2)}%`;
const fmtDate= d => new Date(d+'T00:00:00').toLocaleDateString('pt-BR');

const TYPE_META = {
  stocks:       { label:'Ações',     icon:'📈', color:'#7c7ff7' },
  fiis:         { label:'FIIs',      icon:'🏢', color:'#06b6d4' },
  crypto:       { label:'Cripto',    icon:'₿',  color:'#f5a623' },
  fixed_income: { label:'Renda Fixa',icon:'🏦', color:'#2dd4a0' },
  treasury:     { label:'Tesouro',   icon:'🏛',  color:'#a78bfa' },
};

async function fetchPrice(ticker, type) {
  try {
    if (type === 'crypto') {
      const map = { BTC:'bitcoin', ETH:'ethereum', BNB:'binancecoin', SOL:'solana', USDT:'tether' };
      const id  = map[ticker?.toUpperCase()] || ticker?.toLowerCase();
      const r   = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=brl`);
      const d   = await r.json();
      return d[id]?.brl || null;
    } else if (['stocks','fiis'].includes(type) && ticker) {
      const r = await fetch(`https://brapi.dev/api/quote/${ticker}?token=demo`);
      const d = await r.json();
      return d.results?.[0]?.regularMarketPrice || null;
    }
  } catch { return null; }
  return null;
}

export default function InvestmentsPage() {
  const [investments, setInvestments] = useState([]);
  const [prices,      setPrices]      = useState({});
  const [loading,     setLoading]     = useState(true);
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [showModal,   setShowModal]   = useState(false);
  const [showEntry,   setShowEntry]   = useState(false);
  const [editing,     setEditing]     = useState(null);
  const [selectedInv, setSelectedInv] = useState(null);
  const [expandedId,  setExpandedId]  = useState(null);

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
      invs.filter(i => i.ticker && ['stocks','fiis','crypto'].includes(i.type)).map(async inv => {
        const price = await fetchPrice(inv.ticker, inv.type);
        if (price) newPrices[inv.id] = price;
      })
    );
    setPrices(newPrices);
    setLoadingPrices(false);
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id) {
    if (!confirm('Excluir este investimento e todos os aportes?')) return;
    await api.delete(`/api/investments/${id}`);
    load();
  }

  async function handleDeleteEntry(invId, entryId) {
    if (!confirm('Excluir este aporte?')) return;
    await api.delete(`/api/investments/${invId}/entries/${entryId}`);
    load();
  }

  // Totais consolidados
  const totalInvested = investments.reduce((s, i) => {
    if (['fixed_income','treasury'].includes(i.type)) return s + Number(i.initial_amount || 0);
    return s + Number(i.quantity) * Number(i.avg_price);
  }, 0);

  const totalCurrent = investments.reduce((s, i) => {
    if (['fixed_income','treasury'].includes(i.type)) return s + Number(i.calculated_current_value || i.initial_amount || 0);
    const price = prices[i.id];
    return s + (price ? Number(i.quantity) * price : Number(i.quantity) * Number(i.avg_price));
  }, 0);

  const totalPnl = totalCurrent - totalInvested;
  const totalPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

  const byType = {};
  investments.forEach(inv => {
    if (!byType[inv.type]) byType[inv.type] = [];
    byType[inv.type].push(inv);
  });

  return (
    <div style={{minHeight:'100vh',background:'var(--bg)'}}>
      <Navbar/>
      <main className="page-main" style={{maxWidth:800,margin:'0 auto',padding:'24px 16px 80px'}}>

        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:24,flexWrap:'wrap',gap:12}}>
          <div>
            <h1 style={{fontSize:20,fontWeight:600,letterSpacing:'-0.03em'}}>Investimentos</h1>
            <p style={{color:'var(--text3)',fontSize:13,marginTop:4}}>Carteira consolidada</p>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={()=>loadPrices(investments)} disabled={loadingPrices} style={{padding:'9px 14px',borderRadius:10,border:'1px solid var(--border)',background:'var(--bg2)',color:'var(--text2)',fontFamily:'var(--font)',fontSize:13,cursor:'pointer'}}>
              {loadingPrices?'⏳':'↺'} Cotações
            </button>
            <button onClick={()=>setShowModal(true)} style={{padding:'9px 16px',borderRadius:10,border:'none',background:'linear-gradient(135deg,var(--indigo),#a78bfa)',color:'#fff',fontFamily:'var(--font)',fontSize:13,fontWeight:600,cursor:'pointer'}}>＋ Novo</button>
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

        {loading ? (
          [1,2,3].map(i=><div key={i} className="skeleton" style={{height:72,borderRadius:14,marginBottom:10}}/>)
        ) : investments.length===0 ? (
          <div style={{textAlign:'center',padding:'60px 0',color:'var(--text3)'}}>
            <div style={{fontSize:40,marginBottom:12}}>📈</div>
            <p style={{fontSize:14}}>Nenhum investimento cadastrado.</p>
            <button onClick={()=>setShowModal(true)} style={{marginTop:12,background:'none',border:'none',color:'var(--indigo)',fontSize:13,cursor:'pointer',fontFamily:'var(--font)'}}>Adicionar primeiro →</button>
          </div>
        ) : (
          Object.entries(byType).map(([type, invs]) => {
            const meta = TYPE_META[type] || { label:type, icon:'💰', color:'#7c7ff7' };
            return (
              <div key={type} style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:14,overflow:'hidden',marginBottom:14}}>
                <div style={{display:'flex',alignItems:'center',gap:8,padding:'12px 18px',borderBottom:'1px solid var(--border)',background:'var(--bg3)'}}>
                  <span style={{fontSize:16}}>{meta.icon}</span>
                  <span style={{fontSize:12,fontWeight:600,color:meta.color,textTransform:'uppercase',letterSpacing:'0.06em'}}>{meta.label}</span>
                  <span style={{fontSize:11,color:'var(--text3)',marginLeft:4}}>{invs.length} ativo{invs.length!==1?'s':''}</span>
                </div>

                {invs.map(inv => {
                  const isFixed = ['fixed_income','treasury'].includes(inv.type);
                  const invested = isFixed ? Number(inv.initial_amount||0) : Number(inv.quantity)*Number(inv.avg_price);
                  const current  = isFixed ? Number(inv.calculated_current_value||inv.initial_amount||0) : (prices[inv.id]?Number(inv.quantity)*prices[inv.id]:invested);
                  const pnl      = current - invested;
                  const pct      = invested > 0 ? (pnl/invested)*100 : 0;
                  const isExpanded = expandedId===inv.id;

                  return (
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
                                ? `${inv.rate}% ${inv.rate_period==='yearly'?'a.a.':'a.m.'} · Invest.: ${fmt(inv.initial_amount)}`
                                : `${fmtQty(inv.quantity)} un · PM ${fmt(inv.avg_price)}${prices[inv.id]?` · Atual ${fmt(prices[inv.id])}`:loadingPrices&&inv.ticker?' · ⏳':''}`
                              }
                            </p>
                          </div>
                        </div>
                        <div style={{display:'flex',alignItems:'center',gap:12,flexShrink:0,marginLeft:8}}>
                          <div style={{textAlign:'right'}}>
                            <p style={{fontFamily:'var(--mono)',fontSize:13,fontWeight:600,color:'var(--text)'}}>{fmt(current)}</p>
                            <p style={{fontFamily:'var(--mono)',fontSize:11,color:pnl>=0?'var(--green)':'var(--red)'}}>
                              {pnl>=0?'+':''}{fmt(pnl)} ({fmtPct(pct)})
                            </p>
                          </div>
                          <div style={{display:'flex',gap:6}} onClick={e=>e.stopPropagation()}>
                            {!isFixed&&(
                              <button onClick={()=>{setSelectedInv(inv);setShowEntry(true);}} style={{fontSize:12,color:'var(--green)',background:'var(--green-dim)',border:'none',borderRadius:6,padding:'4px 10px',cursor:'pointer',fontFamily:'var(--font)'}}>+ Aporte</button>
                            )}
                            <button onClick={()=>{setEditing(inv);setShowModal(true);}} style={{fontSize:12,color:'var(--indigo)',background:'var(--indigo-dim)',border:'none',borderRadius:6,padding:'4px 10px',cursor:'pointer',fontFamily:'var(--font)'}}>Editar</button>
                            <button onClick={()=>handleDelete(inv.id)} style={{fontSize:12,color:'var(--red)',background:'var(--red-dim)',border:'none',borderRadius:6,padding:'4px 10px',cursor:'pointer',fontFamily:'var(--font)'}}>Excluir</button>
                          </div>
                        </div>
                      </div>

                      {/* Vencimento renda fixa */}
                      {isExpanded && isFixed && inv.maturity_date && (
                        <div style={{background:'var(--bg)',borderBottom:'1px solid var(--border)',padding:'12px 18px',display:'flex',gap:20}}>
                          <div><p style={{fontSize:11,color:'var(--text3)'}}>Vencimento</p><p style={{fontSize:13,color:'var(--text)',marginTop:2}}>{fmtDate(inv.maturity_date)}</p></div>
                          <div><p style={{fontSize:11,color:'var(--text3)'}}>Investido</p><p style={{fontFamily:'var(--mono)',fontSize:13,color:'var(--text)',marginTop:2}}>{fmt(inv.initial_amount)}</p></div>
                          <div><p style={{fontSize:11,color:'var(--text3)'}}>Valor atual</p><p style={{fontFamily:'var(--mono)',fontSize:13,color:'var(--green)',marginTop:2}}>{fmt(inv.calculated_current_value||inv.initial_amount)}</p></div>
                          <div><p style={{fontSize:11,color:'var(--text3)'}}>Rendimento</p><p style={{fontFamily:'var(--mono)',fontSize:13,color:'var(--green)',marginTop:2}}>+{fmt((inv.calculated_current_value||0)-(inv.initial_amount||0))}</p></div>
                        </div>
                      )}

                      {/* Histórico aportes */}
                      {isExpanded && !isFixed && (
                        <div style={{background:'var(--bg)',borderBottom:'1px solid var(--border)',padding:'12px 18px'}}>
                          <p style={{fontSize:11,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:10}}>Histórico de aportes</p>
                          {!inv.investment_entries?.length ? (
                            <p style={{fontSize:12,color:'var(--text3)',textAlign:'center',padding:'8px 0'}}>Nenhum aporte registrado.</p>
                          ) : (
                            <div style={{display:'flex',flexDirection:'column',gap:4}}>
                              {[...inv.investment_entries].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(entry=>(
                                <div key={entry.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'6px 8px',borderRadius:8,background:'var(--bg2)'}}>
                                  <div style={{display:'flex',gap:14,fontSize:12,flexWrap:'wrap'}}>
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

      {showModal && <InvestmentModal investment={editing} onClose={()=>{setShowModal(false);setEditing(null);}} onSave={()=>{setShowModal(false);setEditing(null);load();}}/>}
      {showEntry && selectedInv && <EntryModal investment={selectedInv} onClose={()=>{setShowEntry(false);setSelectedInv(null);}} onSave={()=>{setShowEntry(false);setSelectedInv(null);load();}}/>}
    </div>
  );
}
