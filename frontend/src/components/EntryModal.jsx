import { useState } from 'react';
import api from '../lib/api';

const inp={width:'100%',padding:'11px 14px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:8,color:'var(--text)'};
const lbl={display:'block',fontSize:12,color:'var(--text2)',fontWeight:500,marginBottom:6,letterSpacing:'0.02em'};
const fmt=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v);

export default function EntryModal({investment,onClose,onSave}){
  const today=new Date().toISOString().split('T')[0];
  const [form,setForm]=useState({quantity:'',price:'',date:today});
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const total=form.quantity&&form.price?Number(form.quantity)*Number(form.price):0;

  async function handleSubmit(e){
    e.preventDefault(); setError(''); setLoading(true);
    try{
      await api.post(`/api/investments/${investment.id}/entries`,form);
      onSave();
    }catch(err){setError(err.response?.data?.error||'Erro ao registrar');}
    finally{setLoading(false);}
  }

  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.65)',backdropFilter:'blur(4px)',display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:50}} onClick={onClose}>
      <div style={{background:'var(--bg2)',border:'1px solid var(--border-md)',borderRadius:'18px 18px 0 0',width:'100%',maxWidth:440,padding:'8px 24px 32px',boxShadow:'var(--shadow)'}} className="fade-up" onClick={e=>e.stopPropagation()}>
        <div style={{width:36,height:4,borderRadius:2,background:'var(--bg3)',margin:'10px auto 20px'}}/>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:22}}>
          <div>
            <h2 style={{fontSize:16,fontWeight:600}}>Registrar aporte</h2>
            <p style={{fontSize:12,color:'var(--text3)',marginTop:3}}>{investment.name}{investment.ticker?` · ${investment.ticker}`:''}</p>
          </div>
          <button onClick={onClose} style={{width:28,height:28,borderRadius:7,border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text2)',cursor:'pointer',fontSize:16}}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div><label style={lbl}>QUANTIDADE</label>
                <input type="number" step="any" min="0" required value={form.quantity} onChange={e=>setForm({...form,quantity:e.target.value})} placeholder="0" style={{...inp,fontFamily:'var(--mono)'}}/>
              </div>
              <div><label style={lbl}>PREÇO UNIT. (R$)</label>
                <input type="number" step="0.0001" min="0" required value={form.price} onChange={e=>setForm({...form,price:e.target.value})} placeholder="0,00" style={{...inp,fontFamily:'var(--mono)',color:'var(--indigo)'}}/>
              </div>
            </div>
            <div><label style={lbl}>DATA</label>
              <input type="date" required value={form.date} onChange={e=>setForm({...form,date:e.target.value})} style={inp}/>
            </div>
            {total>0&&(
              <div style={{background:'var(--bg3)',borderRadius:10,padding:'12px 14px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:13,color:'var(--text2)'}}>Total do aporte</span>
                <span style={{fontFamily:'var(--mono)',fontSize:15,fontWeight:600,color:'var(--green)'}}>{fmt(total)}</span>
              </div>
            )}
            {error&&<p style={{fontSize:13,color:'var(--red)',background:'var(--red-dim)',borderRadius:8,padding:'10px 12px'}}>{error}</p>}
            <div style={{display:'flex',gap:10}}>
              <button type="button" onClick={onClose} style={{flex:1,padding:'13px 0',borderRadius:10,fontSize:14,fontWeight:500,border:'1px solid var(--border)',background:'transparent',color:'var(--text2)',cursor:'pointer',fontFamily:'var(--font)'}}>Cancelar</button>
              <button type="submit" disabled={loading} style={{flex:2,padding:'13px 0',borderRadius:10,fontSize:14,fontWeight:600,border:'none',cursor:'pointer',fontFamily:'var(--font)',background:loading?'var(--bg3)':'linear-gradient(135deg,var(--green),#14b8a6)',color:loading?'var(--text3)':'#fff'}}>{loading?'Salvando...':'Registrar aporte'}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
