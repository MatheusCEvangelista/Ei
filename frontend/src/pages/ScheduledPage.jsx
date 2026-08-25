import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import api from '../lib/api';

const fmt     = v  => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);
const fmtDate = d  => new Date(d+'T00:00:00').toLocaleDateString('pt-BR');
const inpS    = { width:'100%',padding:'11px 14px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:8,color:'var(--text)' };
const lblS    = { display:'block',fontSize:12,color:'var(--text2)',fontWeight:500,marginBottom:6 };

// Modal para criar lançamento futuro
function FutureModal({ onSave, onClose }) {
  const [categories, setCategories] = useState([]);
  const [accounts,   setAccounts]   = useState([]);
  const [form, setForm] = useState({
    description:'', amount:'', type:'expense',
    date:'', category_id:'', account_id:'',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  useEffect(()=>{
    api.get('/api/categories').then(r=>setCategories(r.data||[])).catch(()=>{});
    api.get('/api/accounts').then(r=>setAccounts(r.data||[])).catch(()=>{});
  },[]);

  async function handleSave(e) {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      await api.post('/api/transactions', { ...form, amount: parseFloat(form.amount), status:'pending' });
      onSave();
    } catch(err) { setError(err.response?.data?.error||'Erro ao salvar'); }
    setSaving(false);
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',backdropFilter:'blur(4px)',display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:50,padding:16}} onClick={onClose}>
      <div style={{background:'var(--bg2)',border:'1px solid var(--border-md)',borderRadius:'18px 18px 0 0',width:'100%',maxWidth:480,padding:'8px 22px 32px',maxHeight:'90vh',overflowY:'auto',boxShadow:'var(--shadow)'}} className="fade-up" onClick={e=>e.stopPropagation()}>
        <div style={{width:36,height:4,borderRadius:2,background:'var(--bg3)',margin:'10px auto 20px'}}/>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
          <div>
            <h2 style={{fontSize:16,fontWeight:600}}>Lançamento futuro</h2>
            <p style={{fontSize:12,color:'var(--text3)',marginTop:2}}>Aparece no calendário, não conta no saldo até ser confirmado</p>
          </div>
          <button onClick={onClose} style={{width:28,height:28,borderRadius:7,border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text2)',cursor:'pointer',fontSize:16}}>×</button>
        </div>
        <form onSubmit={handleSave}>
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div style={{display:'flex',background:'var(--bg3)',borderRadius:9,padding:3,border:'1px solid var(--border)'}}>
              {['expense','income'].map(t=>(
                <button key={t} type="button" onClick={()=>setForm({...form,type:t})} style={{flex:1,padding:'8px',borderRadius:7,fontSize:13,fontWeight:500,border:'none',cursor:'pointer',fontFamily:'var(--font)',background:form.type===t?'var(--bg2)':'transparent',color:form.type===t?t==='income'?'var(--green)':'var(--red)':'var(--text3)',transition:'all 0.15s'}}>
                  {t==='income'?'↑ Receita':'↓ Despesa'}
                </button>
              ))}
            </div>
            <div>
              <label style={lblS}>Descrição</label>
              <input required type="text" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Ex: Aluguel de outubro" style={inpS}/>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <div>
                <label style={lblS}>Valor (R$)</label>
                <input required type="number" step="0.01" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} placeholder="0,00" style={inpS}/>
              </div>
              <div>
                <label style={lblS}>Data prevista</label>
                <input required type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} style={inpS}/>
              </div>
            </div>
            <div>
              <label style={lblS}>Categoria</label>
              <select value={form.category_id} onChange={e=>setForm({...form,category_id:e.target.value})} style={inpS}>
                <option value="">Sem categoria</option>
                {categories.map(c=><option key={c.id} value={c.id}>{c.icon||''} {c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={lblS}>Conta (opcional)</label>
              <select value={form.account_id} onChange={e=>setForm({...form,account_id:e.target.value})} style={inpS}>
                <option value="">Nenhuma</option>
                {accounts.map(a=><option key={a.id} value={a.id}>{a.icon||'🏦'} {a.name}</option>)}
              </select>
            </div>
            {error&&<p style={{fontSize:12,color:'var(--red)',background:'var(--red-dim)',borderRadius:7,padding:'8px 10px'}}>{error}</p>}
            <button type="submit" disabled={saving} style={{padding:'13px',borderRadius:10,border:'none',background:saving?'var(--bg3)':'linear-gradient(135deg,#7c3aed,#a78bfa)',color:saving?'var(--text3)':'#fff',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'var(--font)'}}>
              {saving?'Salvando...':'Agendar lançamento'}
            </button>
          </div>
        </form>
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

  async function confirm(id) {
    await api.patch(`/api/transactions/${id}/confirm`);
    setPending(prev=>prev.filter(t=>t.id!==id));
  }

  async function remove(id) {
    if (!confirm('Excluir este lançamento?')) return;
    await api.delete(`/api/transactions/${id}`);
    setPending(prev=>prev.filter(t=>t.id!==id));
  }

  const today    = new Date().toISOString().split('T')[0];
  const overdue  = pending.filter(t=>t.date<today);
  const upcoming = pending.filter(t=>t.date>=today);

  function Group({ title, items, color }) {
    if (!items.length) return null;
    return (
      <div style={{marginBottom:24}}>
        <p style={{fontSize:12,fontWeight:600,color,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:10}}>{title}</p>
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {items.map(tx=>(
            <div key={tx.id} style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:12,padding:'14px 16px',display:'flex',alignItems:'center',gap:12}}>
              <div style={{width:36,height:36,borderRadius:9,background:tx.type==='income'?'var(--green-dim)':'var(--red-dim)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700,color:tx.type==='income'?'var(--green)':'var(--red)',flexShrink:0}}>
                {tx.type==='income'?'↑':'↓'}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <p style={{fontSize:13,fontWeight:600,color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{tx.description||'—'}</p>
                <div style={{display:'flex',gap:8,marginTop:2}}>
                  <span style={{fontSize:11,color:'var(--text3)'}}>{fmtDate(tx.date)}</span>
                  {tx.categories&&<span style={{fontSize:11,color:'var(--text3)'}}>• {tx.categories.name}</span>}
                </div>
              </div>
              <div style={{textAlign:'right',flexShrink:0}}>
                <p style={{fontFamily:'var(--mono)',fontSize:13,fontWeight:700,color:tx.type==='income'?'var(--green)':'var(--red)',marginBottom:6}}>
                  {tx.type==='income'?'+':'-'}{fmt(tx.amount)}
                </p>
                <div style={{display:'flex',gap:5}}>
                  <button onClick={()=>confirm(tx.id)} style={{fontSize:11,padding:'4px 10px',borderRadius:6,border:'none',background:'var(--green-dim)',color:'var(--green)',cursor:'pointer',fontFamily:'var(--font)',fontWeight:600}}>
                    ✓ Confirmar
                  </button>
                  <button onClick={()=>remove(tx.id)} style={{fontSize:11,padding:'4px 8px',borderRadius:6,border:'none',background:'var(--red-dim)',color:'var(--red)',cursor:'pointer',fontFamily:'var(--font)'}}>
                    Excluir
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{minHeight:'100vh',background:'var(--bg)'}}>
      <Navbar/>
      <main className="page-main" style={{maxWidth:640,margin:'0 auto',padding:'24px 16px 80px'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8,flexWrap:'wrap',gap:12}}>
          <div>
            <h1 style={{fontSize:20,fontWeight:600,letterSpacing:'-0.03em'}}>Lançamentos futuros</h1>
            <p style={{fontSize:13,color:'var(--text3)',marginTop:4}}>Pendentes de confirmação — não contam no saldo atual</p>
          </div>
          <button onClick={()=>setShowModal(true)} style={{padding:'10px 18px',borderRadius:10,border:'none',background:'linear-gradient(135deg,var(--indigo),#a78bfa)',color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'var(--font)'}}>
            + Novo agendamento
          </button>
        </div>

        {/* Info box */}
        <div style={{background:'var(--indigo-dim)',border:'1px solid rgba(124,127,247,0.2)',borderRadius:10,padding:'12px 14px',marginBottom:20,fontSize:12,color:'var(--text2)',lineHeight:1.5}}>
          📅 Lançamentos futuros aparecem no <strong>calendário financeiro</strong> mas só entram no saldo quando você clicar em <strong>✓ Confirmar</strong>. Recorrentes também geram entradas aqui automaticamente no dia configurado.
        </div>

        {loading ? (
          [1,2,3].map(i=><div key={i} className="skeleton" style={{height:80,borderRadius:12,marginBottom:10}}/>)
        ) : pending.length===0 ? (
          <div style={{textAlign:'center',padding:'48px 0',color:'var(--text3)'}}>
            <div style={{fontSize:40,marginBottom:12}}>📅</div>
            <p style={{fontSize:14}}>Nenhum lançamento futuro agendado.</p>
          </div>
        ) : (
          <>
            <Group title={`⚠️ Vencidos (${overdue.length})`}    items={overdue}  color="var(--red)"/>
            <Group title={`📅 Próximos (${upcoming.length})`}   items={upcoming} color="var(--indigo)"/>
          </>
        )}
      </main>
      {showModal&&<FutureModal onSave={()=>{setShowModal(false);load();}} onClose={()=>setShowModal(false)}/>}
    </div>
  );
}
