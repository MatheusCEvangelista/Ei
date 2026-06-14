import { useState, useEffect } from 'react';
import api from '../lib/api';

const BANK_PRESETS=[
  {name:'Itaú',         icon:'🏦',color:'#f5a623'},
  {name:'Nubank',       icon:'💜',color:'#8b5cf6'},
  {name:'Mercado Pago', icon:'💳',color:'#06b6d4'},
  {name:'Inter',        icon:'🔶',color:'#f97316'},
  {name:'Bradesco',     icon:'🏧',color:'#ef4444'},
  {name:'C6 Bank',      icon:'⚫',color:'#4f5468'},
  {name:'Caixa',        icon:'🏛',color:'#2dd4a0'},
  {name:'Santander',    icon:'🔴',color:'#f05e6e'},
  {name:'Carteira',     icon:'👛',color:'#84cc16'},
  {name:'Outro',        icon:'🏦',color:'#7c7ff7'},
];
const inp={width:'100%',padding:'11px 14px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:8,color:'var(--text)'};
const lbl={display:'block',fontSize:12,color:'var(--text2)',fontWeight:500,marginBottom:6,letterSpacing:'0.02em'};

export default function AccountModal({account,onClose,onSave}){
  const [form,setForm]=useState({name:'',bank:'',icon:'🏦',color:'#7c7ff7'});
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');

  useEffect(()=>{
    if(account) setForm({name:account.name,bank:account.bank||'',icon:account.icon||'🏦',color:account.color||'#7c7ff7'});
  },[account]);

  function applyPreset(p){ setForm({name:p.name,bank:p.name,icon:p.icon,color:p.color}); }

  async function handleSubmit(e){
    e.preventDefault(); setError(''); setLoading(true);
    try{
      if(account) await api.put(`/api/accounts/${account.id}`,form);
      else        await api.post('/api/accounts',form);
      onSave();
    }catch(err){setError(err.response?.data?.error||'Erro ao salvar');}
    finally{setLoading(false);}
  }

  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.65)',backdropFilter:'blur(4px)',display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:50}} onClick={onClose}>
      <div style={{background:'var(--bg2)',border:'1px solid var(--border-md)',borderRadius:'18px 18px 0 0',width:'100%',maxWidth:480,padding:'8px 24px 32px',boxShadow:'var(--shadow)',maxHeight:'92vh',overflowY:'auto'}} className="fade-up" onClick={e=>e.stopPropagation()}>
        <div style={{width:36,height:4,borderRadius:2,background:'var(--bg3)',margin:'10px auto 20px'}}/>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:22}}>
          <h2 style={{fontSize:16,fontWeight:600}}>{account?'Editar conta':'Nova conta'}</h2>
          <button onClick={onClose} style={{width:28,height:28,borderRadius:7,border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text2)',cursor:'pointer',fontSize:16}}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            <div style={{display:'flex',justifyContent:'center'}}>
              <div style={{width:56,height:56,borderRadius:14,background:form.color+'22',border:`1px solid ${form.color}44`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:24}}>{form.icon}</div>
            </div>
            <div>
              <label style={lbl}>SELECIONE O BANCO</label>
              <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:8}}>
                {BANK_PRESETS.map(p=>(
                  <button key={p.name} type="button" onClick={()=>applyPreset(p)} style={{padding:'8px 4px',borderRadius:10,cursor:'pointer',textAlign:'center',border:`1.5px solid ${form.bank===p.name?p.color:'var(--border)'}`,background:form.bank===p.name?p.color+'22':'var(--bg3)',fontFamily:'var(--font)',transition:'all 0.15s'}}>
                    <div style={{fontSize:18,marginBottom:2}}>{p.icon}</div>
                    <div style={{fontSize:10,color:'var(--text3)',lineHeight:1.2}}>{p.name}</div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={lbl}>NOME DA CONTA</label>
              <input type="text" required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Ex: Conta corrente Itaú" style={inp}/>
            </div>
            {error&&<p style={{fontSize:13,color:'var(--red)',background:'var(--red-dim)',borderRadius:8,padding:'10px 12px'}}>{error}</p>}
            <div style={{display:'flex',gap:10}}>
              <button type="button" onClick={onClose} style={{flex:1,padding:'13px 0',borderRadius:10,fontSize:14,fontWeight:500,border:'1px solid var(--border)',background:'transparent',color:'var(--text2)',cursor:'pointer',fontFamily:'var(--font)'}}>Cancelar</button>
              <button type="submit" disabled={loading} style={{flex:2,padding:'13px 0',borderRadius:10,fontSize:14,fontWeight:600,border:'none',cursor:'pointer',fontFamily:'var(--font)',background:loading?'var(--bg3)':'linear-gradient(135deg,var(--indigo),#a78bfa)',color:loading?'var(--text3)':'#fff'}}>{loading?'Salvando...':'Salvar'}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
