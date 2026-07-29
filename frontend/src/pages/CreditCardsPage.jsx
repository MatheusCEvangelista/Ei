import { useState, useEffect } from 'react';
import api from '../lib/api';
import Navbar from '../components/Navbar';
import CreditCardModal from '../components/CreditCardModal';
import CreditCardExpenseModal from '../components/CreditCardExpenseModal';
import CreditCardPayModal from '../components/CreditCardPayModal';

const fmt     = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v);
const fmtDate = d => new Date(d+'T00:00:00').toLocaleDateString('pt-BR');

function LimitBar({ used, limit, color }) {
  const pct  = limit > 0 ? Math.min(100, Math.round(used/limit*100)) : 0;
  const barColor = pct >= 90 ? 'var(--red)' : pct >= 70 ? 'var(--amber)' : color || 'var(--indigo)';
  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
        <span style={{fontSize:12,color:'var(--text3)'}}>Disponível: <span style={{color:'var(--green)',fontFamily:'var(--mono)',fontWeight:500}}>{fmt(limit-used)}</span></span>
        <span style={{fontSize:12,fontFamily:'var(--mono)',fontWeight:600,color:barColor}}>{pct}%</span>
      </div>
      <div style={{height:7,background:'var(--bg3)',borderRadius:99,overflow:'hidden'}}>
        <div style={{height:'100%',width:`${pct}%`,background:barColor,borderRadius:99,transition:'width 0.4s'}}/>
      </div>
      <p style={{fontSize:11,color:'var(--text3)',marginTop:4}}>Usado {fmt(used)} de {fmt(limit)}</p>
    </div>
  );
}

