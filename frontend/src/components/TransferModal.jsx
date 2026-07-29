import { useState, useEffect } from 'react';
import api from '../lib/api';

const inp = { width:'100%', padding:'11px 14px', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text)' };
const lbl = { display:'block', fontSize:12, color:'var(--text2)', fontWeight:500, marginBottom:6, letterSpacing:'0.02em' };
const fmt = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v);

export default function TransferModal({ onClose, onSave }) {
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({
    from_account_id: '', to_account_id: '', amount: '',
    date: new Date().toISOString().split('T')[0], description: '',
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  useEffect(()=>{ api.get('/api/accounts').then(r=>setAccounts(r.data)); },[]);

  const fromAccount = accounts.find(a=>a.id===form.from_account_id);
  const toAccount   = accounts.find(a=>a.id===form.to_account_id);

  async function handleSubmit(e) {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      await api.post('/api/transfers', form);
      onSave();
    } catch(err) { setError(err.response?.data?.error||'Erro ao realizar transferência'); }
    finally { setLoading(false); }
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.65)',backdropFilter:'blur(4px)',display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:50}} onClick={onClose}>
      <div style={{background:'var(--bg2)',border:'1px solid var(--border-md)',borderRadius:'18px 18px 0 0',width:'100%',maxWidth:460,padding:'8px 24px 32px',boxShadow:'var(--shadow)'}} className="fade-up" onClick={e=>e.stopPropagation()}>
        <div style={{width:36,height:4,borderRadius:2,background:'var(--bg3)',margin:'10px auto 20px'}}/>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:22}}>
          <h2 style={{fontSize:16,fontWeight:600}}>🔄 Transferência entre contas</h2>
          <button onClick={onClose} style={{width:28,height:28,borderRadius:7,border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text2)',cursor:'pointer',fontSize:16}}>×</button>
        </div>

        <div style={{background:'var(--indigo-dim)',border:'1px solid rgba(124,127,247,0.2)',borderRadius:9,padding:'10px 14px',marginBottom:18,fontSize:12,color:'var(--indigo)'}}>
          ℹ️ Transferências não são contadas como receita ou despesa no dashboard.
        </div>

        {/* Preview visual da transferência */}
        {(fromAccount || toAccount) && (
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:18,padding:'12px 14px',background:'var(--bg3)',borderRadius:10,border:'1px solid var(--border)'}}>
            <div style={{flex:1,textAlign:'center'}}>
              {fromAccount
                ? <><div style={{fontSize:20}}>{fromAccount.icon}</div><p style={{fontSize:12,color:'var(--text)',fontWeight:500,marginTop:3}}>{fromAccount.name}</p></>
                : <p style={{fontSize:12,color:'var(--text3)'}}>Origem</p>}
            </div>
            <div style={{fontSize:20,color:'var(--indigo)',fontWeight:700}}>→</div>
            <div style={{flex:1,textAlign:'center'}}>
              {toAccount
                ? <><div style={{fontSize:20}}>{toAccount.icon}</div><p style={{fontSize:12,color:'var(--text)',fontWeight:500,marginTop:3}}>{toAccount.name}</p></>
                : <p style={{fontSize:12,color:'var(--text3)'}}>Destino</p>}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{display:'flex',flexDirection:'column',gap:14}}>

            {/* Contas */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <div>
                <label style={lbl}>DE (ORIGEM)</label>
                <select required value={form.from_account_id} onChange={e=>setForm({...form,from_account_id:e.target.value})} style={inp}>
                  <option value="">Selecione...</option>
                  {accounts.filter(a=>a.id!==form.to_account_id).map(a=>(
                    <option key={a.id} value={a.id}>{a.icon} {a.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={lbl}>PARA (DESTINO)</label>
                <select required value={form.to_account_id} onChange={e=>setForm({...form,to_account_id:e.target.value})} style={inp}>
                  <option value="">Selecione...</option>
                  {accounts.filter(a=>a.id!==form.from_account_id).map(a=>(
                    <option key={a.id} value={a.id}>{a.icon} {a.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Valor */}
            <div>
              <label style={lbl}>VALOR (R$)</label>
              <input type="number" step="0.01" min="0.01" required value={form.amount}
                onChange={e=>setForm({...form,amount:e.target.value})}
                placeholder="0,00"
                style={{...inp,fontFamily:'var(--mono)',fontSize:20,fontWeight:600,textAlign:'center'}}/>
            </div>

            {/* Data e descrição */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <div>
                <label style={lbl}>DATA</label>
                <input type="date" required value={form.date} onChange={e=>setForm({...form,date:e.target.value})} style={inp}/>
              </div>
              <div>
                <label style={lbl}>DESCRIÇÃO (OPCIONAL)</label>
                <input type="text" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}
                  placeholder="Ex: Reserva de emergência" style={inp}/>
              </div>
            </div>

            {error&&<p style={{fontSize:13,color:'var(--red)',background:'var(--red-dim)',borderRadius:8,padding:'10px 12px'}}>{error}</p>}

            <button type="submit" disabled={loading} style={{padding:'14px 0',borderRadius:10,fontSize:14,fontWeight:600,border:'none',cursor:'pointer',fontFamily:'var(--font)',background:loading?'var(--bg3)':'linear-gradient(135deg,var(--indigo),#a78bfa)',color:loading?'var(--text3)':'#fff',marginTop:4}}>
              {loading?'Transferindo...':form.amount?`Transferir ${fmt(form.amount)}`:'Confirmar transferência'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
