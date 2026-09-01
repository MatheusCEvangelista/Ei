import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import MonthSelector from '../components/MonthSelector';
import TransactionModal from '../components/TransactionModal';
import ImportModal from '../components/ImportModal';
import { Card, SkeletonList, EmptyState, Button, SectionLabel, Badge } from '../components/ui';
import api from '../lib/api';

const fmt = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);
const fmtDate = d => new Date(d+'T00:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short'});

// ── Mini gráfico de barra inline ─────────────────────────────────────────
function MiniBar({ pct, color }) {
  return (
    <div style={{height:4,background:'var(--bg3)',borderRadius:'var(--radius-full)',overflow:'hidden',marginTop:6}}>
      <div style={{height:'100%',width:`${Math.min(100,pct)}%`,background:color,borderRadius:'var(--radius-full)',transition:'width 0.6s ease'}}/>
    </div>
  );
}

// ── Card de insight ───────────────────────────────────────────────────────
function InsightCard({ insight, onClick }) {
  if (!insight) return null;
  return (
    <div onClick={()=>onClick&&insight.action&&onClick(insight.action.url)}
      style={{
        background:'var(--bg2)', border:'1px solid var(--border)',
        borderRadius:'var(--radius-lg)', padding:'var(--space-4)',
        cursor:insight.action?'pointer':'default',
        transition:'transform var(--transition), box-shadow var(--transition)',
        flex:1, minWidth:0,
      }}
      onMouseOver={e=>{if(insight.action){e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='var(--shadow)';}}}
      onMouseOut={e=>{e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow='none';}}>
      <div style={{display:'flex',alignItems:'flex-start',gap:'var(--space-2)',marginBottom:'var(--space-2)'}}>
        <span style={{fontSize:20,flexShrink:0,lineHeight:1.3}}>{insight.icon}</span>
        <p style={{fontSize:'var(--text-sm)',fontWeight:'var(--font-semibold)',color:'var(--text)',lineHeight:1.3}}>{insight.title}</p>
      </div>
      <p style={{fontSize:'var(--text-xs)',color:'var(--text3)',lineHeight:1.5,marginBottom:insight.action?'var(--space-2)':0}}>{insight.body}</p>
      {insight.action && (
        <span style={{fontSize:'var(--text-xs)',fontWeight:'var(--font-semibold)',color:'var(--indigo)',background:'var(--indigo-dim)',borderRadius:'var(--radius-sm)',padding:'2px 8px',display:'inline-block'}}>
          {insight.action.label} →
        </span>
      )}
    </div>
  );
}