export default function CreditCardsPage() {
  const [cards,      setCards]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [modal,      setModal]      = useState(null); // null | 'card' | 'expense' | 'pay'
  const [selected,   setSelected]   = useState(null);
  const [editing,    setEditing]    = useState(null);
  const [expanded,   setExpanded]   = useState(null);
  const [invoiceTxs, setInvoiceTxs] = useState({});
  const [loadingTxs, setLoadingTxs] = useState({});

  async function load() {
    setLoading(true);
    try { const { data } = await api.get('/api/credit-cards'); setCards(data); }
    catch(e){ console.error(e); }
    setLoading(false);
  }
  useEffect(()=>{ load(); },[]);

  async function loadInvoiceTxs(card) {
    if (invoiceTxs[card.id]) return; // já carregado
    setLoadingTxs(p=>({...p,[card.id]:true}));
    try {
      const { data } = await api.get(`/api/credit-cards/${card.id}/transactions`, {
        params: { start: card.invoice_period.start, end: card.invoice_period.end }
      });
      setInvoiceTxs(p=>({...p,[card.id]:data}));
    } catch(e){ console.error(e); }
    setLoadingTxs(p=>({...p,[card.id]:false}));
  }

  function handleExpand(card) {
    const next = expanded===card.id ? null : card.id;
    setExpanded(next);
    if (next) loadInvoiceTxs(card);
  }

  async function handleDelete(id) {
    if (!confirm('Excluir este cartão? As transações vinculadas serão desvinculadas.')) return;
    await api.delete(`/api/credit-cards/${id}`);
    load();
  }

  const totalInvoice = cards.reduce((s,c)=>s+Number(c.invoice_total),0);
  const totalLimit   = cards.reduce((s,c)=>s+Number(c.limit_amount),0);

  return (
    <div style={{minHeight:'100vh',background:'var(--bg)'}}>
      <Navbar/>
      <main className="page-main" style={{maxWidth:780,margin:'0 auto',padding:'24px 16px 80px'}}>

        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:24,flexWrap:'wrap',gap:12}}>
          <div>
            <h1 style={{fontSize:20,fontWeight:600,letterSpacing:'-0.03em'}}>Cartões de crédito</h1>
            <p style={{color:'var(--text3)',fontSize:13,marginTop:4}}>Faturas e limites</p>
          </div>
          <button onClick={()=>{setEditing(null);setModal('card');}}
            style={{padding:'9px 16px',borderRadius:10,border:'none',background:'linear-gradient(135deg,var(--indigo),#a78bfa)',color:'#fff',fontFamily:'var(--font)',fontSize:13,fontWeight:600,cursor:'pointer'}}>
            ＋ Novo cartão
          </button>
        </div>

        {/* Resumo geral */}
        {cards.length > 0 && (
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:20}} className="grid-2col">
            <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:14,padding:'16px 18px'}}>
              <p style={{fontSize:11,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:8}}>Total em faturas</p>
              <p style={{fontFamily:'var(--mono)',fontSize:20,fontWeight:600,color:'var(--red)'}}>{fmt(totalInvoice)}</p>
            </div>
            <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:14,padding:'16px 18px'}}>
              <p style={{fontSize:11,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:8}}>Limite total</p>
              <p style={{fontFamily:'var(--mono)',fontSize:20,fontWeight:600,color:'var(--text)'}}>{fmt(totalLimit)}</p>
              <p style={{fontSize:11,color:'var(--green)',marginTop:4}}>Disponível: {fmt(totalLimit-totalInvoice)}</p>
            </div>
          </div>
        )}

        {loading ? (
          [1,2].map(i=><div key={i} className="skeleton" style={{height:220,borderRadius:14,marginBottom:12}}/>)
        ) : cards.length===0 ? (
          <div style={{textAlign:'center',padding:'60px 0',color:'var(--text3)',background:'var(--bg2)',borderRadius:14,border:'1px solid var(--border)'}}>
            <div style={{fontSize:40,marginBottom:12}}>💳</div>
            <p style={{fontSize:14,marginBottom:6}}>Nenhum cartão cadastrado.</p>
            <button onClick={()=>setModal('card')} style={{background:'none',border:'none',color:'var(--indigo)',fontSize:13,cursor:'pointer',fontFamily:'var(--font)'}}>Adicionar →</button>
          </div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            {cards.map(card=>{
              const isExpanded = expanded === card.id;
              const txs        = invoiceTxs[card.id] || [];
              const urgency    = card.due_day
                ? (()=>{ const today=new Date(); const due=new Date(today.getFullYear(),today.getMonth(),card.due_day); const diff=Math.ceil((due-today)/(1000*60*60*24)); return diff; })()
                : null;
              return (
                <div key={card.id} style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:14,overflow:'hidden'}} className="fade-up">

                  {/* Cabeçalho do cartão */}
                  <div style={{background:`linear-gradient(135deg, ${card.color}33, ${card.color}11)`,borderBottom:'1px solid var(--border)',padding:'20px 20px 16px'}}>
                    <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:14}}>
                      <div style={{display:'flex',alignItems:'center',gap:10}}>
                        <div style={{width:44,height:44,borderRadius:12,background:card.color+'33',border:`2px solid ${card.color}55`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>
                          {card.icon}
                        </div>
                        <div>
                          <p style={{fontSize:15,fontWeight:600,color:'var(--text)'}}>{card.name}</p>
                          <div style={{display:'flex',gap:8,marginTop:2,flexWrap:'wrap'}}>
                            {card.closing_day&&<span style={{fontSize:11,color:'var(--text3)'}}>Fecha dia {card.closing_day}</span>}
                            {card.due_day&&<span style={{fontSize:11,color:'var(--text3)'}}>· Vence dia {card.due_day}</span>}
                            {urgency!==null&&urgency<=10&&<span style={{fontSize:11,fontWeight:600,color:urgency<=3?'var(--red)':'var(--amber)',background:urgency<=3?'var(--red-dim)':'rgba(245,166,35,0.12)',borderRadius:5,padding:'1px 7px'}}>{urgency<=0?'Vence hoje!':urgency===1?'Vence amanhã':`Vence em ${urgency}d`}</span>}
                          </div>
                        </div>
                      </div>
                      <div style={{display:'flex',gap:6}}>
                        <button onClick={()=>{setSelected(card);setModal('expense');}} style={{fontSize:12,color:'var(--text2)',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:7,padding:'5px 10px',cursor:'pointer',fontFamily:'var(--font)'}}>+ Despesa</button>
                        <button onClick={()=>{setSelected(card);setModal('pay');}} style={{fontSize:12,color:'var(--green)',background:'var(--green-dim)',border:'none',borderRadius:7,padding:'5px 10px',cursor:'pointer',fontFamily:'var(--font)',fontWeight:600}}>Pagar fatura</button>
                        <button onClick={()=>{setEditing(card);setModal('card');}} style={{fontSize:12,color:'var(--indigo)',background:'var(--indigo-dim)',border:'none',borderRadius:7,padding:'5px 9px',cursor:'pointer',fontFamily:'var(--font)'}}>✏️</button>
                        <button onClick={()=>handleDelete(card.id)} style={{fontSize:12,color:'var(--red)',background:'var(--red-dim)',border:'none',borderRadius:7,padding:'5px 9px',cursor:'pointer',fontFamily:'var(--font)'}}>🗑</button>
                      </div>
                    </div>

                    {/* Fatura atual */}
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                      <div>
                        <p style={{fontSize:11,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:4}}>Fatura atual</p>
                        <p style={{fontFamily:'var(--mono)',fontSize:22,fontWeight:700,color:'var(--text)'}}>{fmt(card.invoice_total)}</p>
                      </div>
                      <div style={{textAlign:'right',fontSize:11,color:'var(--text3)'}}>
                        <p>{fmtDate(card.invoice_period.start)}</p>
                        <p>até {fmtDate(card.invoice_period.end)}</p>
                      </div>
                    </div>

                    {card.limit_amount > 0 && (
                      <LimitBar used={card.invoice_total} limit={card.limit_amount} color={card.color}/>
                    )}
                  </div>

                  {/* Breakdown por categoria */}
                  {card.invoice_by_category?.length > 0 && (
                    <div style={{padding:'12px 20px',borderBottom:'1px solid var(--border)'}}>
                      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                        {card.invoice_by_category.map(c=>(
                          <div key={c.name} style={{display:'flex',alignItems:'center',gap:6,background:'var(--bg3)',borderRadius:7,padding:'4px 10px'}}>
                            <span style={{width:6,height:6,borderRadius:'50%',background:c.color,display:'inline-block'}}/>
                            <span style={{fontSize:12,color:'var(--text2)'}}>{c.name}</span>
                            <span style={{fontFamily:'var(--mono)',fontSize:12,color:'var(--text)',fontWeight:500}}>{fmt(c.total)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Expandir transações */}
                  <button onClick={()=>handleExpand(card)} style={{width:'100%',padding:'11px 20px',background:'transparent',border:'none',cursor:'pointer',fontSize:12,color:'var(--text3)',fontFamily:'var(--font)',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
                    {isExpanded?'▲ Ocultar transações':'▼ Ver transações da fatura'}
                  </button>

                  {isExpanded && (
                    <div style={{borderTop:'1px solid var(--border)'}}>
                      {loadingTxs[card.id] ? (
                        <div style={{padding:14}}><div className="skeleton" style={{height:40}}/></div>
                      ) : txs.length===0 ? (
                        <p style={{textAlign:'center',color:'var(--text3)',fontSize:12,padding:'16px 0'}}>Nenhuma transação nesta fatura.</p>
                      ) : txs.map(tx=>(
                        <div key={tx.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 20px',borderBottom:'1px solid var(--border)'}}>
                          <div style={{display:'flex',alignItems:'center',gap:10,minWidth:0}}>
                            {tx.categories&&<span style={{width:8,height:8,borderRadius:'50%',background:tx.categories.color,display:'inline-block',flexShrink:0}}/>}
                            <div style={{minWidth:0}}>
                              <p className="text-truncate" style={{fontSize:13,color:'var(--text)'}}>{tx.description||tx.categories?.name||'—'}</p>
                              <p style={{fontSize:11,color:'var(--text3)',marginTop:1}}>{fmtDate(tx.date)}{tx.categories&&` · ${tx.categories.name}`}</p>
                            </div>
                          </div>
                          <span style={{fontFamily:'var(--mono)',fontSize:13,color:'var(--red)',fontWeight:500,flexShrink:0,marginLeft:8}}>-{fmt(tx.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {modal==='card'    && <CreditCardModal card={editing} onClose={()=>{setModal(null);setEditing(null);}} onSave={()=>{setModal(null);setEditing(null);load();}}/>}
      {modal==='expense' && selected && <CreditCardExpenseModal card={selected} onClose={()=>setModal(null)} onSave={()=>{setModal(null);setInvoiceTxs({});load();}}/>}
      {modal==='pay'     && selected && <CreditCardPayModal card={selected} onClose={()=>setModal(null)} onSave={()=>{setModal(null);load();}}/>}
    </div>
  );
}
