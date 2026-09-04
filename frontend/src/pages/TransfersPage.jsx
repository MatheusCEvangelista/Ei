import { useState, useEffect } from 'react';
import { PageShell, PageHeader, Card, EmptyState, SkeletonList, Button, Input, Select, InfoBox, SectionLabel } from '../components/ui';
import { useConfirm } from '../components/ConfirmDialog';
import api from '../lib/api';

const fmt     = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);
const fmtDate = d => new Date(d+'T00:00:00').toLocaleDateString('pt-BR');

function TransferModal({ onSave, onClose }) {
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({ from_account_id:'', to_account_id:'', amount:'', date: new Date().toISOString().split('T')[0], description:'' });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  useEffect(()=>{ api.get('/api/accounts').then(r=>setAccounts(r.data||[])).catch(()=>{}); },[]);

  async function handleSave(e) {
    e.preventDefault(); setError(''); setSaving(true);
    if (form.from_account_id === form.to_account_id) {
      setError('As contas de origem e destino devem ser diferentes.'); setSaving(false); return;
    }
    try {
      await api.post('/api/transfers', {
        from_account_id: form.from_account_id,
        to_account_id:   form.to_account_id,
        amount:          parseFloat(form.amount),
        date:            form.date,
        description:     form.description || 'Transferência',
      });
      onSave();
    } catch(err) { setError(err.response?.data?.error||'Erro ao realizar transferência'); }
    setSaving(false);
  }

  const fromAcc = accounts.find(a=>a.id===form.from_account_id);

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',backdropFilter:'blur(4px)',display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:50,padding:'var(--space-4)'}} onClick={onClose}>
      <div style={{background:'var(--bg2)',border:'1px solid var(--border-md)',borderRadius:'var(--radius-xl) var(--radius-xl) 0 0',width:'100%',maxWidth:460,padding:'8px 22px 32px',maxHeight:'90vh',overflowY:'auto'}} className="fade-up" onClick={e=>e.stopPropagation()}>
        <div style={{width:36,height:4,borderRadius:2,background:'var(--bg3)',margin:'10px auto 20px'}}/>
        <PageHeader title="Nova transferência" subtitle="O valor é debitado de uma conta e creditado em outra"
          action={<button onClick={onClose} style={{width:28,height:28,borderRadius:'var(--radius-sm)',border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text2)',cursor:'pointer',fontSize:16}}>×</button>}/>

        <form onSubmit={handleSave}>
          <div style={{display:'flex',flexDirection:'column',gap:'var(--space-4)'}}>
            <Select label="Conta de origem" required value={form.from_account_id} onChange={e=>setForm({...form,from_account_id:e.target.value})}>
              <option value="">Selecione a conta</option>
              {accounts.map(a=><option key={a.id} value={a.id}>{a.icon||'🏦'} {a.name} — {fmt(a.balance)}</option>)}
            </Select>

            <Select label="Conta de destino" required value={form.to_account_id} onChange={e=>setForm({...form,to_account_id:e.target.value})}>
              <option value="">Selecione a conta</option>
              {accounts.filter(a=>a.id!==form.from_account_id).map(a=><option key={a.id} value={a.id}>{a.icon||'🏦'} {a.name} — {fmt(a.balance)}</option>)}
            </Select>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'var(--space-2)'}}>
              <Input label="Valor (R$)" required type="number" step="0.01" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} placeholder="0,00"/>
              <Input label="Data" required type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/>
            </div>

            <Input label="Descrição (opcional)" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Ex: Reserva de emergência"/>

            {/* Aviso de saldo insuficiente */}
            {fromAcc && parseFloat(form.amount) > fromAcc.balance && (
              <InfoBox variant="warning">⚠️ Saldo insuficiente em {fromAcc.name} ({fmt(fromAcc.balance)})</InfoBox>
            )}

            {error && <InfoBox variant="danger">{error}</InfoBox>}

            <Button type="submit" disabled={saving} size="lg" style={{width:'100%'}}>
              {saving?'Transferindo...':'↕ Confirmar transferência'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TransfersPage() {
  const [transfers,  setTransfers]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showModal,  setShowModal]  = useState(false);
  const { confirm, ConfirmDialog }  = useConfirm();

  async function load() {
    setLoading(true);
    try { const { data } = await api.get('/api/transfers'); setTransfers(data||[]); }
    catch {} finally { setLoading(false); }
  }

  useEffect(()=>{ load(); },[]);

  async function handleDelete(id) {
    const ok = await confirm({
      title:        'Excluir transferência?',
      message:      'As duas transações vinculadas serão removidas. O saldo das contas voltará ao estado anterior.',
      confirmLabel: 'Excluir transferência',
      icon:         '↕️',
      variant:      'danger',
    });
    if (!ok) return;
    await api.delete(`/api/transfers/${id}`);
    setTransfers(prev=>prev.filter(t=>t.id!==id));
  }

  return (
    <PageShell maxWidth={640}>
      <ConfirmDialog/>
      <PageHeader
        title="Transferências"
        subtitle="Movimentações entre suas contas"
        action={<Button onClick={()=>setShowModal(true)}>↕ Nova transferência</Button>}
      />

      {loading ? <SkeletonList n={3} h={72}/> :
       transfers.length===0 ? (
        <EmptyState icon="↕️" title="Nenhuma transferência registrada."
          subtitle="Use transferências para mover dinheiro entre suas contas sem afetar o saldo total."
          action={<Button onClick={()=>setShowModal(true)}>↕ Nova transferência</Button>}/>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:'var(--space-2)'}}>
          {transfers.map(t=>(
            <Card key={t.id}>
              <div style={{display:'flex',alignItems:'center',gap:'var(--space-3)',padding:'var(--space-4)'}}>
                <div style={{width:36,height:36,borderRadius:'var(--radius-sm)',background:'var(--indigo-dim)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0,color:'var(--indigo)'}}>↕</div>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{fontSize:'var(--text-sm)',fontWeight:'var(--font-semibold)',color:'var(--text)'}}>
                    {t.from_account?.name||'Conta'} → {t.to_account?.name||'Conta'}
                  </p>
                  <div style={{display:'flex',gap:'var(--space-2)',marginTop:2}}>
                    <span style={{fontSize:'var(--text-xs)',color:'var(--text3)'}}>{fmtDate(t.date)}</span>
                    {t.description&&<span style={{fontSize:'var(--text-xs)',color:'var(--text3)'}}>• {t.description}</span>}
                  </div>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:'var(--space-3)',flexShrink:0}}>
                  <span style={{fontFamily:'var(--mono)',fontSize:'var(--text-sm)',fontWeight:'var(--font-bold)',color:'var(--indigo)'}}>{fmt(t.amount)}</span>
                  <Button variant="danger" size="sm" onClick={()=>handleDelete(t.id)}>Excluir</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showModal && <TransferModal onSave={()=>{setShowModal(false);load();}} onClose={()=>setShowModal(false)}/>}
    </PageShell>
  );
}