// ── Linha de transação compacta ───────────────────────────────────────────
function TxRow({ tx, onEdit, onDelete }) {
  const isIncome = tx.type === 'income';
  return (
    <div className="tx-row" style={{display:'flex',alignItems:'center',gap:'var(--space-3)',padding:'var(--space-2) var(--space-1)',borderRadius:'var(--radius-md)',transition:'background var(--transition)',cursor:'default'}}
      onMouseEnter={e=>e.currentTarget.style.background='var(--bg3)'}
      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
      {/* Ícone */}
      <div style={{width:32,height:32,borderRadius:'var(--radius-sm)',flexShrink:0,background:isIncome?'var(--green-dim)':'var(--red-dim)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:'var(--font-bold)',color:isIncome?'var(--green)':'var(--red)'}}>
        {isIncome?'↑':'↓'}
      </div>
      {/* Info */}
      <div style={{flex:1,minWidth:0}}>
        <p style={{fontSize:'var(--text-sm)',fontWeight:'var(--font-medium)',color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
          {tx.description||tx.categories?.name||'—'}
        </p>
        <div style={{display:'flex',alignItems:'center',gap:'var(--space-1)',marginTop:1}}>
          {tx.categories && (
            <span style={{width:5,height:5,borderRadius:'50%',background:tx.categories.color,display:'inline-block',flexShrink:0}}/>
          )}
          <span style={{fontSize:'var(--text-xs)',color:'var(--text3)'}}>{fmtDate(tx.date)}</span>
        </div>
      </div>
      {/* Valor + ações */}
      <div style={{display:'flex',alignItems:'center',gap:'var(--space-2)',flexShrink:0}}>
        <span style={{fontFamily:'var(--mono)',fontSize:'var(--text-sm)',fontWeight:'var(--font-semibold)',color:isIncome?'var(--green)':'var(--red)'}}>
          {isIncome?'+':'-'}{fmt(tx.amount)}
        </span>
        <div className="tx-actions" style={{display:'flex',gap:'var(--space-1)'}}>
          <button onPointerUp={()=>onEdit(tx)} style={{padding:'4px 8px',borderRadius:'var(--radius-sm)',border:'none',cursor:'pointer',background:'var(--indigo-dim)',color:'var(--indigo)',fontSize:'var(--text-xs)',fontWeight:'var(--font-medium)',fontFamily:'var(--font)'}}>Editar</button>
          <button onPointerUp={()=>onDelete(tx.id)} style={{padding:'4px 8px',borderRadius:'var(--radius-sm)',border:'none',cursor:'pointer',background:'var(--red-dim)',color:'var(--red)',fontSize:'var(--text-xs)',fontWeight:'var(--font-medium)',fontFamily:'var(--font)'}}>Excluir</button>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const today = new Date();
  const [month,      setMonth]      = useState(today.getMonth()+1);
  const [year,       setYear]       = useState(today.getFullYear());
  const [summary,    setSummary]    = useState(null);
  const [txs,        setTxs]        = useState([]);
  const [insights,   setInsights]   = useState([]);
  const [score,      setScore]      = useState(null);
  const [budgets,    setBudgets]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showTxModal,setShowTxModal]= useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingTx,  setEditingTx]  = useState(null);
  const [txType,     setTxType]     = useState('expense');
  const [showAllTxs, setShowAllTxs] = useState(false);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, txRes, insRes, scoreRes, budRes] = await Promise.all([
        api.get(`/api/summary?month=${month}&year=${year}`),
        api.get(`/api/transactions?month=${month}&year=${year}`),
        api.get('/api/insights'),
        api.get('/api/insights/score').catch(()=>({data:null})),
        api.get('/api/budgets').catch(()=>({data:[]})),
      ]);
      setSummary(sumRes.data);
      setTxs(txRes.data||[]);
      setInsights(insRes.data||[]);
      setScore(scoreRes.data);
      setBudgets(budRes.data||[]);
    } catch(e){ console.error(e); }
    setLoading(false);
  },[month,year]);

  useEffect(()=>{ load(); },[load]);

  function openNewTx(type) { setTxType(type); setEditingTx(null); setShowTxModal(true); }
  function openEditTx(tx)  { setEditingTx(tx); setShowTxModal(true); }

  async function handleDeleteTx(id) {
    if (!confirm('Excluir esta transação?')) return;
    await api.delete(`/api/transactions/${id}`);
    setTxs(prev=>prev.filter(t=>t.id!==id));
    load();
  }

  const real         = txs.filter(t=>!t.transfer_id);
  const income       = summary?.income  || 0;
  const expense      = summary?.expense || 0;
  const balance      = income - expense;
  const savingRate   = income>0?Math.round((income-expense)/income*100):0;
  const balanceColor = balance>=0?'var(--green)':'var(--red)';

  const recentTxs    = real.slice(0,showAllTxs?undefined:7);
  const hasMore      = real.length > 7;

  // Tetos com progresso
  const budgetAlerts = budgets.filter(b=>{
    const spent = summary?.byCategory?.find(c=>c.category_id===b.category_id)?.value||0;
    return b.amount>0 && spent/b.amount>=0.8;
  }).slice(0,3);

  return (
    <div style={{minHeight:'100vh',background:'var(--bg)'}}>
      <Navbar/>

      <style>{`
        .tx-actions { opacity:0; transition:opacity var(--transition); }
        .tx-row:hover .tx-actions { opacity:1; }
        @media(max-width:640px){ .tx-actions { opacity:1 !important; } }
      `}</style>

      <main className="page-main" style={{maxWidth:860,margin:'0 auto',padding:'var(--space-5) var(--space-4) 80px'}}>

        {/* ── Cabeçalho: seletor de mês ── */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'var(--space-5)',flexWrap:'wrap',gap:'var(--space-3)'}}>
          <MonthSelector month={month} year={year} onChange={(m,y)=>{setMonth(m);setYear(y);}}/>
          <div style={{display:'flex',gap:'var(--space-2)'}}>
            <Button variant="ghost" size="sm" onClick={()=>setShowImport(true)}>📥 Importar</Button>
          </div>
        </div>

        {loading ? (
          <SkeletonList n={4} h={90} gap={12}/>
        ) : (<>

          {/* ── Saldo em destaque ── */}
          <div style={{background:'linear-gradient(135deg,#7c3aed,#a78bfa)',borderRadius:'var(--radius-xl)',padding:'var(--space-6)',marginBottom:'var(--space-4)',color:'#fff',position:'relative',overflow:'hidden'}}>
            <div style={{position:'absolute',top:-40,right:-40,width:160,height:160,borderRadius:'50%',background:'rgba(255,255,255,0.06)'}}/>
            <div style={{position:'absolute',bottom:-30,right:40,width:100,height:100,borderRadius:'50%',background:'rgba(255,255,255,0.04)'}}/>
            <p style={{fontSize:'var(--text-xs)',color:'rgba(255,255,255,0.75)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'var(--space-2)'}}>Saldo do mês</p>
            <p style={{fontFamily:'var(--mono)',fontSize:'var(--text-3xl)',fontWeight:'var(--font-bold)',letterSpacing:'-0.02em',marginBottom:'var(--space-4)'}}>{fmt(balance)}</p>
            <div style={{display:'flex',gap:'var(--space-6)',flexWrap:'wrap'}}>
              <div>
                <p style={{fontSize:'var(--text-xs)',color:'rgba(255,255,255,0.7)',marginBottom:2}}>↑ Receitas</p>
                <p style={{fontFamily:'var(--mono)',fontSize:'var(--text-md)',fontWeight:'var(--font-semibold)'}}>{fmt(income)}</p>
              </div>
              <div>
                <p style={{fontSize:'var(--text-xs)',color:'rgba(255,255,255,0.7)',marginBottom:2}}>↓ Despesas</p>
                <p style={{fontFamily:'var(--mono)',fontSize:'var(--text-md)',fontWeight:'var(--font-semibold)'}}>{fmt(expense)}</p>
              </div>
              <div>
                <p style={{fontSize:'var(--text-xs)',color:'rgba(255,255,255,0.7)',marginBottom:2}}>💰 Poupança</p>
                <p style={{fontFamily:'var(--mono)',fontSize:'var(--text-md)',fontWeight:'var(--font-semibold)'}}>{savingRate}%</p>
              </div>
            </div>
          </div>

          {/* ── Ações rápidas ── */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'var(--space-2)',marginBottom:'var(--space-4)'}}>
            {[
              {label:'+ Receita', color:'var(--green)', bg:'var(--green-dim)', action:()=>openNewTx('income')},
              {label:'+ Despesa', color:'var(--red)',   bg:'var(--red-dim)',   action:()=>openNewTx('expense')},
              {label:'↕ Transferir', color:'var(--indigo)', bg:'var(--indigo-dim)', action:()=>navigate('/transfers')},
            ].map(a=>(
              <button key={a.label} onClick={a.action} style={{padding:'var(--space-3)',borderRadius:'var(--radius-md)',border:`1px solid ${a.color}33`,background:a.bg,color:a.color,fontSize:'var(--text-sm)',fontWeight:'var(--font-semibold)',cursor:'pointer',fontFamily:'var(--font)',transition:'all var(--transition)'}}
                onMouseOver={e=>{e.currentTarget.style.transform='translateY(-1px)';}}
                onMouseOut={e=>{e.currentTarget.style.transform='none';}}>
                {a.label}
              </button>
            ))}
          </div>

          {/* ── Insights ── */}
          {insights.length>0 && (
            <div style={{marginBottom:'var(--space-4)'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'var(--space-3)'}}>
                <SectionLabel style={{margin:0}}>Insights do dia</SectionLabel>
                <span style={{fontSize:'var(--text-xs)',color:'var(--text3)'}}>{insights.length} hoje</span>
              </div>
              <div style={{display:'flex',gap:'var(--space-3)',flexWrap:'wrap'}}>
                {insights.map((insight,i)=>(
                  <InsightCard key={i} insight={insight} onClick={url=>navigate(url)}/>
                ))}
              </div>
            </div>
          )}

          {/* ── Score + Tetos críticos lado a lado ── */}
          <div style={{display:'grid',gridTemplateColumns:budgetAlerts.length?'1fr 1fr':'1fr',gap:'var(--space-3)',marginBottom:'var(--space-4)'}}>
            {/* HealthScore compacto */}
            {score && (
              <Card>
                <div style={{padding:'var(--space-4)'}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'var(--space-3)'}}>
                    <SectionLabel style={{margin:0}}>Score de saúde</SectionLabel>
                    <span style={{fontFamily:'var(--mono)',fontSize:'var(--text-2xl)',fontWeight:'var(--font-bold)',color:score.score>=70?'var(--green)':score.score>=50?'var(--amber)':'var(--red)'}}>{score.score}</span>
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:'var(--space-2)'}}>
                    {score.breakdown.slice(0,3).map(item=>(
                      <div key={item.label}>
                        <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}>
                          <span style={{fontSize:'var(--text-xs)',color:'var(--text3)'}}>{item.label}</span>
                          <span style={{fontSize:'var(--text-xs)',fontFamily:'var(--mono)',color:item.color,fontWeight:'var(--font-semibold)'}}>{item.pts}/20</span>
                        </div>
                        <MiniBar pct={item.pct} color={item.color}/>
                      </div>
                    ))}
                  </div>
                  <button onClick={()=>navigate('/health')} style={{marginTop:'var(--space-3)',fontSize:'var(--text-xs)',color:'var(--indigo)',background:'none',border:'none',cursor:'pointer',fontFamily:'var(--font)',padding:0}}>
                    Ver detalhes →
                  </button>
                </div>
              </Card>
            )}

            {/* Tetos críticos */}
            {budgetAlerts.length>0 && (
              <Card>
                <div style={{padding:'var(--space-4)'}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'var(--space-3)'}}>
                    <SectionLabel style={{margin:0}}>Tetos de gastos</SectionLabel>
                    <button onClick={()=>navigate('/budgets')} style={{fontSize:'var(--text-xs)',color:'var(--indigo)',background:'none',border:'none',cursor:'pointer',fontFamily:'var(--font)',padding:0}}>Ver todos →</button>
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:'var(--space-3)'}}>
                    {budgetAlerts.map((b,i)=>{
                      const spent = summary?.byCategory?.find(c=>c.category_id===b.category_id)?.value||0;
                      const pct   = b.amount>0?Math.round(spent/b.amount*100):0;
                      return (
                        <div key={i}>
                          <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}>
                            <span style={{fontSize:'var(--text-xs)',color:'var(--text)'}}>{b.categories?.name}</span>
                            <span style={{fontSize:'var(--text-xs)',fontFamily:'var(--mono)',color:pct>=100?'var(--red)':'var(--amber)',fontWeight:'var(--font-semibold)'}}>{pct}%</span>
                          </div>
                          <MiniBar pct={pct} color={pct>=100?'var(--red)':'var(--amber)'}/>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* ── Transações recentes ── */}
          <Card>
            <div style={{padding:'var(--space-4)',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <SectionLabel style={{margin:0}}>Transações recentes</SectionLabel>
              <span style={{fontSize:'var(--text-xs)',color:'var(--text3)'}}>{real.length} no mês</span>
            </div>

            {real.length===0 ? (
              <EmptyState icon="📋" title="Nenhuma transação neste mês."
                subtitle="Use os botões acima para adicionar ou importe seu extrato."
                action={<Button size="sm" onClick={()=>openNewTx('expense')}>+ Primeira transação</Button>}/>
            ) : (
              <div style={{padding:'var(--space-2) var(--space-3)'}}>
                {recentTxs.map(tx=>(
                  <TxRow key={tx.id} tx={tx} onEdit={openEditTx} onDelete={handleDeleteTx}/>
                ))}
                {hasMore && (
                  <button onClick={()=>setShowAllTxs(v=>!v)}
                    style={{width:'100%',padding:'var(--space-3)',marginTop:'var(--space-2)',background:'var(--bg3)',border:'none',borderRadius:'var(--radius-md)',cursor:'pointer',fontSize:'var(--text-xs)',color:'var(--text3)',fontFamily:'var(--font)'}}>
                    {showAllTxs?`▲ Mostrar menos`:`▼ Ver mais ${real.length-7} transações`}
                  </button>
                )}
              </div>
            )}
          </Card>
        </>)}
      </main>

      {/* Modais */}
      {showTxModal && (
        <TransactionModal
          transaction={editingTx}
          defaultType={txType}
          onSave={()=>{ setShowTxModal(false); load(); }}
          onClose={()=>setShowTxModal(false)}
        />
      )}
      {showImport && (
        <ImportModal
          onSave={()=>{ setShowImport(false); load(); }}
          onClose={()=>setShowImport(false)}
        />
      )}
    </div>
  );
}
