import { useState, useEffect } from 'react';
import api from '../lib/api';

const inp = { width:'100%', padding:'11px 14px', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text)' };
const lbl = { display:'block', fontSize:12, color:'var(--text2)', fontWeight:500, marginBottom:6, letterSpacing:'0.02em' };

export default function CreditCardExpenseModal({ card, onClose, onSave }) {
  const [form, setForm]     = useState({ description:'', amount:'', category_id:'', date: new Date().toISOString().split('T')[0] });
  const [categories, setCats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  useEffect(()=>{ api.get('/api/categories').then(r=>setCats(r.data)); },[]);

  async function handleSubmit(e) {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      await api.post('/api/transactions', {
        description:    form.description,
        amount:         parseFloat(form.amount),
        type:           'expense',
        category_id:    form.category_id || null,
        date:           form.date,
        credit_card_id: card.id,
        account_id:     null,
      });
      onSave();
    } catch(err) { setError(err.response?.data?.error||'Erro ao salvar'); }
    finally { setLoading(false); }
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.65)',backdropFilter:'blur(4px)',display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:50}} onClick={onClose}>
      <div style={{background:'var(--bg2)',border:'1px solid var(--border-md)',borderRadius:'18px 18px 0 0',width:'100%',maxWidth:440,padding:'8px 24px 32px',boxShadow:'var(--shadow)'}} className="fade-up" onClick={e=>e.stopPropagation()}>
        <div style={{width:36,height:4,borderRadius:2,background:'var(--bg3)',margin:'10px auto 20px'}}/>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
          <h2 style={{fontSize:16,fontWeight:600}}>Despesa no {card.name}</h2>
          <button onClick={onClose} style={{width:28,height:28,borderRadius:7,border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text2)',cursor:'pointer',fontSize:16}}>×</button>
        </div>
        <div style={{background:'var(--red-dim)',border:'1px solid rgba(240,94,110,0.2)',borderRadius:9,padding:'10px 14px',marginBottom:18,fontSize:12,color:'var(--red)'}}>
          💳 Lançando na fatura de <strong>{card.name}</strong> — não desconta saldo da conta
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div>
              <label style={lbl}>DESCRIÇÃO</label>
              <input required value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Ex: Supermercado, iFood..." style={inp}/>
            </div>
            <div>
              <label style={lbl}>VALOR (R$)</label>
              <input type="number" step="0.01" min="0.01" required value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} placeholder="0,00" style={{...inp,fontFamily:'var(--mono)',fontSize:18,fontWeight:600}}/>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div>
                <label style={lbl}>CATEGORIA</label>
                <select value={form.category_id} onChange={e=>setForm({...form,category_id:e.target.value})} style={inp}>
                  <option value="">Sem categoria</option>
                  {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>DATA</label>
                <input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} style={inp}/>
              </div>
            </div>
            {error&&<p style={{fontSize:13,color:'var(--red)',background:'var(--red-dim)',borderRadius:8,padding:'10px 12px'}}>{error}</p>}
            <div style={{display:'flex',gap:10,marginTop:4}}>
              <button type="button" onClick={onClose} style={{flex:1,padding:'13px 0',borderRadius:10,fontSize:14,border:'1px solid var(--border)',background:'transparent',color:'var(--text2)',cursor:'pointer',fontFamily:'var(--font)'}}>Cancelar</button>
              <button type="submit" disabled={loading} style={{flex:2,padding:'13px 0',borderRadius:10,fontSize:14,fontWeight:600,border:'none',cursor:'pointer',fontFamily:'var(--font)',background:loading?'var(--bg3)':'linear-gradient(135deg,var(--red),#f97316)',color:loading?'var(--text3)':'#fff'}}>
                {loading?'Salvando...':'Lançar despesa'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
