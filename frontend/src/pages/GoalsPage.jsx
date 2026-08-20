import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import api from '../lib/api';

const fmt     = v  => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);
const fmtDate = d  => new Date(d+'T00:00:00').toLocaleDateString('pt-BR');
const inpS    = { width:'100%',padding:'11px 14px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:8,color:'var(--text)' };
const lblS    = { display:'block',fontSize:12,color:'var(--text2)',fontWeight:500,marginBottom:6 };

// ── Modal de meta ─────────────────────────────────────────────────────────
function GoalModal({ goal, onSave, onClose }) {
  const [form, setForm] = useState({
    name:           goal?.name           || '',
    target_amount:  goal?.target_amount  || '',
    current_amount: goal?.current_amount || '',
    deadline:       goal?.deadline       || '',
    icon:           goal?.icon           || '🎯',
    color:          goal?.color          || '#7c3aed',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  // Cálculo automático enquanto preenche
  const remaining = Math.max(0, (parseFloat(form.target_amount)||0) - (parseFloat(form.current_amount)||0));
  const monthsLeft = form.deadline ? (() => {
    const now=new Date(), end=new Date(form.deadline);
    return Math.max(0,(end.getFullYear()-now.getFullYear())*12+(end.getMonth()-now.getMonth()));
  })() : null;
  const monthlyNeeded = monthsLeft > 0 ? Math.ceil(remaining / monthsLeft * 100) / 100 : null;

  async function handleSave(e) {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      if (goal?.id) await api.put(`/api/goals/${goal.id}`, form);
      else          await api.post('/api/goals', form);
      onSave();
    } catch(err) { setError(err.response?.data?.error||'Erro ao salvar'); }
    setSaving(false);
  }

  const ICONS = ['🎯','🏠','🚗','✈️','📚','💍','👶','💻','🏋️','🌴','🐾','💰'];

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',backdropFilter:'blur(4px)',display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:50,padding:16}} onClick={onClose}>
      <div style={{background:'var(--bg2)',border:'1px solid var(--border-md)',borderRadius:'18px 18px 0 0',width:'100%',maxWidth:480,padding:'8px 22px 32px',maxHeight:'90vh',overflowY:'auto',boxShadow:'var(--shadow)'}} className="fade-up" onClick={e=>e.stopPropagation()}>
        <div style={{width:36,height:4,borderRadius:2,background:'var(--bg3)',margin:'10px auto 20px'}}/>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
          <h2 style={{fontSize:16,fontWeight:600}}>{goal?.id?'Editar meta':'Nova meta'}</h2>
          <button onClick={onClose} style={{width:28,height:28,borderRadius:7,border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text2)',cursor:'pointer',fontSize:16}}>×</button>
        </div>

        <form onSubmit={handleSave}>
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            {/* Ícone */}
            <div>
              <label style={lblS}>Ícone</label>
              <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                {ICONS.map(ic=>(
                  <button key={ic} type="button" onClick={()=>setForm({...form,icon:ic})}
                    style={{width:38,height:38,borderRadius:9,border:`2px solid ${form.icon===ic?'var(--indigo)':'var(--border)'}`,background:form.icon===ic?'var(--indigo-dim)':'var(--bg3)',fontSize:18,cursor:'pointer'}}>
                    {ic}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={lblS}>Nome da meta</label>
              <input required type="text" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Ex: Viagem para Europa" style={inpS}/>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <div>
                <label style={lblS}>Valor alvo (R$)</label>
                <input required type="number" step="0.01" value={form.target_amount} onChange={e=>setForm({...form,target_amount:e.target.value})} placeholder="10000" style={inpS}/>
              </div>
              <div>
                <label style={lblS}>Já guardei (R$)</label>
                <input type="number" step="0.01" value={form.current_amount} onChange={e=>setForm({...form,current_amount:e.target.value})} placeholder="0" style={inpS}/>
              </div>
            </div>

            <div>
              <label style={lblS}>Prazo (opcional)</label>
              <input type="date" value={form.deadline} onChange={e=>setForm({...form,deadline:e.target.value})} style={inpS}/>
            </div>

            {/* Preview do cálculo automático */}
            {monthlyNeeded !== null && monthlyNeeded > 0 && (
              <div style={{background:'var(--indigo-dim)',border:'1px solid rgba(124,127,247,0.25)',borderRadius:10,padding:'14px 16px'}}>
                <p style={{fontSize:12,fontWeight:600,color:'var(--indigo)',marginBottom:8}}>💡 Cálculo automático</p>
                <div style={{display:'flex',flexDirection:'column',gap:5}}>
                  <div style={{display:'flex',justifyContent:'space-between'}}>
                    <span style={{fontSize:12,color:'var(--text2)'}}>Faltam</span>
                    <span style={{fontFamily:'var(--mono)',fontSize:13,fontWeight:600,color:'var(--text)'}}>{fmt(remaining)}</span>
                  </div>
                  <div style={{display:'flex',justifyContent:'space-between'}}>
                    <span style={{fontSize:12,color:'var(--text2)'}}>Meses restantes</span>
                    <span style={{fontFamily:'var(--mono)',fontSize:13,fontWeight:600,color:'var(--text)'}}>{monthsLeft} meses</span>
                  </div>
                  <div style={{height:1,background:'rgba(124,127,247,0.2)',margin:'4px 0'}}/>
                  <div style={{display:'flex',justifyContent:'space-between'}}>
                    <span style={{fontSize:13,fontWeight:600,color:'var(--indigo)'}}>Poupar por mês</span>
                    <span style={{fontFamily:'var(--mono)',fontSize:15,fontWeight:700,color:'var(--indigo)'}}>{fmt(monthlyNeeded)}</span>
                  </div>
                </div>
              </div>
            )}

            {error && <p style={{fontSize:12,color:'var(--red)',background:'var(--red-dim)',borderRadius:7,padding:'8px 10px'}}>{error}</p>}
            <button type="submit" disabled={saving} style={{padding:'13px',borderRadius:10,border:'none',background:saving?'var(--bg3)':'linear-gradient(135deg,#7c3aed,#a78bfa)',color:saving?'var(--text3)':'#fff',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'var(--font)'}}>
              {saving?'Salvando...':'Salvar meta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal de aporte ───────────────────────────────────────────────────────
function ContributeModal({ goal, onSave, onClose }) {
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const suggested = goal.monthly_target ? Math.min(goal.monthly_target, goal.remaining) : goal.remaining;

  async function handleSave(e) {
    e.preventDefault(); setSaving(true); setError('');
    try {
      await api.patch(`/api/goals/${goal.id}/contribute`, { amount: parseFloat(amount) });
      onSave();
    } catch(err) {
      console.error("Erro no aporte:", err);
      setError(err.response?.data?.error || 'Erro ao salvar aporte. Verifique o console.');
    }
    setSaving(false);
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50,padding:16}} onClick={onClose}>
      <div style={{background:'var(--bg2)',border:'1px solid var(--border-md)',borderRadius:16,width:'100%',maxWidth:360,padding:24,boxShadow:'var(--shadow)'}} className="fade-up" onClick={e=>e.stopPropagation()}>
        <h3 style={{fontSize:16,fontWeight:600,marginBottom:4}}>Adicionar aporte</h3>
        <p style={{fontSize:13,color:'var(--text3)',marginBottom:20}}>{goal.icon} {goal.name}</p>

        {goal.monthly_target && (
          <div style={{background:'var(--indigo-dim)',borderRadius:9,padding:'10px 14px',marginBottom:16,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontSize:12,color:'var(--indigo)'}}>Meta mensal sugerida</span>
            <span style={{fontFamily:'var(--mono)',fontSize:14,fontWeight:700,color:'var(--indigo)'}}>{fmt(goal.monthly_target)}</span>
          </div>
        )}

        <form onSubmit={handleSave} style={{display:'flex',flexDirection:'column',gap:12}}>
          <div>
            <label style={lblS}>Valor do aporte (R$)</label>
            <input autoFocus type="number" step="0.01" required value={amount} onChange={e=>setAmount(e.target.value)} placeholder={`Sugerido: ${fmt(suggested)}`} style={inpS}/>
          </div>
          <div style={{display:'flex',gap:8}}>
            {[goal.monthly_target, goal.remaining].filter(Boolean).map((v,i)=>(
              <button key={i} type="button" onClick={()=>setAmount(v.toFixed(2))}
                style={{flex:1,padding:'8px',borderRadius:8,border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text2)',fontSize:12,cursor:'pointer',fontFamily:'var(--font)'}}>
                {i===0?`Meta: ${fmt(v)}`:`Total: ${fmt(v)}`}
              </button>
            ))}
          </div>
          <button type="submit" disabled={saving} style={{padding:'12px',borderRadius:10,border:'none',background:'linear-gradient(135deg,#7c3aed,#a78bfa)',color:'#fff',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'var(--font)'}}>
            {saving?'Salvando...':'Confirmar aporte'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────
export default function GoalsPage() {
  const [goals,       setGoals]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [showModal,   setShowModal]   = useState(false);
  const [editing,     setEditing]     = useState(null);
  const [contributing,setContributing]= useState(null);
  const [filter,      setFilter]      = useState('active'); // active | done | all

  async function load() {
    setLoading(true);
    const { data } = await api.get('/api/goals');
    setGoals(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id) {
    if (!confirm('Excluir esta meta?')) return;
    await api.delete(`/api/goals/${id}`);
    setGoals(prev => prev.filter(g => g.id !== id));
  }

  const filtered = goals.filter(g => {
    if (filter === 'active') return !g.done;
    if (filter === 'done')   return  g.done;
    return true;
  });

  const totalTarget  = goals.filter(g=>!g.done).reduce((s,g)=>s+Number(g.target_amount),0);
  const totalSaved   = goals.filter(g=>!g.done).reduce((s,g)=>s+Number(g.current_amount),0);
  const totalMonthly = goals.filter(g=>!g.done&&g.monthly_target).reduce((s,g)=>s+g.monthly_target,0);

  return (
    <div style={{minHeight:'100vh',background:'var(--bg)'}}>
      <Navbar/>
      <main className="page-main" style={{maxWidth:720,margin:'0 auto',padding:'24px 16px 80px'}}>

        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20,flexWrap:'wrap',gap:12}}>
          <div>
            <h1 style={{fontSize:20,fontWeight:600,letterSpacing:'-0.03em'}}>Metas de economia</h1>
            <p style={{fontSize:13,color:'var(--text3)',marginTop:4}}>{goals.filter(g=>!g.done).length} ativa{goals.filter(g=>!g.done).length!==1?'s':''}</p>
          </div>
          <button onClick={()=>{setEditing(null);setShowModal(true);}}
            style={{padding:'10px 18px',borderRadius:10,border:'none',background:'linear-gradient(135deg,var(--indigo),#a78bfa)',color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'var(--font)'}}>
            + Nova meta
          </button>
        </div>

        {/* Resumo */}
        {goals.filter(g=>!g.done).length > 0 && (
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:20}}>
            {[
              {label:'Meta total',       value:fmt(totalTarget),  color:'var(--text)'},
              {label:'Já guardado',      value:fmt(totalSaved),   color:'var(--green)'},
              {label:'Guardar/mês',      value:fmt(totalMonthly), color:'var(--indigo)'},
            ].map(c=>(
              <div key={c.label} style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:12,padding:'12px 14px'}}>
                <p style={{fontSize:11,color:'var(--text3)',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.05em'}}>{c.label}</p>
                <p style={{fontFamily:'var(--mono)',fontSize:14,fontWeight:600,color:c.color}}>{c.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Filtro */}
        <div style={{display:'flex',background:'var(--bg3)',borderRadius:9,padding:3,border:'1px solid var(--border)',width:'fit-content',marginBottom:16}}>
          {[{id:'active',label:'Ativas'},{id:'done',label:'Concluídas'},{id:'all',label:'Todas'}].map(f=>(
            <button key={f.id} onClick={()=>setFilter(f.id)} style={{padding:'6px 14px',borderRadius:7,fontSize:12,fontWeight:500,border:'none',cursor:'pointer',fontFamily:'var(--font)',background:filter===f.id?'var(--bg2)':'transparent',color:filter===f.id?'var(--indigo)':'var(--text3)',transition:'all 0.15s'}}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Lista */}
        {loading ? (
          [1,2,3].map(i=><div key={i} className="skeleton" style={{height:140,borderRadius:14,marginBottom:12}}/>)
        ) : filtered.length === 0 ? (
          <div style={{textAlign:'center',padding:'48px 0',color:'var(--text3)'}}>
            <div style={{fontSize:40,marginBottom:12}}>{filter==='done'?'🏆':'🎯'}</div>
            <p style={{fontSize:14}}>{filter==='done'?'Nenhuma meta concluída ainda.':'Nenhuma meta ativa. Crie uma!'}</p>
          </div>
        ) : (
          filtered.map(goal => {
            const pct = goal.pct || 0;
            const isLate = goal.deadline && !goal.done && new Date(goal.deadline) < new Date();

            return (
              <div key={goal.id} style={{background:'var(--bg2)',border:`1px solid ${goal.done?'rgba(45,212,160,0.3)':isLate?'rgba(240,94,110,0.3)':'var(--border)'}`,borderRadius:14,padding:'18px 20px',marginBottom:12}}>
                {/* Header */}
                <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:12}}>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <div style={{width:40,height:40,borderRadius:12,background:'var(--indigo-dim)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0}}>
                      {goal.icon||'🎯'}
                    </div>
                    <div>
                      <p style={{fontSize:14,fontWeight:600,color:'var(--text)'}}>{goal.name}</p>
                      <div style={{display:'flex',gap:8,marginTop:2,flexWrap:'wrap'}}>
                        {goal.deadline && (
                          <span style={{fontSize:11,color:isLate?'var(--red)':'var(--text3)'}}>
                            {isLate?'⚠️ Prazo vencido':'📅'} {fmtDate(goal.deadline)}
                          </span>
                        )}
                        {goal.months_left !== null && !goal.done && (
                          <span style={{fontSize:11,color:'var(--text3)'}}>• {goal.months_left} meses restantes</span>
                        )}
                        {goal.done && <span style={{fontSize:11,color:'var(--green)',fontWeight:600}}>✓ Concluída!</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{display:'flex',gap:6}}>
                    <button onClick={()=>{setEditing(goal);setShowModal(true);}} style={{fontSize:11,padding:'5px 10px',borderRadius:7,border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text2)',cursor:'pointer',fontFamily:'var(--font)'}}>Editar</button>
                    <button onClick={()=>handleDelete(goal.id)} style={{fontSize:11,padding:'5px 10px',borderRadius:7,border:'1px solid rgba(240,94,110,0.2)',background:'var(--red-dim)',color:'var(--red)',cursor:'pointer',fontFamily:'var(--font)'}}>Excluir</button>
                  </div>
                </div>

                {/* Progresso */}
                <div style={{marginBottom:12}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                    <span style={{fontFamily:'var(--mono)',fontSize:13,fontWeight:600,color:'var(--green)'}}>{fmt(goal.current_amount)}</span>
                    <span style={{fontFamily:'var(--mono)',fontSize:13,color:'var(--text3)'}}>{fmt(goal.target_amount)} ({pct}%)</span>
                  </div>
                  <div style={{height:10,background:'var(--bg3)',borderRadius:99,overflow:'hidden'}}>
                    <div style={{height:'100%',width:`${pct}%`,background:pct>=100?'var(--green)':'linear-gradient(90deg,var(--indigo),#a78bfa)',borderRadius:99,transition:'width 0.5s'}}/>
                  </div>
                </div>

                {/* Info de cálculo automático */}
                {!goal.done && (
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
                    <div style={{display:'flex',gap:14,flexWrap:'wrap'}}>
                      {goal.monthly_target && (
                        <div style={{display:'flex',alignItems:'center',gap:5}}>
                          <span style={{fontSize:11,color:'var(--text3)'}}>Guardar/mês:</span>
                          <span style={{fontFamily:'var(--mono)',fontSize:12,fontWeight:700,color:'var(--indigo)'}}>{fmt(goal.monthly_target)}</span>
                        </div>
                      )}
                      {goal.remaining > 0 && (
                        <div style={{display:'flex',alignItems:'center',gap:5}}>
                          <span style={{fontSize:11,color:'var(--text3)'}}>Faltam:</span>
                          <span style={{fontFamily:'var(--mono)',fontSize:12,fontWeight:600,color:'var(--text)'}}>{fmt(goal.remaining)}</span>
                        </div>
                      )}
                    </div>
                    <button onClick={()=>setContributing(goal)}
                      style={{padding:'7px 14px',borderRadius:9,border:'none',background:'linear-gradient(135deg,var(--indigo),#a78bfa)',color:'#fff',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'var(--font)',whiteSpace:'nowrap'}}>
                      + Adicionar aporte
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </main>

      {showModal && (
        <GoalModal goal={editing} onSave={()=>{setShowModal(false);load();}} onClose={()=>setShowModal(false)}/>
      )}
      {contributing && (
        <ContributeModal goal={contributing} onSave={()=>{setContributing(null);load();}} onClose={()=>setContributing(null)}/>
      )}
    </div>
  );
}
