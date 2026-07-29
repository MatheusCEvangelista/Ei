import { useState, useEffect } from 'react';
import api from '../lib/api';

const inp = { width:'100%', padding:'11px 14px', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text)' };
const lbl = { display:'block', fontSize:12, color:'var(--text2)', fontWeight:500, marginBottom:6, letterSpacing:'0.02em' };

const ICONS  = ['💳','🏦','💰','🛒','✈️','🎮','🍔','🚗'];
const COLORS = ['#7c7ff7','#2dd4a0','#f05e6e','#f5a623','#06b6d4','#a78bfa','#ec4899','#14b8a6'];

export default function CreditCardModal({ card, onClose, onSave }) {
  const [form, setForm] = useState({ name:'', limit_amount:'', closing_day:'', due_day:'', color:'#7c7ff7', icon:'💳' });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  useEffect(() => {
    if (card) setForm({ name:card.name, limit_amount:card.limit_amount, closing_day:card.closing_day||'', due_day:card.due_day||'', color:card.color||'#7c7ff7', icon:card.icon||'💳' });
  }, [card]);

  async function handleSubmit(e) {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      if (card) await api.put(`/api/credit-cards/${card.id}`, form);
      else      await api.post('/api/credit-cards', form);
      onSave();
    } catch(err) { setError(err.response?.data?.error||'Erro ao salvar'); }
    finally { setLoading(false); }
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.65)',backdropFilter:'blur(4px)',display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:50}} onClick={onClose}>
      <div style={{background:'var(--bg2)',border:'1px solid var(--border-md)',borderRadius:'18px 18px 0 0',width:'100%',maxWidth:480,padding:'8px 24px 32px',maxHeight:'90vh',overflowY:'auto',boxShadow:'var(--shadow)'}} className="fade-up" onClick={e=>e.stopPropagation()}>
        <div style={{width:36,height:4,borderRadius:2,background:'var(--bg3)',margin:'10px auto 20px'}}/>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:22}}>
          <h2 style={{fontSize:16,fontWeight:600}}>{card?'Editar cartão':'Novo cartão'}</h2>
          <button onClick={onClose} style={{width:28,height:28,borderRadius:7,border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text2)',cursor:'pointer',fontSize:16}}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            <div>
              <label style={lbl}>NOME DO CARTÃO</label>
              <input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Ex: Nubank, Inter, Itaú..." style={inp}/>
            </div>

            <div>
              <label style={lbl}>LIMITE (R$)</label>
              <input type="number" step="0.01" min="0" value={form.limit_amount} onChange={e=>setForm({...form,limit_amount:e.target.value})} placeholder="5000,00" style={{...inp,fontFamily:'var(--mono)'}}/>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div>
                <label style={lbl}>DIA DO FECHAMENTO</label>
                <input type="number" min="1" max="31" value={form.closing_day} onChange={e=>setForm({...form,closing_day:e.target.value})} placeholder="1" style={inp}/>
              </div>
              <div>
                <label style={lbl}>DIA DO VENCIMENTO</label>
                <input type="number" min="1" max="31" value={form.due_day} onChange={e=>setForm({...form,due_day:e.target.value})} placeholder="10" style={inp}/>
              </div>
            </div>

            <div>
              <label style={lbl}>ÍCONE</label>
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                {ICONS.map(ic=>(
                  <button key={ic} type="button" onClick={()=>setForm({...form,icon:ic})}
                    style={{width:38,height:38,borderRadius:9,border:`2px solid ${form.icon===ic?'var(--indigo)':'var(--border)'}`,background:form.icon===ic?'var(--indigo-dim)':'var(--bg3)',fontSize:18,cursor:'pointer'}}>
                    {ic}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={lbl}>COR</label>
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                {COLORS.map(c=>(
                  <button key={c} type="button" onClick={()=>setForm({...form,color:c})}
                    style={{width:30,height:30,borderRadius:'50%',border:`3px solid ${form.color===c?'var(--text)':'transparent'}`,background:c,cursor:'pointer',transition:'border 0.15s'}}/>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div style={{background:`linear-gradient(135deg,${form.color}33,${form.color}11)`,border:`1px solid ${form.color}44`,borderRadius:12,padding:'14px 16px',display:'flex',alignItems:'center',gap:10}}>
              <div style={{width:40,height:40,borderRadius:10,background:form.color+'44',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>{form.icon}</div>
              <div>
                <p style={{fontSize:14,fontWeight:600,color:'var(--text)'}}>{form.name||'Nome do cartão'}</p>
                <p style={{fontSize:12,color:'var(--text3)',marginTop:2}}>
                  {form.closing_day?`Fecha dia ${form.closing_day}`:''}{form.due_day?` · Vence dia ${form.due_day}`:''}
                </p>
              </div>
            </div>

            {error&&<p style={{fontSize:13,color:'var(--red)',background:'var(--red-dim)',borderRadius:8,padding:'10px 12px'}}>{error}</p>}

            <div style={{display:'flex',gap:10}}>
              <button type="button" onClick={onClose} style={{flex:1,padding:'13px 0',borderRadius:10,fontSize:14,fontWeight:500,border:'1px solid var(--border)',background:'transparent',color:'var(--text2)',cursor:'pointer',fontFamily:'var(--font)'}}>Cancelar</button>
              <button type="submit" disabled={loading} style={{flex:2,padding:'13px 0',borderRadius:10,fontSize:14,fontWeight:600,border:'none',cursor:'pointer',fontFamily:'var(--font)',background:loading?'var(--bg3)':'linear-gradient(135deg,var(--indigo),#a78bfa)',color:loading?'var(--text3)':'#fff'}}>
                {loading?'Salvando...':'Salvar'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
