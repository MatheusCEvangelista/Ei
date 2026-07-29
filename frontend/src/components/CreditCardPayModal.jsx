import { useState, useEffect } from 'react';
import api from '../lib/api';

const inp = { width:'100%', padding:'11px 14px', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text)' };
const lbl = { display:'block', fontSize:12, color:'var(--text2)', fontWeight:500, marginBottom:6, letterSpacing:'0.02em' };
const fmt = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v);

export default function CreditCardPayModal({ card, onClose, onSave }) {
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({ account_id:'', amount: card.invoice_total||'', date: new Date().toISOString().split('T')[0] });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  useEffect(()=>{ api.get('/api/accounts').then(r=>setAccounts(r.data)); },[]);

  async function handleSubmit(e) {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      await api.post(`/api/credit-cards/${card.id}/pay`, {
        account_id: form.account_id,
        amount:     parseFloat(form.amount),
        date:       form.date,
      });
      onSave();
    } catch(err) { setError(err.response?.data?.error||'Erro ao registrar pagamento'); }
    finally { setLoading(false); }
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.65)',backdropFilter:'blur(4px)',display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:50}} onClick={onClose}>
      <div style={{background:'var(--bg2)',border:'1px solid var(--border-md)',borderRadius:'18px 18px 0 0',width:'100%',maxWidth:440,padding:'8px 24px 32px',boxShadow:'var(--shadow)'}} className="fade-up" onClick={e=>e.stopPropagation()}>
        <div style={{width:36,height:4,borderRadius:2,background:'var(--bg3)',margin:'10px auto 20px'}}/>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
          <h2 style={{fontSize:16,fontWeight:600}}>Pagar fatura — {card.name}</h2>
          <button onClick={onClose} style={{width:28,height:28,borderRadius:7,border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text2)',cursor:'pointer',fontSize:16}}>×</button>
        </div>

        <div style={{background:'var(--green-dim)',border:'1px solid rgba(45,212,160,0.25)',borderRadius:10,padding:'12px 16px',marginBottom:18}}>
          <p style={{fontSize:12,color:'var(--text3)',marginBottom:2}}>Valor da fatura atual</p>
          <p style={{fontFamily:'var(--mono)',fontSize:20,fontWeight:700,color:'var(--green)'}}>{fmt(card.invoice_total)}</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div>
              <label style={lbl}>DÉBITAR DA CONTA</label>
              <select required value={form.account_id} onChange={e=>setForm({...form,account_id:e.target.value})} style={inp}>
                <option value="">Selecione a conta...</option>
                {accounts.map(a=><option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>VALOR A PAGAR (R$)</label>
              <input type="number" step="0.01" min="0.01" required value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} style={{...inp,fontFamily:'var(--mono)',fontSize:16}}/>
              {Number(form.amount) < Number(card.invoice_total) && (
                <p style={{fontSize:11,color:'var(--amber)',marginTop:4}}>⚠️ Pagamento parcial — o restante permanece na fatura</p>
              )}
            </div>
            <div>
              <label style={lbl}>DATA DO PAGAMENTO</label>
              <input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} style={inp}/>
            </div>
            {error&&<p style={{fontSize:13,color:'var(--red)',background:'var(--red-dim)',borderRadius:8,padding:'10px 12px'}}>{error}</p>}
            <div style={{display:'flex',gap:10,marginTop:4}}>
              <button type="button" onClick={onClose} style={{flex:1,padding:'13px 0',borderRadius:10,fontSize:14,border:'1px solid var(--border)',background:'transparent',color:'var(--text2)',cursor:'pointer',fontFamily:'var(--font)'}}>Cancelar</button>
              <button type="submit" disabled={loading} style={{flex:2,padding:'13px 0',borderRadius:10,fontSize:14,fontWeight:600,border:'none',cursor:'pointer',fontFamily:'var(--font)',background:loading?'var(--bg3)':'linear-gradient(135deg,var(--green),#14b8a6)',color:loading?'var(--text3)':'#fff'}}>
                {loading?'Registrando...':'Confirmar pagamento'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
