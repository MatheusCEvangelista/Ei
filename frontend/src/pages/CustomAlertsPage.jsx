import { useState, useEffect } from 'react';
import { PageShell, PageHeader, Card, EmptyState, SkeletonList, Button, Input, Select, InfoBox, SectionLabel, Toggle, Badge } from '../components/ui';
import api from '../lib/api';

const fmt = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);

const ALERT_TYPES = [
  { id:'category_limit', icon:'💸', label:'Limite de categoria', desc:'Avisa quando gastar mais de R$X em uma categoria' },
  { id:'balance_low',    icon:'📉', label:'Saldo baixo',         desc:'Avisa quando saldo mensal cair abaixo de R$X' },
  { id:'reminder',       icon:'📅', label:'Lembrete mensal',     desc:'Lembra de algo todo dia N do mês' },
  { id:'goal_progress',  icon:'🎯', label:'Progresso de meta',   desc:'Avisa quando meta atingir X% de progresso' },
];

const TYPE_MAP = {
  category_limit:{icon:'💸',label:'Limite de categoria'},
  balance_low:   {icon:'📉',label:'Saldo baixo'},
  reminder:      {icon:'📅',label:'Lembrete'},
  goal_progress: {icon:'🎯',label:'Progresso de meta'},
};

function alertDesc(alert) {
  switch(alert.type) {
    case 'category_limit': return `Gastar mais de ${fmt(alert.threshold)} em ${alert.categories?.name||'categoria'}`;
    case 'balance_low':    return `Saldo cair abaixo de ${fmt(alert.threshold)}`;
    case 'reminder':       return `Lembrete todo dia ${alert.day_of_month}`;
    case 'goal_progress':  return `Meta atingir ${alert.goal_pct}%`;
    default:               return alert.description||'';
  }
}

