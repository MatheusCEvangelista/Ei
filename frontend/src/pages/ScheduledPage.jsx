import { useState, useEffect } from 'react';
import { PageShell, PageHeader, Card, EmptyState, SkeletonList, Button, Input, Select, InfoBox, SectionLabel } from '../components/ui';
import api from '../lib/api';

const fmt     = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);
const fmtDate = d => new Date(d+'T00:00:00').toLocaleDateString('pt-BR');

function FutureModal({ onSave, onClose }) {
  const [categories, setCategories] = useState([]);
  const [accounts,   setAccounts]   = useState([]);
  const [form, setForm] = useState({ description:'', amount:'', type:'expense', date:'', category_id:'', account_id:'' });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  useEffect(()=>{
    api.get('/api/categories').then(r=>setCategories(r.data||[])).catch(()=>{});
    api.get('/api/accounts').then(r=>setAccounts(r.data||[])).catch(()=>{});
  },[]);

  async function handleSave(e) {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      await api.post('/api/transactions',{...form,amount:parseFloat(form.amount),status:'pending'});
      onSave();
    } catch(err) { setError(err.response?.data?.error||'Erro ao salvar'); }
    setSaving(false);
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',backdropFilter:'blur(4px)',display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:50,padding:'var(--space-4)'}} onClick={onClose}>
      <div style={{background:'var(--bg2)',border:'1px solid var(--border-md)',borderRadius:'var(--radius-xl) var(--radius-xl) 0 0',width:'100%',maxWidth:480,padding:'8px 22px 32px',maxHeight:'90vh',overflowY:'auto'}} className="fade-up" onClick={e=>e.stopPropagation()}>
        <div style={{width:36,height:4,borderRadius:2,background:'var(--bg3)',margin:'10px auto 20px'}}/>
        <PageHeader title="Lançamento futuro" subtitle="Aparece no calendário, não conta no saldo até confirmar"
          action={<button onClick={onClose} style={{width:28,height:28,borderRadius:'var(--radius-sm)',border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text2)',cursor:'pointer',fontSize:16}}>×</button>}/>
        <form onSubmit={handleSave}>
          <div style={{display:'flex',flexDirection:'column',gap:'var(--space-4)'}}>
            <div style={{display:'flex',background:'var(--bg3)',borderRadius:'var(--radius-sm)',padding:3,border:'1px solid var(--border)'}}>
              {['expense','income'].map(t=>(
                <button key={t} type="button" onClick={()=>setForm({...form,type:t})} style={{flex:1,padding:'var(--space-2)',borderRadius:'var(--radius-sm)',fontSize:'var(--text-sm)',fontWeight:'var(--font-medium)',border:'none',cursor:'pointer',fontFamily:'var(--font)',background:form.type===t?'var(--bg2)':'transparent',color:form.type===t?t==='income'?'var(--green)':'var(--red)':'var(--text3)',transition:'all var(--transition)'}}>
                  {t==='income'?'↑ Receita':'↓ Despesa'}
                </button>
              ))}
            </div>
            <Input label="Descrição" required value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Ex: Aluguel de outubro"/>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'var(--space-2)'}}>
              <Input label="Valor (R$)" required type="number" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} placeholder="0,00"/>
              <Input label="Data prevista" required type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/>
            </div>
            <Select label="Categoria" value={form.category_id} onChange={e=>setForm({...form,category_id:e.target.value})}>
              <option value="">Sem categoria</option>
              {categories.map(c=><option key={c.id} value={c.id}>{c.icon||''} {c.name}</option>)}
            </Select>
            <Select label="Conta (opcional)" value={form.account_id} onChange={e=>setForm({...form,account_id:e.target.value})}>
              <option value="">Nenhuma</option>
              {accounts.map(a=><option key={a.id} value={a.id}>{a.icon||'🏦'} {a.name}</option>)}
            </Select>
            {error && <InfoBox variant="danger">{error}</InfoBox>}
            <Button type="submit" disabled={saving} size="lg" style={{width:'100%'}}>{saving?'Salvando...':'Agendar lançamento'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TxGroup({ title, items, color, onConfirm, onRemove }) {
  if (!items.length) return null;
  return (
    <div style={{marginBottom:'var(--space-6)'}}>
      <SectionLabel style={{color,marginBottom:'var(--space-3)'}}>{title}</SectionLabel>
      <div style={{display:'flex',flexDirection:'column',gap:'var(--space-2)'}}>
        {items.map(tx=>(
          <Card key={tx.id}>
            <div style={{display:'flex',alignItems:'center',gap:'var(--space-3)',padding:'var(--space-4)'}}>
              <div style={{width:36,height:36,borderRadius:'var(--radius-sm)',background:tx.type==='income'?'var(--green-dim)':'var(--red-dim)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:'var(--font-bold)',color:tx.type==='income'?'var(--green)':'var(--red)',flexShrink:0}}>
                {tx.type==='income'?'↑':'↓'}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <p style={{fontSize:'var(--text-sm)',fontWeight:'var(--font-semibold)',color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{tx.description||'—'}</p>
                <div style={{display:'flex',gap:'var(--space-2)',marginTop:2}}>
                  <span style={{fontSize:'var(--text-xs)',color:'var(--text3)'}}>{fmtDate(tx.date)}</span>
                  {tx.categories&&<span style={{fontSize:'var(--text-xs)',color:'var(--text3)'}}>• {tx.categories.name}</span>}
                </div>
              </div>
              <div style={{textAlign:'right',flexShrink:0}}>
                <p style={{fontFamily:'var(--mono)',fontSize:'var(--text-sm)',fontWeight:'var(--font-bold)',color:tx.type==='income'?'var(--green)':'var(--red)',marginBottom:'var(--space-2)'}}>
                  {tx.type==='income'?'+':'-'}{fmt(tx.amount)}
                </p>
                <div style={{display:'flex',gap:'var(--space-1)'}}>
                  <Button size="sm" variant="secondary" onClick={()=>onConfirm(tx.id)} style={{background:'var(--green-dim)',color:'var(--green)',border:'none'}}>✓ Confirmar</Button>
                  <Button size="sm" variant="danger" onClick={()=>onRemove(tx.id)}>Excluir</Button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function ScheduledPage() {
  const [pending,   setPending]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await api.get('/api/transactions/pending');
    setPending(data||[]);
    setLoading(false);
  }
  useEffect(()=>{ load(); },[]);

  async function confirmTx(id) {
    await api.patch(`/api/transactions/${id}/confirm`);
    setPending(prev=>prev.filter(t=>t.id!==id));
  }
  async function removeTx(id) {
    if (!confirm('Excluir este lançamento?')) return;
    await api.delete(`/api/transactions/${id}`);
    setPending(prev=>prev.filter(t=>t.id!==id));
  }

  const today    = new Date().toISOString().split('T')[0];
  const overdue  = pending.filter(t=>t.date<today);
  const upcoming = pending.filter(t=>t.date>=today);

  return (
    <PageShell maxWidth={640}>
      <PageHeader
        title="Lançamentos futuros"
        subtitle="Pendentes de confirmação — não contam no saldo atual"
        action={<Button onClick={()=>setShowModal(true)}>+ Novo agendamento</Button>}
      />

      <InfoBox variant="info" style={{marginBottom:'var(--space-5)'}}>
        📅 Lançamentos futuros aparecem no <strong>calendário financeiro</strong> mas só entram no saldo ao clicar em <strong>✓ Confirmar</strong>.
      </InfoBox>

      {loading ? <SkeletonList n={3} h={80}/> :
       pending.length===0 ? (
        <EmptyState icon="📅" title="Nenhum lançamento agendado." subtitle="Agende contas futuras para visualizá-las no calendário antes de confirmá-las." action={<Button onClick={()=>setShowModal(true)}>+ Novo agendamento</Button>}/>
      ) : (<>
        <TxGroup title={`⚠️ Vencidos (${overdue.length})`}    items={overdue}  color="var(--red)"    onConfirm={confirmTx} onRemove={removeTx}/>
        <TxGroup title={`📅 Próximos (${upcoming.length})`}   items={upcoming} color="var(--indigo)" onConfirm={confirmTx} onRemove={removeTx}/>
      </>)}
      {showModal && <FutureModal onSave={()=>{setShowModal(false);load();}} onClose={()=>setShowModal(false)}/>}
    </PageShell>
  );
}
