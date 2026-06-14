import { useState, useEffect } from 'react';
import api from '../lib/api';

const COLORS=['#7c7ff7','#a78bfa','#ec4899','#f05e6e','#f5a623','#2dd4a0','#06b6d4','#3b82f6','#84cc16','#f97316','#8b90a4','#14b8a6'];
const inp={width:'100%',padding:'11px 14px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:8,color:'var(--text)'};
const lbl={display:'block',fontSize:12,color:'var(--text2)',fontWeight:500,marginBottom:6,letterSpacing:'0.02em'};
const fmt=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v);

export default function GoalModal({goal,categories,onClose,onSave}){
  const [form,setForm]=useState({name:'',target_amount:'',current_amount:'',deadline:'',category_id:'',color:'#7c7ff7',investment_id:''});
  const [investments,setInvestments]=useState([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');

  useEffect(()=>{
    api.get('/api/investments').then(r=>setInvestments(r.data));
    if(goal) setForm({name:goal.name,target_amount:goal.target_amount,current_amount:goal.current_amount,deadline:goal.deadline||'',category_id:goal.category_id||'',color:goal.color||'#7c7ff7',investment_id:goal.investment_id||''});
  },[goal]);

  async function handleSubmit(e){
    e.preventDefault(); setError(''); setLoading(true);
    try{
      if(goal) await api.put(`/api/goals/${goal.id}`,form);
      else     await api.post('/api/goals',form);
      onSave();
    }catch(err){setError(err.response?.data?.error||'Erro ao salvar');}
    finally{setLoading(false);}
  }

  const pct=form.target_amount>0?Math.min(100,Math.round(Number(form.current_amount)/Number(form.target_amount)*100)):0;
  const selInv=investments.find(i=>i.id===form.investment_id);
  const investedVal=selInv?Number(selInv.quantity)*Number(selInv.avg_price):0;

  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.65)',backdropFilter:'blur(4px)',display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:50,overflowY:'auto'}} onClick={onClose}>
      <div style={{background:'var(--bg2)',border:'1px solid var(--border-md)',borderRadius:'18px 18px 0 0',width:'100%',maxWidth:480,padding:'8px 24px 32px',boxShadow:'var(--shadow)',maxHeight:'92vh',overflowY:'auto'}} className="fade-up" onClick={e=>e.stopPropagation()}>
        <div style={{width:36,height:4,borderRadius:2,background:'var(--bg3)',margin:'10px auto 20px'}}/>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:22}}>
          <h2 style={{fontSize:16,fontWeight:600}}>{goal?'Editar meta':'Nova meta'}</h2>
          <button onClick={onClose} style={{width:28,height:28,borderRadius:7,border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text2)',cursor:'pointer',fontSize:16}}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            {/* Preview */}
            <div style={{background:'var(--bg3)',borderRadius:10,padding:'12px 14px'}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                <span style={{fontSize:13,fontWeight:500,color:form.name?'var(--text)':'var(--text3)'}}>{form.name||'Nome da meta'}</span>
                <span style={{fontSize:12,fontFamily:'var(--mono)',color:form.color}}>{pct}%</span>
              </div>
              <div style={{height:6,background:'var(--bg2)',borderRadius:99,overflow:'hidden'}}>
                <div style={{height:'100%',width:`${pct}%`,background:form.color,borderRadius:99,transition:'width 0.3s'}}/>
              </div>
            </div>
            <div><label style={lbl}>NOME DA META</label>
              <input type="text" required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Ex: Viagem, Notebook..." style={inp}/>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div><label style={lbl}>VALOR ALVO (R$)</label>
                <input type="number" step="0.01" min="0" required value={form.target_amount} onChange={e=>setForm({...form,target_amount:e.target.value})} placeholder="0,00" style={{...inp,fontFamily:'var(--mono)'}}/>
              </div>
              <div><label style={lbl}>JÁ GUARDADO (R$)</label>
                <input type="number" step="0.01" min="0" value={form.current_amount} onChange={e=>setForm({...form,current_amount:e.target.value})} placeholder="0,00" disabled={!!form.investment_id} style={{...inp,fontFamily:'var(--mono)',color:'var(--green)',opacity:form.investment_id?0.5:1}}/>
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div><label style={lbl}>PRAZO (OPCIONAL)</label>
                <input type="date" value={form.deadline} onChange={e=>setForm({...form,deadline:e.target.value})} style={inp}/>
              </div>
              <div><label style={lbl}>CATEGORIA</label>
                <select value={form.category_id} onChange={e=>setForm({...form,category_id:e.target.value})} style={inp}>
                  <option value="">Sem categoria</option>
                  {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            {/* Vincular investimento */}
            <div style={{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:10,padding:'14px 16px'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:form.investment_id?12:0}}>
                <div>
                  <p style={{fontSize:13,fontWeight:500,color:'var(--text)'}}>📈 Vincular investimento</p>
                  <p style={{fontSize:11,color:'var(--text3)',marginTop:2}}>Progresso calculado pelo valor investido</p>
                </div>
                <button type="button" onClick={()=>setForm({...form,investment_id:form.investment_id?'':(investments[0]?.id||'')})}
                  style={{width:40,height:22,borderRadius:99,border:'none',cursor:'pointer',background:form.investment_id?'var(--indigo)':'var(--bg2)',transition:'background 0.2s',position:'relative',flexShrink:0}}>
                  <span style={{position:'absolute',top:3,width:16,height:16,borderRadius:'50%',background:'#fff',transition:'left 0.2s',left:form.investment_id?21:3}}/>
                </button>
              </div>
              {form.investment_id&&(
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  <select value={form.investment_id} onChange={e=>setForm({...form,investment_id:e.target.value})} style={inp}>
                    {investments.map(i=><option key={i.id} value={i.id}>{i.name}{i.ticker?` (${i.ticker})`:''}</option>)}
                  </select>
                  {selInv&&(
                    <div style={{display:'flex',justifyContent:'space-between',padding:'8px 10px',background:'var(--indigo-dim)',borderRadius:8}}>
                      <span style={{fontSize:12,color:'var(--text2)'}}>Valor investido atual</span>
                      <span style={{fontFamily:'var(--mono)',fontSize:13,fontWeight:600,color:'var(--indigo)'}}>{fmt(investedVal)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            {/* Cores */}
            <div>
              <label style={lbl}>COR</label>
              <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:8}}>
                {COLORS.map(c=>(
                  <button key={c} type="button" onClick={()=>setForm({...form,color:c})} style={{width:'100%',aspectRatio:'1',borderRadius:9,background:c,border:form.color===c?'2px solid #fff':'2px solid transparent',cursor:'pointer',boxShadow:form.color===c?`0 0 0 3px ${c}55`:'none',display:'flex',alignItems:'center',justifyContent:'center',transition:'transform 0.15s'}}
                    onMouseOver={e=>e.currentTarget.style.transform='scale(1.1)'}
                    onMouseOut={e=>e.currentTarget.style.transform='scale(1)'}>
                    {form.color===c&&<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                  </button>
                ))}
              </div>
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