function AlertModal({ onSave, onClose }) {
  const [type,       setType]       = useState('category_limit');
  const [categories, setCategories] = useState([]);
  const [goals,      setGoals]      = useState([]);
  const [form,       setForm]       = useState({ description:'', threshold:'', category_id:'', day_of_month:'', goal_id:'', goal_pct:'' });
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState('');

  useEffect(()=>{
    api.get('/api/categories').then(r=>setCategories(r.data||[])).catch(()=>{});
    api.get('/api/goals').then(r=>setGoals(r.data||[])).catch(()=>{});
  },[]);

  async function handleSave(e) {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      await api.post('/api/custom-alerts', { type, ...form,
        threshold:    form.threshold    ? parseFloat(form.threshold)  : null,
        day_of_month: form.day_of_month ? parseInt(form.day_of_month) : null,
        goal_pct:     form.goal_pct     ? parseInt(form.goal_pct)     : null,
      });
      onSave();
    } catch(err) { setError(err.response?.data?.error||'Erro ao salvar'); }
    setSaving(false);
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',backdropFilter:'blur(4px)',display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:50,padding:'var(--space-4)'}} onClick={onClose}>
      <div style={{background:'var(--bg2)',border:'1px solid var(--border-md)',borderRadius:'var(--radius-xl) var(--radius-xl) 0 0',width:'100%',maxWidth:480,padding:'8px 22px 32px',maxHeight:'90vh',overflowY:'auto',boxShadow:'var(--shadow)'}} className="fade-up" onClick={e=>e.stopPropagation()}>
        <div style={{width:36,height:4,borderRadius:2,background:'var(--bg3)',margin:'10px auto 20px'}}/>
        <PageHeader
          title="Novo alerta"
          action={<button onClick={onClose} style={{width:28,height:28,borderRadius:'var(--radius-sm)',border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text2)',cursor:'pointer',fontSize:16}}>×</button>}
        />
        <div style={{marginBottom:'var(--space-4)'}}>
          <SectionLabel>Tipo de alerta</SectionLabel>
          <div style={{display:'flex',flexDirection:'column',gap:'var(--space-2)'}}>
            {ALERT_TYPES.map(t=>(
              <button key={t.id} type="button" onClick={()=>setType(t.id)}
                style={{display:'flex',alignItems:'center',gap:'var(--space-3)',padding:'var(--space-3) var(--space-4)',borderRadius:'var(--radius-md)',border:`1.5px solid ${type===t.id?'var(--indigo)':'var(--border)'}`,background:type===t.id?'var(--indigo-dim)':'var(--bg3)',cursor:'pointer',textAlign:'left',fontFamily:'var(--font)',transition:'all var(--transition)'}}>
                <span style={{fontSize:20,flexShrink:0}}>{t.icon}</span>
                <div>
                  <p style={{fontSize:'var(--text-sm)',fontWeight:'var(--font-semibold)',color:type===t.id?'var(--indigo)':'var(--text)',marginBottom:2}}>{t.label}</p>
                  <p style={{fontSize:'var(--text-xs)',color:'var(--text3)'}}>{t.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSave}>
          <div style={{display:'flex',flexDirection:'column',gap:'var(--space-3)'}}>
            <Input label="Descrição do alerta" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Ex: Limite de alimentação"/>

            {type==='category_limit' && (<>
              <Select label="Categoria" required value={form.category_id} onChange={e=>setForm({...form,category_id:e.target.value})}>
                <option value="">Selecione uma categoria</option>
                {categories.map(c=><option key={c.id} value={c.id}>{c.icon||''} {c.name}</option>)}
              </Select>
              <Input label="Limite em R$" required type="number" value={form.threshold} onChange={e=>setForm({...form,threshold:e.target.value})} placeholder="500"/>
            </>)}

            {type==='balance_low' && (
              <Input label="Avisar quando saldo cair abaixo de (R$)" required type="number" value={form.threshold} onChange={e=>setForm({...form,threshold:e.target.value})} placeholder="500"/>
            )}

            {type==='reminder' && (
              <div>
                <Input label="Dia do mês para lembrar" required type="number" value={form.day_of_month} onChange={e=>setForm({...form,day_of_month:e.target.value})} placeholder="10"/>
                <p style={{fontSize:'var(--text-xs)',color:'var(--text3)',marginTop:'var(--space-1)'}}>O lembrete será disparado todo mês neste dia.</p>
              </div>
            )}

            {type==='goal_progress' && (<>
              <Select label="Meta" required value={form.goal_id} onChange={e=>setForm({...form,goal_id:e.target.value})}>
                <option value="">Selecione uma meta</option>
                {goals.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
              </Select>
              <div>
                <SectionLabel>Avisar quando atingir</SectionLabel>
                <div style={{display:'flex',gap:'var(--space-2)'}}>
                  {[25,50,75,90,100].map(p=>(
                    <button key={p} type="button" onClick={()=>setForm({...form,goal_pct:String(p)})}
                      style={{flex:1,padding:'9px 4px',borderRadius:'var(--radius-sm)',border:`1.5px solid ${form.goal_pct===String(p)?'var(--indigo)':'var(--border)'}`,background:form.goal_pct===String(p)?'var(--indigo-dim)':'var(--bg3)',color:form.goal_pct===String(p)?'var(--indigo)':'var(--text)',fontSize:'var(--text-sm)',fontWeight:'var(--font-semibold)',cursor:'pointer',fontFamily:'var(--font)'}}>
                      {p}%
                    </button>
                  ))}
                </div>
              </div>
            </>)}

            {error && <InfoBox variant="danger">{error}</InfoBox>}
            <Button type="submit" disabled={saving} size="lg" style={{width:'100%'}}>{saving?'Salvando...':'Criar alerta'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CustomAlertsPage() {
  const [alerts,    setAlerts]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await api.get('/api/custom-alerts');
    setAlerts(data||[]);
    setLoading(false);
  }
  useEffect(()=>{ load(); },[]);

  async function toggle(id) {
    const { data } = await api.patch(`/api/custom-alerts/${id}/toggle`);
    setAlerts(prev=>prev.map(a=>a.id===id?data:a));
  }

  async function remove(id) {
    if (!confirm('Excluir este alerta?')) return;
    await api.delete(`/api/custom-alerts/${id}`);
    setAlerts(prev=>prev.filter(a=>a.id!==id));
  }

  return (
    <PageShell maxWidth={640}>
      <PageHeader
        title="Alertas personalizados"
        subtitle="Defina quando quer ser avisado"
        action={<Button onClick={()=>setShowModal(true)}>+ Novo alerta</Button>}
      />

      {loading ? <SkeletonList n={3} h={80}/> :
       alerts.length===0 ? (
        <EmptyState icon="🔔" title="Nenhum alerta configurado ainda." subtitle="Crie alertas para ser avisado quando algo importante acontecer." action={<Button onClick={()=>setShowModal(true)}>+ Novo alerta</Button>}/>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:'var(--space-3)'}}>
          {alerts.map(alert=>{
            const t = TYPE_MAP[alert.type]||{icon:'🔔',label:'Alerta'};
            return (
              <Card key={alert.id} style={{opacity:alert.active?1:0.6}}>
                <div style={{display:'flex',alignItems:'center',gap:'var(--space-4)',padding:'var(--space-4)'}}>
                  <div style={{width:40,height:40,borderRadius:'var(--radius-md)',background:'var(--indigo-dim)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>
                    {t.icon}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:'var(--space-2)',marginBottom:3}}>
                      <p style={{fontSize:'var(--text-sm)',fontWeight:'var(--font-semibold)',color:'var(--text)'}}>{alert.description||t.label}</p>
                      <Badge>{t.label}</Badge>
                    </div>
                    <p style={{fontSize:'var(--text-xs)',color:'var(--text3)'}}>{alertDesc(alert)}</p>
                  </div>
                  <div style={{display:'flex',gap:'var(--space-2)',flexShrink:0,alignItems:'center'}}>
                    <div style={{position:'relative',width:40,height:22,cursor:'pointer'}} onClick={()=>toggle(alert.id)}>
                      <div style={{width:40,height:22,borderRadius:11,background:alert.active?'var(--indigo)':'var(--bg)',border:'1px solid var(--border)',transition:'background var(--transition)'}}/>
                      <div style={{position:'absolute',top:2,left:alert.active?20:2,width:18,height:18,borderRadius:'50%',background:'#fff',transition:'left var(--transition)',boxShadow:'0 1px 3px rgba(0,0,0,0.3)'}}/>
                    </div>
                    <Button variant="danger" size="sm" onClick={()=>remove(alert.id)}>Excluir</Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {showModal && <AlertModal onSave={()=>{setShowModal(false);load();}} onClose={()=>setShowModal(false)}/>}
    </PageShell>
  );
}
