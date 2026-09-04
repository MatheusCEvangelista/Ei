import { useState, useEffect } from 'react';
import { PageShell, PageHeader, Card, StatCard, EmptyState, SkeletonList, Button, Input, Select, InfoBox, SectionLabel, Badge } from '../components/ui';
import api from '../lib/api';
import ContributeModal from '../components/ContributeModal';

const fmt = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);
const fmtDate = d => new Date(d+'T00:00:00').toLocaleDateString('pt-BR');

const ICONS = ['🎯','🏠','🚗','✈️','📚','💍','👶','💻','🏋️','🌴','🐾','💰'];

function GoalModal({ goal, onSave, onClose }) {
  const [form, setForm] = useState({
    name: goal?.name||'', target_amount: goal?.target_amount||'',
    current_amount: goal?.current_amount||'', deadline: goal?.deadline||'',
    icon: goal?.icon||'🎯', color: goal?.color||'#7c3aed',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const remaining  = Math.max(0,(parseFloat(form.target_amount)||0)-(parseFloat(form.current_amount)||0));
  const monthsLeft = form.deadline ? (() => {
    const now=new Date(),end=new Date(form.deadline);
    return Math.max(0,(end.getFullYear()-now.getFullYear())*12+(end.getMonth()-now.getMonth()));
  })() : null;
  const monthlyNeeded = monthsLeft > 0 ? Math.ceil(remaining/monthsLeft*100)/100 : null;

  async function handleSave(e) {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      if (goal?.id) await api.put(`/api/goals/${goal.id}`, form);
      else          await api.post('/api/goals', form);
      onSave();
    } catch(err) { setError(err.response?.data?.error||'Erro ao salvar'); }
    setSaving(false);
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',backdropFilter:'blur(4px)',display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:50,padding:'var(--space-4)'}} onClick={onClose}>
      <div style={{background:'var(--bg2)',border:'1px solid var(--border-md)',borderRadius:'var(--radius-xl) var(--radius-xl) 0 0',width:'100%',maxWidth:480,padding:'8px 22px 32px',maxHeight:'90vh',overflowY:'auto',boxShadow:'var(--shadow)'}} className="fade-up" onClick={e=>e.stopPropagation()}>
        <div style={{width:36,height:4,borderRadius:2,background:'var(--bg3)',margin:'10px auto 20px'}}/>
        <PageHeader
          title={goal?.id?'Editar meta':'Nova meta'}
          action={<button onClick={onClose} style={{width:28,height:28,borderRadius:'var(--radius-sm)',border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text2)',cursor:'pointer',fontSize:16}}>×</button>}
        />
        <form onSubmit={handleSave}>
          <div style={{display:'flex',flexDirection:'column',gap:'var(--space-4)'}}>
            <div>
              <SectionLabel>Ícone</SectionLabel>
              <div style={{display:'flex',flexWrap:'wrap',gap:'var(--space-2)'}}>
                {ICONS.map(ic=>(
                  <button key={ic} type="button" onClick={()=>setForm({...form,icon:ic})}
                    style={{width:38,height:38,borderRadius:'var(--radius-sm)',border:`2px solid ${form.icon===ic?'var(--indigo)':'var(--border)'}`,background:form.icon===ic?'var(--indigo-dim)':'var(--bg3)',fontSize:18,cursor:'pointer'}}>
                    {ic}
                  </button>
                ))}
              </div>
            </div>
            <Input label="Nome da meta" required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Ex: Viagem para Europa"/>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'var(--space-2)'}}>
              <Input label="Valor alvo (R$)" required type="number" value={form.target_amount} onChange={e=>setForm({...form,target_amount:e.target.value})} placeholder="10000"/>
              <Input label="Já guardei (R$)" type="number" value={form.current_amount} onChange={e=>setForm({...form,current_amount:e.target.value})} placeholder="0"/>
            </div>
            <Input label="Prazo (opcional)" type="date" value={form.deadline} onChange={e=>setForm({...form,deadline:e.target.value})}/>
            {monthlyNeeded > 0 && (
              <InfoBox variant="info">
                <p style={{fontWeight:'var(--font-semibold)',marginBottom:'var(--space-2)'}}>💡 Cálculo automático</p>
                <div style={{display:'flex',justifyContent:'space-between'}}><span>Faltam</span><strong>{fmt(remaining)}</strong></div>
                <div style={{display:'flex',justifyContent:'space-between'}}><span>Meses restantes</span><strong>{monthsLeft}</strong></div>
                <div style={{display:'flex',justifyContent:'space-between',marginTop:'var(--space-1)',paddingTop:'var(--space-1)',borderTop:'1px solid rgba(124,127,247,0.2)'}}>
                  <span style={{fontWeight:'var(--font-semibold)'}}>Poupar por mês</span>
                  <strong style={{fontSize:'var(--text-lg)'}}>{fmt(monthlyNeeded)}</strong>
                </div>
              </InfoBox>
            )}
            {error && <InfoBox variant="danger">{error}</InfoBox>}
            <Button type="submit" disabled={saving} size="lg" style={{width:'100%'}}>
              {saving?'Salvando...':'Salvar meta'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ContributeModal({ goal, onSave, onClose }) {
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave(e) {
    e.preventDefault(); setSaving(true);
    try { await api.patch(`/api/goals/${goal.id}/contribute`,{amount:parseFloat(amount)}); onSave(); }
    catch{}
    setSaving(false);
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50,padding:'var(--space-4)'}} onClick={onClose}>
      <Card style={{width:'100%',maxWidth:360}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:'var(--space-5)'}}>
          <h3 style={{fontSize:'var(--text-md)',fontWeight:'var(--font-semibold)',marginBottom:'var(--space-1)'}}>Adicionar aporte</h3>
          <p style={{fontSize:'var(--text-sm)',color:'var(--text3)',marginBottom:'var(--space-4)'}}>{goal.icon} {goal.name}</p>
          {goal.monthly_target && (
            <InfoBox variant="info" style={{marginBottom:'var(--space-4)'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span>Meta mensal sugerida</span>
                <strong style={{fontFamily:'var(--mono)',fontSize:'var(--text-md)'}}>{fmt(goal.monthly_target)}</strong>
              </div>
            </InfoBox>
          )}
          <form onSubmit={handleSave} style={{display:'flex',flexDirection:'column',gap:'var(--space-3)'}}>
            <Input label="Valor do aporte (R$)" type="number" required value={amount} onChange={e=>setAmount(e.target.value)} placeholder={`Sugerido: ${fmt(goal.monthly_target||goal.remaining)}`}/>
            <div style={{display:'flex',gap:'var(--space-2)'}}>
              {[goal.monthly_target,goal.remaining].filter(Boolean).map((v,i)=>(
                <button key={i} type="button" onClick={()=>setAmount(v.toFixed(2))}
                  style={{flex:1,padding:'var(--space-2)',borderRadius:'var(--radius-sm)',border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text2)',fontSize:'var(--text-sm)',cursor:'pointer',fontFamily:'var(--font)'}}>
                  {i===0?`Meta: ${fmt(v)}`:`Total: ${fmt(v)}`}
                </button>
              ))}
            </div>
            <Button type="submit" disabled={saving} size="lg" style={{width:'100%'}}>{saving?'Salvando...':'Confirmar aporte'}</Button>
          </form>
        </div>
      </Card>
    </div>
  );
}

export default function GoalsPage() {
  const [goals,        setGoals]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [showModal,    setShowModal]    = useState(false);
  const [editing,      setEditing]      = useState(null);
  const [contributing, setContributing] = useState(null);
  const [filter,       setFilter]       = useState('active');

  async function load() {
    setLoading(true);
    const { data } = await api.get('/api/goals');
    setGoals(data||[]);
    setLoading(false);
  }
  useEffect(()=>{ load(); },[]);

  async function handleDelete(id) {
    if (!confirm('Excluir esta meta?')) return;
    await api.delete(`/api/goals/${id}`);
    setGoals(prev=>prev.filter(g=>g.id!==id));
  }

  const filtered = goals.filter(g=>filter==='active'?!g.done:filter==='done'?g.done:true);
  const active   = goals.filter(g=>!g.done);

  return (
    <PageShell maxWidth={720}>
      <PageHeader
        title="Metas de economia"
        subtitle={`${active.length} ativa${active.length!==1?'s':''}`}
        action={<Button onClick={()=>{setEditing(null);setShowModal(true);}}>+ Nova meta</Button>}
      />

      {/* Resumo */}
      {active.length>0 && (
        <div className="summary-grid" style={{gap:'var(--space-3)',marginBottom:'var(--space-5)'}}>
          <StatCard label="Meta total"  value={fmt(active.reduce((s,g)=>s+Number(g.target_amount),0))}  color="var(--text)"/>
          <StatCard label="Já guardado" value={fmt(active.reduce((s,g)=>s+Number(g.current_amount),0))} color="var(--green)"/>
          <StatCard label="Guardar/mês" value={fmt(active.filter(g=>g.monthly_target).reduce((s,g)=>s+g.monthly_target,0))} color="var(--indigo)"/>
        </div>
      )}

      {/* Filtro */}
      <div style={{display:'flex',background:'var(--bg3)',borderRadius:'var(--radius-sm)',padding:3,border:'1px solid var(--border)',width:'fit-content',marginBottom:'var(--space-4)'}}>
        {[{id:'active',label:'Ativas'},{id:'done',label:'Concluídas'},{id:'all',label:'Todas'}].map(f=>(
          <button key={f.id} onClick={()=>setFilter(f.id)} style={{padding:'6px 14px',borderRadius:'var(--radius-sm)',fontSize:'var(--text-sm)',fontWeight:'var(--font-medium)',border:'none',cursor:'pointer',fontFamily:'var(--font)',background:filter===f.id?'var(--bg2)':'transparent',color:filter===f.id?'var(--indigo)':'var(--text3)',transition:'all var(--transition)'}}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <SkeletonList n={3} h={140}/>
      ) : filtered.length===0 ? (
        <EmptyState
          icon={filter==='done'?'🏆':'🎯'}
          title={filter==='done'?'Nenhuma meta concluída ainda.':'Nenhuma meta ativa.'}
          subtitle="Crie metas para acompanhar seu progresso de economia."
          action={<Button onClick={()=>{setEditing(null);setShowModal(true);}}>+ Nova meta</Button>}
        />
      ) : filtered.map(goal=>{
        const pct    = goal.pct || 0;
        const isLate = goal.deadline && !goal.done && new Date(goal.deadline) < new Date();
        return (
          <Card key={goal.id} style={{marginBottom:'var(--space-3)',border:`1px solid ${goal.done?'rgba(45,212,160,0.3)':isLate?'rgba(240,94,110,0.3)':'var(--border)'}`}}>
            <div style={{padding:'var(--space-5)'}}>
              <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'var(--space-3)'}}>
                <div style={{display:'flex',alignItems:'center',gap:'var(--space-3)'}}>
                  <div style={{width:42,height:42,borderRadius:'var(--radius-md)',background:'var(--indigo-dim)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0}}>
                    {goal.icon||'🎯'}
                  </div>
                  <div>
                    <p style={{fontSize:'var(--text-md)',fontWeight:'var(--font-semibold)',color:'var(--text)'}}>{goal.name}</p>
                    <div style={{display:'flex',gap:'var(--space-2)',marginTop:2,flexWrap:'wrap',alignItems:'center'}}>
                      {goal.deadline && <span style={{fontSize:'var(--text-xs)',color:isLate?'var(--red)':'var(--text3)'}}>{isLate?'⚠️ Vencido':'📅'} {fmtDate(goal.deadline)}</span>}
                      {goal.months_left!=null&&!goal.done && <span style={{fontSize:'var(--text-xs)',color:'var(--text3)'}}>• {goal.months_left}m restantes</span>}
                      {goal.done && <Badge color="var(--green)" bg="var(--green-dim)">✓ Concluída</Badge>}
                    </div>
                  </div>
                </div>
                <div style={{display:'flex',gap:'var(--space-1)'}}>
                  <Button variant="ghost" size="sm" onClick={()=>{setEditing(goal);setShowModal(true);}}>Editar</Button>
                  <Button variant="danger" size="sm" onClick={()=>handleDelete(goal.id)}>Excluir</Button>
                </div>
              </div>

              {/* Progresso */}
              <div style={{marginBottom:'var(--space-3)'}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:'var(--space-1)'}}>
                  <span style={{fontFamily:'var(--mono)',fontSize:'var(--text-sm)',fontWeight:'var(--font-semibold)',color:'var(--green)'}}>{fmt(goal.current_amount)}</span>
                  <span style={{fontFamily:'var(--mono)',fontSize:'var(--text-sm)',color:'var(--text3)'}}>{fmt(goal.target_amount)} ({pct}%)</span>
                </div>
                <div style={{height:10,background:'var(--bg3)',borderRadius:'var(--radius-full)',overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${pct}%`,background:pct>=100?'var(--green)':'linear-gradient(90deg,var(--indigo),#a78bfa)',borderRadius:'var(--radius-full)',transition:'width 0.5s'}}/>
                </div>
              </div>

              {!goal.done && (
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:'var(--space-2)'}}>
                  <div style={{display:'flex',gap:'var(--space-4)',flexWrap:'wrap'}}>
                    {goal.monthly_target && (
                      <div style={{display:'flex',alignItems:'center',gap:'var(--space-1)'}}>
                        <span style={{fontSize:'var(--text-xs)',color:'var(--text3)'}}>Guardar/mês:</span>
                        <span style={{fontFamily:'var(--mono)',fontSize:'var(--text-sm)',fontWeight:'var(--font-bold)',color:'var(--indigo)'}}>{fmt(goal.monthly_target)}</span>
                      </div>
                    )}
                    {goal.remaining>0 && (
                      <div style={{display:'flex',alignItems:'center',gap:'var(--space-1)'}}>
                        <span style={{fontSize:'var(--text-xs)',color:'var(--text3)'}}>Faltam:</span>
                        <span style={{fontFamily:'var(--mono)',fontSize:'var(--text-sm)',fontWeight:'var(--font-medium)',color:'var(--text)'}}>{fmt(goal.remaining)}</span>
                      </div>
                    )}
                  </div>
                  <Button size="sm" onClick={()=>setContributing(goal)}>+ Adicionar aporte</Button>
                </div>
              )}
            </div>
          </Card>
        );
      })}

      {showModal && <GoalModal goal={editing} onSave={()=>{setShowModal(false);load();}} onClose={()=>setShowModal(false)}/>}
      {contributing && <ContributeModal goal={contributing} onSave={()=>{setContributing(null);load();}} onClose={()=>setContributing(null)}/>}
    </PageShell>
  );
}
