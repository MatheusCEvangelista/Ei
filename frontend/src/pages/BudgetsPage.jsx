import { useState, useEffect } from 'react';
import api from '../lib/api';
import Navbar from '../components/Navbar';
import MonthSelector from '../components/MonthSelector';

const fmt = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v);

function BudgetBar({ spent, amount, color }) {
  const pct     = Math.min(100, amount > 0 ? Math.round(spent / amount * 100) : 0);
  const barColor = pct >= 100 ? 'var(--red)' : pct >= 80 ? 'var(--amber)' : color || 'var(--indigo)';
  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
        <span style={{fontSize:12,color:'var(--text3)'}}>{fmt(spent)} de {fmt(amount)}</span>
        <span style={{fontSize:12,fontFamily:'var(--mono)',fontWeight:600,color:barColor}}>{pct}%</span>
      </div>
      <div style={{height:7,background:'var(--bg)',borderRadius:99,overflow:'hidden'}}>
        <div style={{height:'100%',width:`${pct}%`,background:barColor,borderRadius:99,transition:'width 0.4s'}}/>
      </div>
    </div>
  );
}

export default function BudgetsPage() {
  const today = new Date();
  const [month,       setMonth]       = useState(today.getMonth()+1);
  const [year,        setYear]        = useState(today.getFullYear());
  const [budgets,     setBudgets]     = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [loadingSugg, setLoadingSugg] = useState(false);
  const [editing,     setEditing]     = useState(null); // { category_id, name, color, amount }
  const [editValue,   setEditValue]   = useState('');
  const [saving,      setSaving]      = useState(false);
  const [tab,         setTab]         = useState('budgets'); // 'budgets' | 'suggestions'
  const [showManual,  setShowManual]  = useState(false);
  const [manualCats,  setManualCats]  = useState([]);
  const [manualForm,  setManualForm]  = useState({ category_id:'', amount:'' });
  const [savingManual,setSavingManual]= useState(false);

  async function loadCategories() {
    if (manualCats.length) return;
    const { data } = await api.get('/api/categories');
    setManualCats(data);
  }

  async function loadBudgets() {
    setLoading(true);
    try {
      const { data } = await api.get(`/api/budgets?month=${month}&year=${year}`);
      setBudgets(data);
    } catch(e){ console.error(e); }
    setLoading(false);
  }

  async function loadSuggestions() {
    setLoadingSugg(true);
    try {
      const { data } = await api.get('/api/budgets/suggestions');
      setSuggestions(data);
    } catch(e){ console.error(e); }
    setLoadingSugg(false);
  }

  useEffect(() => { loadBudgets(); }, [month, year]);
  useEffect(() => { if (tab === 'suggestions' && suggestions.length === 0) loadSuggestions(); }, [tab]);

  async function saveBudget(category_id, amount) {
    setSaving(true);
    try {
      await api.post('/api/budgets', { category_id, amount: parseFloat(amount) });
      await loadBudgets();
      setEditing(null);
    } catch(e){ console.error(e); }
    setSaving(false);
  }

  async function saveManual() {
    if (!manualForm.category_id || !manualForm.amount) return;
    setSavingManual(true);
    try {
      await api.post('/api/budgets', { category_id: manualForm.category_id, amount: parseFloat(manualForm.amount) });
      setShowManual(false);
      setManualForm({ category_id:'', amount:'' });
      await loadBudgets();
    } catch(e){ console.error(e); }
    setSavingManual(false);
  }

  async function deleteBudget(id) {
    if (!confirm('Remover este teto?')) return;
    await api.delete(`/api/budgets/${id}`);
    loadBudgets();
  }

  async function applySuggestion(sugg, value) {
    await saveBudget(sugg.category_id, value);
    setTab('budgets');
  }

  // Totais
  const totalBudget = budgets.reduce((s,b) => s+Number(b.amount), 0);
  const totalSpent  = budgets.reduce((s,b) => s+Number(b.spent),  0);
  const totalPct    = totalBudget > 0 ? Math.round(totalSpent/totalBudget*100) : 0;
  const overBudget  = budgets.filter(b => b.pct >= 100).length;

  return (
    <div style={{minHeight:'100vh',background:'var(--bg)'}}>
      <Navbar/>
      <main className="page-main" style={{maxWidth:700,margin:'0 auto',padding:'24px 16px 80px'}}>

        {/* Header */}
        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:20,flexWrap:'wrap',gap:12}}>
          <div>
            <h1 style={{fontSize:20,fontWeight:600,letterSpacing:'-0.03em'}}>Tetos de gastos</h1>
            <p style={{color:'var(--text3)',fontSize:13,marginTop:4}}>Defina limites por categoria e acompanhe</p>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={()=>{setShowManual(true);loadCategories();}} style={{padding:'9px 14px',borderRadius:10,border:'1px solid var(--border)',background:'var(--bg2)',color:'var(--text2)',fontFamily:'var(--font)',fontSize:13,fontWeight:500,cursor:'pointer'}}>
              ＋ Teto manual
            </button>
            <button onClick={()=>setTab('suggestions')} style={{padding:'9px 16px',borderRadius:10,border:'none',background:'linear-gradient(135deg,var(--indigo),#a78bfa)',color:'#fff',fontFamily:'var(--font)',fontSize:13,fontWeight:600,cursor:'pointer'}}>
              ✨ Ver sugestões
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{display:'flex',background:'var(--bg3)',borderRadius:10,padding:3,marginBottom:20,border:'1px solid var(--border)'}}>
          {[['budgets','Meus tetos'],['suggestions','Sugestões da IA']].map(([id,label])=>(
            <button key={id} onClick={()=>setTab(id)} style={{flex:1,padding:'9px 0',borderRadius:8,fontSize:13,fontWeight:500,border:'none',cursor:'pointer',transition:'all 0.2s',fontFamily:'var(--font)',background:tab===id?'var(--bg2)':'transparent',color:tab===id?'var(--indigo)':'var(--text3)',boxShadow:tab===id?'0 1px 4px rgba(0,0,0,0.2)':'none'}}>{label}</button>
          ))}
        </div>

        {/* ── ABA: MEUS TETOS ── */}
        {tab==='budgets' && (<>
          {/* Seletor de mês */}
          <div style={{marginBottom:16}}>
            <MonthSelector month={month} year={year} onChange={(m,y)=>{setMonth(m);setYear(y);}}/>
          </div>

          {/* Card resumo */}
          {budgets.length>0 && (
            <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:14,padding:'18px 20px',marginBottom:16}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
                <div>
                  <p style={{fontSize:12,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:4}}>Total do mês</p>
                  <p style={{fontFamily:'var(--mono)',fontSize:22,fontWeight:600,color:totalPct>=100?'var(--red)':'var(--text)'}}>
                    {fmt(totalSpent)} <span style={{fontSize:14,color:'var(--text3)',fontWeight:400}}>/ {fmt(totalBudget)}</span>
                  </p>
                </div>
                {overBudget>0 && (
                  <div style={{background:'var(--red-dim)',border:'1px solid rgba(240,94,110,0.2)',borderRadius:8,padding:'6px 12px',textAlign:'center'}}>
                    <p style={{fontSize:12,color:'var(--red)',fontWeight:600}}>{overBudget} categoria{overBudget>1?'s':''}</p>
                    <p style={{fontSize:11,color:'var(--red)',opacity:0.8}}>acima do teto</p>
                  </div>
                )}
              </div>
              <div style={{height:8,background:'var(--bg3)',borderRadius:99,overflow:'hidden'}}>
                <div style={{height:'100%',width:`${Math.min(100,totalPct)}%`,background:totalPct>=100?'var(--red)':totalPct>=80?'var(--amber)':'var(--indigo)',borderRadius:99,transition:'width 0.5s'}}/>
              </div>
              <p style={{fontSize:11,color:'var(--text3)',marginTop:6}}>{totalPct}% do orçamento total utilizado</p>
            </div>
          )}

          {/* Lista de tetos */}
          {loading ? (
            [1,2,3].map(i=><div key={i} className="skeleton" style={{height:100,borderRadius:14,marginBottom:10}}/>)
          ) : budgets.length===0 ? (
            <div style={{textAlign:'center',padding:'50px 20px',color:'var(--text3)',background:'var(--bg2)',borderRadius:14,border:'1px solid var(--border)'}}>
              <div style={{fontSize:40,marginBottom:12}}>🎯</div>
              <p style={{fontSize:14,marginBottom:6}}>Nenhum teto definido ainda.</p>
              <p style={{fontSize:13,marginBottom:16}}>Use as sugestões para começar rapidamente.</p>
              <button onClick={()=>setTab('suggestions')} style={{padding:'10px 20px',borderRadius:10,border:'none',background:'var(--indigo)',color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'var(--font)'}}>
                ✨ Ver sugestões
              </button>
            </div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {budgets.map(b=>(
                <div key={b.id} style={{background:'var(--bg2)',border:`1px solid ${b.pct>=100?'rgba(240,94,110,0.35)':b.pct>=80?'rgba(245,166,35,0.25)':'var(--border)'}`,borderRadius:14,padding:'16px 18px'}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <div style={{width:34,height:34,borderRadius:9,background:(b.categories?.color||'#7c7ff7')+'22',border:`1px solid ${(b.categories?.color||'#7c7ff7')}44`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,fontWeight:700,color:b.categories?.color||'var(--indigo)',flexShrink:0}}>
                        {b.categories?.name?.charAt(0)||'?'}
                      </div>
                      <div>
                        <p style={{fontSize:14,fontWeight:600,color:'var(--text)'}}>{b.categories?.name||'Categoria'}</p>
                        <p style={{fontSize:11,color:'var(--text3)',marginTop:1}}>
                          {b.pct>=100 ? '🔴 Teto atingido!' : b.pct>=80 ? '⚠️ Atenção: quase no limite' : '✓ Dentro do limite'}
                        </p>
                      </div>
                    </div>

                    {/* Editar inline */}
                    {editing?.id===b.id ? (
                      <div style={{display:'flex',gap:6,alignItems:'center'}}>
                        <input type="number" step="0.01" min="0" value={editValue} onChange={e=>setEditValue(e.target.value)}
                          style={{width:100,padding:'6px 10px',fontSize:13,borderRadius:8,background:'var(--bg3)',border:'1px solid var(--indigo)',color:'var(--text)',fontFamily:'var(--mono)'}}
                          autoFocus onKeyDown={e=>{if(e.key==='Enter') saveBudget(b.category_id, editValue); if(e.key==='Escape') setEditing(null);}}
                        />
                        <button onClick={()=>saveBudget(b.category_id, editValue)} disabled={saving} style={{fontSize:12,color:'#fff',background:'var(--green)',border:'none',borderRadius:7,padding:'5px 10px',cursor:'pointer',fontFamily:'var(--font)'}}>✓</button>
                        <button onClick={()=>setEditing(null)} style={{fontSize:12,color:'var(--text3)',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:7,padding:'5px 8px',cursor:'pointer',fontFamily:'var(--font)'}}>✕</button>
                      </div>
                    ) : (
                      <div style={{display:'flex',gap:6}}>
                        <button onClick={()=>{setEditing(b);setEditValue(b.amount);}} style={{fontSize:12,color:'var(--indigo)',background:'var(--indigo-dim)',border:'none',borderRadius:7,padding:'5px 10px',cursor:'pointer',fontFamily:'var(--font)'}}>Editar</button>
                        <button onClick={()=>deleteBudget(b.id)} style={{fontSize:12,color:'var(--red)',background:'var(--red-dim)',border:'none',borderRadius:7,padding:'5px 10px',cursor:'pointer',fontFamily:'var(--font)'}}>Excluir</button>
                      </div>
                    )}
                  </div>
                  <BudgetBar spent={b.spent} amount={b.amount} color={b.categories?.color}/>
                </div>
              ))}
            </div>
          )}
        </>)}

        {/* ── ABA: SUGESTÕES ── */}
        {tab==='suggestions' && (
          <div>
            <div style={{background:'var(--indigo-dim)',border:'1px solid rgba(124,127,247,0.2)',borderRadius:12,padding:'14px 16px',marginBottom:20}}>
              <p style={{fontSize:13,color:'var(--indigo)',fontWeight:600,marginBottom:4}}>💡 Como funciona?</p>
              <p style={{fontSize:12,color:'var(--text2)',lineHeight:1.6}}>
                Analisamos a média dos seus gastos nos últimos 3 meses por categoria e sugerimos um teto com 10% de redução para ajudar você a economizar. Você pode ajustar o valor antes de salvar.
              </p>
            </div>

            {loadingSugg ? (
              [1,2,3,4].map(i=><div key={i} className="skeleton" style={{height:110,borderRadius:14,marginBottom:10}}/>)
            ) : suggestions.length===0 ? (
              <div style={{textAlign:'center',padding:'50px 20px',color:'var(--text3)',background:'var(--bg2)',borderRadius:14,border:'1px solid var(--border)'}}>
                <div style={{fontSize:36,marginBottom:12}}>📊</div>
                <p style={{fontSize:13}}>Dados insuficientes para gerar sugestões.</p>
                <p style={{fontSize:12,marginTop:6}}>Registre transações por pelo menos 1 mês.</p>
              </div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {suggestions.map(s=>(
                  <SuggestionCard key={s.category_id} suggestion={s} onApply={(val)=>applySuggestion(s,val)} saving={saving}/>
                ))}
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}

function SuggestionCard({ suggestion:s, onApply, saving }) {
  const [value, setValue] = useState(String(s.suggested_limit));
  const fmt = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v);

  return (
    <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:14,padding:'16px 18px'}} className="fade-up">
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12,flexWrap:'wrap',gap:10}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:34,height:34,borderRadius:9,background:(s.color||'#7c7ff7')+'22',border:`1px solid ${(s.color||'#7c7ff7')}44`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,fontWeight:700,color:s.color||'var(--indigo)',flexShrink:0}}>
            {s.name.charAt(0)}
          </div>
          <div>
            <p style={{fontSize:14,fontWeight:600,color:'var(--text)'}}>{s.name}</p>
            <p style={{fontSize:11,color:'var(--text3)',marginTop:1}}>Média: {fmt(s.avg_monthly)}/mês</p>
          </div>
        </div>
        <div style={{textAlign:'right'}}>
          <p style={{fontSize:11,color:'var(--green)',fontWeight:500}}>-{s.cut_pct}% de redução</p>
          <p style={{fontSize:11,color:'var(--text3)',marginTop:1}}>Economia: {fmt(s.avg_monthly-s.suggested_limit)}/mês</p>
        </div>
      </div>

      {/* Input ajustável + botão aplicar */}
      <div style={{display:'flex',gap:8,alignItems:'center',marginTop:4}}>
        <div style={{flex:1,position:'relative'}}>
          <span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',fontSize:13,color:'var(--text3)'}}>R$</span>
          <input type="number" step="0.01" min="0" value={value} onChange={e=>setValue(e.target.value)}
            style={{width:'100%',padding:'10px 12px 10px 30px',borderRadius:9,background:'var(--bg3)',border:'1px solid var(--border)',color:'var(--text)',fontFamily:'var(--mono)',fontSize:14}}/>
        </div>
        <button onClick={()=>onApply(value)} disabled={saving||!value}
          style={{padding:'10px 18px',borderRadius:9,border:'none',background:'linear-gradient(135deg,var(--indigo),#a78bfa)',color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'var(--font)',flexShrink:0,opacity:saving?0.6:1}}>
          {saving?'Salvando...':'Aplicar'}
        </button>
      </div>
    </div>
  
      {/* Modal de teto manual */}
      {showManual && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.65)',backdropFilter:'blur(4px)',display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:50}} onClick={()=>setShowManual(false)}>
          <div style={{background:'var(--bg2)',border:'1px solid var(--border-md)',borderRadius:'18px 18px 0 0',width:'100%',maxWidth:480,padding:'8px 24px 32px',boxShadow:'var(--shadow)'}} className="fade-up" onClick={e=>e.stopPropagation()}>
            <div style={{width:36,height:4,borderRadius:2,background:'var(--bg3)',margin:'10px auto 20px'}}/>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:22}}>
              <h2 style={{fontSize:16,fontWeight:600}}>Definir teto manualmente</h2>
              <button onClick={()=>setShowManual(false)} style={{width:28,height:28,borderRadius:7,border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text2)',cursor:'pointer',fontSize:16}}>×</button>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:16}}>
              <div>
                <label style={{display:'block',fontSize:12,color:'var(--text2)',fontWeight:500,marginBottom:6,letterSpacing:'0.02em'}}>CATEGORIA</label>
                <select value={manualForm.category_id} onChange={e=>setManualForm({...manualForm,category_id:e.target.value})}
                  style={{width:'100%',padding:'11px 14px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:8,color:manualForm.category_id?'var(--text)':'var(--text3)'}}>
                  <option value="">Selecione uma categoria</option>
                  {manualCats.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{display:'block',fontSize:12,color:'var(--text2)',fontWeight:500,marginBottom:6,letterSpacing:'0.02em'}}>VALOR LIMITE (R$)</label>
                <input type="number" step="0.01" min="0" value={manualForm.amount} onChange={e=>setManualForm({...manualForm,amount:e.target.value})}
                  placeholder="Ex: 500,00"
                  style={{width:'100%',padding:'11px 14px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:8,color:'var(--text)',fontFamily:'var(--mono)',fontSize:16}}/>
              </div>
              <div style={{display:'flex',gap:10}}>
                <button onClick={()=>setShowManual(false)} style={{flex:1,padding:'13px 0',borderRadius:10,fontSize:14,fontWeight:500,border:'1px solid var(--border)',background:'transparent',color:'var(--text2)',cursor:'pointer',fontFamily:'var(--font)'}}>Cancelar</button>
                <button onClick={saveManual} disabled={savingManual||!manualForm.category_id||!manualForm.amount}
                  style={{flex:2,padding:'13px 0',borderRadius:10,fontSize:14,fontWeight:600,border:'none',cursor:'pointer',fontFamily:'var(--font)',background:savingManual?'var(--bg3)':'linear-gradient(135deg,var(--indigo),#a78bfa)',color:savingManual?'var(--text3)':'#fff',opacity:(!manualForm.category_id||!manualForm.amount)?0.5:1}}>
                  {savingManual?'Salvando...':'Salvar teto'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    );
}