import { useState, useEffect } from 'react';
import { PageShell, PageHeader, Card, Button, SectionLabel, InfoBox, Badge } from '../components/ui';
import { useConfirm } from '../components/ConfirmDialog';
import api from '../lib/api';

const STATUS_CONFIG = {
  LOGIN_SUCCESS: { label:'Conectado',    color:'var(--green)',  bg:'var(--green-dim)',  icon:'✓' },
  UPDATING:      { label:'Conectando...', color:'var(--amber)',  bg:'var(--amber-dim)',  icon:'⏳' },
  LOGIN_ERROR:   { label:'Erro de login', color:'var(--red)',    bg:'var(--red-dim)',    icon:'✗' },
  WAITING_USER:  { label:'Ação necessária',color:'var(--amber)', bg:'var(--amber-dim)', icon:'⚠️' },
  default:       { label:'Desconhecido', color:'var(--text3)',  bg:'var(--bg3)',        icon:'?' },
};

// ── Etapas do fluxo de conexão ────────────────────────────────────────────
const STEPS = { SELECT_BANK:0, FILL_FORM:1, CONNECTING:2 };

function BankSearch({ banks, onSelect }) {
  const [q, setQ] = useState('');
  const filtered  = banks.filter(b => b.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar banco..."
        style={{width:'100%',padding:'10px 14px',borderRadius:'var(--radius-sm)',border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text)',fontSize:'var(--text-sm)',fontFamily:'var(--font)',outline:'none',marginBottom:'var(--space-3)',boxSizing:'border-box'}}
        onFocus={e=>e.target.style.borderColor='var(--indigo)'}
        onBlur={e=>e.target.style.borderColor='var(--border)'}
      />
      <div style={{display:'flex',flexDirection:'column',gap:'var(--space-2)',maxHeight:320,overflowY:'auto'}}>
        {filtered.length===0 && (
          <p style={{fontSize:'var(--text-sm)',color:'var(--text3)',textAlign:'center',padding:'var(--space-4)'}}>Nenhum banco encontrado</p>
        )}
        {filtered.map(bank=>(
          <button key={bank.id} onClick={()=>onSelect(bank)}
            style={{display:'flex',alignItems:'center',gap:'var(--space-3)',padding:'var(--space-3)',borderRadius:'var(--radius-md)',border:'1px solid var(--border)',background:'var(--bg3)',cursor:'pointer',textAlign:'left',fontFamily:'var(--font)',transition:'all var(--transition)'}}
            onMouseOver={e=>{e.currentTarget.style.borderColor='var(--indigo)';e.currentTarget.style.background='var(--indigo-dim)';}}
            onMouseOut={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.background='var(--bg3)';}}>
            {bank.logo
              ? <img src={bank.logo} alt={bank.name} style={{width:36,height:36,borderRadius:'var(--radius-sm)',objectFit:'contain',flexShrink:0,background:'#fff',padding:2}}/>
              : <div style={{width:36,height:36,borderRadius:'var(--radius-sm)',background:'var(--bg2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>🏦</div>
            }
            <div style={{flex:1,minWidth:0}}>
              <p style={{fontSize:'var(--text-sm)',fontWeight:'var(--font-semibold)',color:'var(--text)'}}>{bank.name}</p>
              <p style={{fontSize:'var(--text-xs)',color:'var(--text3)',marginTop:1}}>Open Finance</p>
            </div>
            <span style={{color:'var(--indigo)',fontSize:16,flexShrink:0}}>›</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function BankForm({ bank, onBack, onConnect }) {
  const [fields, setFields] = useState({});
  const [loading, setLoading] = useState(false);
  const [error,   setError]  = useState('');
  const [step,    setStep]   = useState(1); // alguns bancos têm MFA em 2 etapas
  const [mfaFields, setMfaFields] = useState(null);

  const currentFields = step===1 ? bank.credentials : mfaFields;

  async function handleSubmit(e) {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      await onConnect(bank, fields);
    } catch(err) {
      setError(err.message || 'Erro ao conectar. Verifique suas credenciais.');
    }
    setLoading(false);
  }

  const INPUT_TYPES = { number:'number', password:'password', text:'text', mfa:'text', phone:'tel' };

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',gap:'var(--space-3)',marginBottom:'var(--space-4)',padding:'var(--space-3)',background:'var(--bg3)',borderRadius:'var(--radius-md)'}}>
        {bank.logo
          ? <img src={bank.logo} alt={bank.name} style={{width:40,height:40,borderRadius:'var(--radius-sm)',objectFit:'contain',background:'#fff',padding:2,flexShrink:0}}/>
          : <div style={{width:40,height:40,background:'var(--bg2)',borderRadius:'var(--radius-sm)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0}}>🏦</div>
        }
        <div>
          <p style={{fontSize:'var(--text-md)',fontWeight:'var(--font-semibold)',color:'var(--text)'}}>{bank.name}</p>
          <p style={{fontSize:'var(--text-xs)',color:'var(--text3)'}}>Preencha suas credenciais bancárias</p>
        </div>
      </div>

      <InfoBox variant="info" style={{marginBottom:'var(--space-4)'}}>
        🔒 Suas credenciais são enviadas diretamente ao banco via Pluggy (Open Finance). O Ei! não armazena senhas.
      </InfoBox>

      <form onSubmit={handleSubmit} style={{display:'flex',flexDirection:'column',gap:'var(--space-3)'}}>
        {(currentFields||[]).map(field=>(
          <div key={field.name}>
            <label style={{display:'block',fontSize:'var(--text-xs)',color:'var(--text2)',fontWeight:'var(--font-medium)',marginBottom:'var(--space-1)',textTransform:'uppercase',letterSpacing:'0.05em'}}>
              {field.label} {field.optional?'(opcional)':'*'}
            </label>
            <input
              type={INPUT_TYPES[field.type]||'text'}
              required={!field.optional}
              placeholder={field.placeholder||''}
              value={fields[field.name]||''}
              onChange={e=>setFields(prev=>({...prev,[field.name]:e.target.value}))}
              style={{width:'100%',padding:'11px 14px',borderRadius:'var(--radius-sm)',border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text)',fontSize:'var(--text-base)',fontFamily:'var(--font)',outline:'none',boxSizing:'border-box'}}
              onFocus={e=>e.target.style.borderColor='var(--indigo)'}
              onBlur={e=>e.target.style.borderColor='var(--border)'}
            />
            {field.assistiveText&&<p style={{fontSize:'var(--text-xs)',color:'var(--text3)',marginTop:4}}>{field.assistiveText}</p>}
          </div>
        ))}

        {error && <InfoBox variant="danger">{error}</InfoBox>}

        <div style={{display:'flex',gap:'var(--space-2)',marginTop:'var(--space-2)'}}>
          <Button type="button" variant="ghost" onClick={onBack} style={{flex:1}}>← Voltar</Button>
          <Button type="submit" disabled={loading} style={{flex:2}}>
            {loading ? '⏳ Conectando...' : '🔗 Conectar banco'}
          </Button>
        </div>
      </form>
    </div>
  );
}

function ConnectingStep({ bank, onDone }) {
  useEffect(()=>{
    const t = setTimeout(onDone, 3000);
    return ()=>clearTimeout(t);
  },[]);
  return (
    <div style={{textAlign:'center',padding:'var(--space-8) var(--space-4)'}}>
      <div style={{fontSize:48,marginBottom:'var(--space-4)',animation:'spin 1s linear infinite',display:'inline-block'}}>⏳</div>
      <p style={{fontSize:'var(--text-lg)',fontWeight:'var(--font-semibold)',color:'var(--text)',marginBottom:'var(--space-2)'}}>Conectando ao {bank?.name}...</p>
      <p style={{fontSize:'var(--text-sm)',color:'var(--text3)'}}>Aguarde enquanto verificamos suas credenciais. Isso pode levar alguns segundos.</p>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function ConnectionCard({ conn, onSync, onToggleAutoSync, onDelete, syncing }) {
  const s = STATUS_CONFIG[conn.status] || STATUS_CONFIG.default;
  const lastSync = conn.last_sync_at
    ? new Date(conn.last_sync_at).toLocaleString('pt-BR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})
    : 'Nunca sincronizado';

  return (
    <Card style={{marginBottom:'var(--space-3)'}}>
      <div style={{padding:'var(--space-4)'}}>
        <div style={{display:'flex',alignItems:'flex-start',gap:'var(--space-3)'}}>
          {conn.bank_logo
            ? <img src={conn.bank_logo} alt={conn.bank_name} style={{width:44,height:44,borderRadius:'var(--radius-md)',objectFit:'contain',background:'#fff',padding:3,border:'1px solid var(--border)',flexShrink:0}}/>
            : <div style={{width:44,height:44,borderRadius:'var(--radius-md)',background:'var(--bg3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>🏦</div>
          }
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:'flex',alignItems:'center',gap:'var(--space-2)',flexWrap:'wrap',marginBottom:'var(--space-1)'}}>
              <p style={{fontSize:'var(--text-md)',fontWeight:'var(--font-semibold)',color:'var(--text)'}}>{conn.bank_name}</p>
              <span style={{fontSize:11,fontWeight:'var(--font-semibold)',color:s.color,background:s.bg,borderRadius:'var(--radius-full)',padding:'1px 8px'}}>
                {s.icon} {s.label}
              </span>
            </div>
            <p style={{fontSize:'var(--text-xs)',color:'var(--text3)'}}>Última sync: {lastSync}</p>
            {conn.error_msg && <p style={{fontSize:'var(--text-xs)',color:'var(--red)',marginTop:2}}>⚠️ {conn.error_msg}</p>}
          </div>
        </div>

        {/* Controles */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:'var(--space-4)',paddingTop:'var(--space-3)',borderTop:'1px solid var(--border)',flexWrap:'wrap',gap:'var(--space-2)'}}>
          {/* Toggle auto-sync */}
          <div style={{display:'flex',alignItems:'center',gap:'var(--space-2)'}}>
            <button onClick={()=>onToggleAutoSync(conn)}
              style={{width:40,height:22,borderRadius:11,border:'none',cursor:'pointer',position:'relative',background:conn.auto_sync?'var(--indigo)':'var(--bg3)',transition:'background 0.3s'}}>
              <span style={{position:'absolute',top:2,left:conn.auto_sync?20:2,width:18,height:18,borderRadius:'50%',background:'#fff',transition:'left 0.3s',boxShadow:'0 1px 3px rgba(0,0,0,0.2)'}}/>
            </button>
            <span style={{fontSize:'var(--text-xs)',color:'var(--text3)'}}>Sync automático</span>
          </div>

          {/* Ações */}
          <div style={{display:'flex',gap:'var(--space-2)'}}>
            <Button size="sm" onClick={()=>onSync(conn.id)} disabled={syncing===conn.id}>
              {syncing===conn.id?'⏳ Sincronizando...':'🔄 Sincronizar'}
            </Button>
            <Button size="sm" variant="danger" onClick={()=>onDelete(conn)}>Desconectar</Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function ConnectionsPage() {
  const [connections, setConnections] = useState([]);
  const [banks,       setBanks]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [showModal,   setShowModal]   = useState(false);
  const [step,        setStep]        = useState(STEPS.SELECT_BANK);
  const [selectedBank,setSelectedBank]= useState(null);
  const [bankDetail,  setBankDetail]  = useState(null);
  const [syncing,     setSyncing]     = useState(null);
  const [syncResult,  setSyncResult]  = useState(null);
  const { confirm, ConfirmDialog }    = useConfirm();

  async function load() {
    setLoading(true);
    try {
      const [connRes, bankRes] = await Promise.all([
        api.get('/api/pluggy/connections'),
        api.get('/api/pluggy/banks'),
      ]);
      setConnections(connRes.data || []);
      setBanks(bankRes.data || []);
    } catch {}
    setLoading(false);
  }

  useEffect(()=>{ load(); },[]);

  async function handleSelectBank(bank) {
    setSelectedBank(bank);
    setStep(STEPS.FILL_FORM);
    // Busca detalhes e formulário do banco
    try {
      const { data } = await api.get(`/api/pluggy/banks/${bank.id}`);
      setBankDetail(data);
    } catch { setBankDetail(bank); }
  }

  async function handleConnect(bank, credentials) {
    setStep(STEPS.CONNECTING);
    try {
      await api.post('/api/pluggy/connect', {
        connector_id: bank.id,
        credentials,
        bank_name:    bank.name,
        bank_logo:    bank.logo,
      });
      setShowModal(false);
      setStep(STEPS.SELECT_BANK);
      await load();
    } catch(err) {
      setStep(STEPS.FILL_FORM);
      throw err;
    }
  }

  async function handleSync(connId) {
    setSyncing(connId); setSyncResult(null);
    try {
      const { data } = await api.post(`/api/pluggy/sync/${connId}`);
      setSyncResult({ type:'success', msg:`✅ ${data.imported} transação${data.imported!==1?'ões':''} importada${data.imported!==1?'s':''} • ${data.duplicates} duplicada${data.duplicates!==1?'s':''}` });
      await load();
    } catch(err) {
      setSyncResult({ type:'error', msg:`❌ ${err.response?.data?.error||'Erro ao sincronizar'}` });
    }
    setSyncing(null);
  }

  async function handleToggleAutoSync(conn) {
    try {
      await api.patch(`/api/pluggy/connections/${conn.id}/auto-sync`, { enabled: !conn.auto_sync });
      setConnections(prev=>prev.map(c=>c.id===conn.id?{...c,auto_sync:!c.auto_sync}:c));
    } catch {}
  }

  async function handleDelete(conn) {
    const ok = await confirm({
      title:        `Desconectar ${conn.bank_name}?`,
      message:      'As transações já importadas serão mantidas, mas a sincronização automática será cancelada.',
      confirmLabel: 'Desconectar',
      icon:         '🔌',
      variant:      'danger',
    });
    if (!ok) return;
    await api.delete(`/api/pluggy/connections/${conn.id}`);
    setConnections(prev=>prev.filter(c=>c.id!==conn.id));
  }

  function closeModal() { setShowModal(false); setStep(STEPS.SELECT_BANK); setBankDetail(null); }

  return (
    <PageShell maxWidth={700}>
      <ConfirmDialog/>

      <PageHeader
        title="Conexões bancárias"
        subtitle="Sincronize automaticamente via Open Finance"
        action={<Button onClick={()=>setShowModal(true)}>+ Conectar banco</Button>}
      />

      <InfoBox variant="info" style={{marginBottom:'var(--space-5)'}}>
        🔒 Conexões via Open Finance são reguladas pelo Banco Central. Suas credenciais nunca são armazenadas pelo Ei! — passam diretamente para seu banco via Pluggy.
      </InfoBox>

      {syncResult && (
        <InfoBox variant={syncResult.type==='success'?'success':'danger'} style={{marginBottom:'var(--space-4)'}}>
          {syncResult.msg}
        </InfoBox>
      )}

      {loading ? (
        <div style={{textAlign:'center',padding:'var(--space-8)',color:'var(--text3)'}}>Carregando conexões...</div>
      ) : connections.length === 0 ? (
        <Card>
          <div style={{padding:'var(--space-8)',textAlign:'center'}}>
            <div style={{fontSize:48,marginBottom:'var(--space-3)'}}>🏦</div>
            <p style={{fontSize:'var(--text-md)',fontWeight:'var(--font-semibold)',color:'var(--text)',marginBottom:'var(--space-2)'}}>Nenhum banco conectado</p>
            <p style={{fontSize:'var(--text-sm)',color:'var(--text3)',marginBottom:'var(--space-4)'}}>Conecte seu banco para importar transações automaticamente, sem precisar exportar extratos.</p>
            <Button onClick={()=>setShowModal(true)}>+ Conectar primeiro banco</Button>
          </div>
        </Card>
      ) : (
        <>
          {connections.map(conn=>(
            <ConnectionCard key={conn.id} conn={conn}
              onSync={handleSync} onToggleAutoSync={handleToggleAutoSync}
              onDelete={handleDelete} syncing={syncing}/>
          ))}
          <div style={{marginTop:'var(--space-3)',textAlign:'center'}}>
            <Button variant="ghost" size="sm" onClick={()=>setShowModal(true)}>+ Conectar outro banco</Button>
          </div>
        </>
      )}

      {/* Modal de conexão */}
      {showModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',backdropFilter:'blur(4px)',display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:50,padding:'var(--space-4)'}} onClick={closeModal}>
          <div style={{background:'var(--bg2)',border:'1px solid var(--border-md)',borderRadius:'var(--radius-xl) var(--radius-xl) 0 0',width:'100%',maxWidth:500,padding:'8px 22px 32px',maxHeight:'92vh',overflowY:'auto'}} onClick={e=>e.stopPropagation()}>
            <div style={{width:36,height:4,borderRadius:2,background:'var(--bg3)',margin:'10px auto 20px'}}/>

            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'var(--space-4)'}}>
              <h2 style={{fontSize:'var(--text-lg)',fontWeight:'var(--font-semibold)'}}>
                {step===STEPS.SELECT_BANK && 'Selecionar banco'}
                {step===STEPS.FILL_FORM   && 'Inserir credenciais'}
                {step===STEPS.CONNECTING  && 'Conectando...'}
              </h2>
              <button onClick={closeModal} style={{width:28,height:28,borderRadius:'var(--radius-sm)',border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text2)',cursor:'pointer',fontSize:16}}>×</button>
            </div>

            {step===STEPS.SELECT_BANK && <BankSearch banks={banks} onSelect={handleSelectBank}/>}
            {step===STEPS.FILL_FORM   && <BankForm bank={bankDetail||selectedBank} onBack={()=>setStep(STEPS.SELECT_BANK)} onConnect={handleConnect}/>}
            {step===STEPS.CONNECTING  && <ConnectingStep bank={selectedBank} onDone={closeModal}/>}
          </div>
        </div>
      )}
    </PageShell>
  );
}
