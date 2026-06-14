import { useState, useEffect } from 'react';
import api from '../lib/api';
import Navbar from '../components/Navbar';
import GoalModal from '../components/GoalModal';

const fmt=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v);

function ProgressBar({value,target,color}){
  const pct=Math.min(100,Math.round((value/target)*100));
  const c=pct>=100?'var(--green)':pct>=80?'var(--amber)':color||'var(--indigo)';
  return(
    <div>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
        <span style={{fontSize:12,color:'var(--text3)'}}>{fmt(value)} de {fmt(target)}</span>
        <span style={{fontSize:12,fontFamily:'var(--mono)',fontWeight:600,color:c}}>{pct}%</span>
      </div>
      <div style={{height:6,background:'var(--bg3)',borderRadius:99,overflow:'hidden'}}>
        <div style={{height:'100%',width:`${pct}%`,background:c,borderRadius:99,transition:'width 0.4s'}}/>
      </div>
    </div>
  );
}

export default function GoalsPage() {
  const [goals,setGoals]=useState([]);
  const [categories,setCategories]=useState([]);
  const [loading,setLoading]=useState(true);
  const [showModal,setShowModal]=useState(false);
  const [editing,setEditing]=useState(null);
  const [depositGoal,setDepositGoal]=useState(null);
  const [depositAmount,setDepositAmount]=useState('');
  const [depositLoading,setDepositLoading]=useState(false);

  async function load(){
    setLoading(true);
    const [g,c]=await Promise.all([api.get('/api/goals'),api.get('/api/categories')]);
    setGoals(g.data); setCategories(c.data); setLoading(false);
  }
  useEffect(()=>{load();},[]);

  async function handleDeposit(goal){
    if(!depositAmount||isNaN(depositAmount)) return;
    setDepositLoading(true);
    await api.post(`/api/goals/${goal.id}/deposit`,{amount:parseFloat(depositAmount)});
    setDepositGoal(null); setDepositAmount(''); setDepositLoading(false); load();
  }
  async function handleDelete(id){ if(!confirm('Excluir esta meta?')) return; await api.delete(`/api/goals/${id}`); load(); }

  const daysLeft=deadline=>{ if(!deadline) return null; return Math.ceil((new Date(deadline)-new Date())/86400000); };
  const monthlyNeeded=goal=>{
    const eff=goal.investment_id?(goal.investment_current_amount||0):Number(goal.current_amount);
    const rem=goal.target_amount-eff; if(rem<=0) return 0;
    const days=daysLeft(goal.deadline); if(!days||days<=0) return rem;
    return rem/Math.max(1,Math.ceil(days/30));
  };

  return(
    <div style={{minHeight:'100vh',background:'var(--bg)'}}>
      <Navbar/>
      <main className="page-main" style={{maxWidth:720,margin:'0 auto',padding:'24px 16px 80px'}}>
        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:24,flexWrap:'wrap',gap:12}}>
          <div>
            <h1 style={{fontSize:20,fontWeight:600,letterSpacing:'-0.03em'}}>Metas de economia</h1>
            <p style={{color:'var(--text3)',fontSize:13,marginTop:4}}>Acompanhe seus objetivos financeiros</p>
          </div>
          <button onClick={()=>setShowModal(true)} style={{padding:'9px 16px',borderRadius:10,border:'none',background:'linear-gradient(135deg,var(--indigo),#a78bfa)',color:'#fff',fontFamily:'var(--font)',fontSize:13,fontWeight:600,cursor:'pointer'}}>＋ Nova meta</button>
        </div>
        {loading?(
          [1,2,3].map(i=><div key={i} className="skeleton" style={{height:140,borderRadius:14,marginBottom:12}}/>)
        ):goals.length===0?(
          <div style={{textAlign:'center',padding:'60px 0',color:'var(--text3)'}}>
            <div style={{fontSize:40,marginBottom:12}}>🎯</div>
            <p style={{fontSize:14}}>Nenhuma meta criada ainda.</p>
            <button onClick={()=>setShowModal(true)} style={{marginTop:12,background:'none',border:'none',color:'var(--indigo)',fontSize:13,cursor:'pointer',fontFamily:'var(--font)'}}>Criar primeira meta →</button>
          </div>
        ):(
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            {goals.map(goal=>{
              const eff=goal.investment_id?(goal.investment_current_amount||0):Number(goal.current_amount);
              const done=eff>=goal.target_amount;
              const days=daysLeft(goal.deadline);
              return(
                <div key={goal.id} style={{background:'var(--bg2)',border:`1px solid ${done?'rgba(45,212,160,0.25)':'var(--border)'}`,borderRadius:14,padding:'18px 20px'}} className="fade-up">
                  <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:10}}>
                    <div style={{display:'flex',alignItems:'center',gap:12}}>
                      <div style={{width:40,height:40,borderRadius:11,background:(goal.color||'#7c7ff7')+'22',border:`1px solid ${(goal.color||'#7c7ff7')}44`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>{goal.investment_id?'📈':'🎯'}</div>
                      <div>
                        <p style={{fontSize:14,fontWeight:600,color:'var(--text)'}}>{goal.name}</p>
                        <div style={{display:'flex',gap:6,marginTop:2,flexWrap:'wrap'}}>
                          {goal.categories&&<span style={{fontSize:11,color:'var(--text3)',display:'flex',alignItems:'center',gap:4}}><span style={{width:6,height:6,borderRadius:'50%',background:goal.categories.color,display:'inline-block'}}/>{goal.categories.name}</span>}
                          {goal.investment_id&&<span style={{fontSize:11,color:'var(--indigo)',background:'var(--indigo-dim)',borderRadius:4,padding:'1px 6px'}}>📈 {goal.investment_name}</span>}
                        </div>
                      </div>
                    </div>
                    <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
                      {done&&<span style={{fontSize:11,background:'var(--green-dim)',color:'var(--green)',borderRadius:6,padding:'3px 8px',fontWeight:600}}>✓ Concluída</span>}
                      {!done&&days!==null&&<span style={{fontSize:11,color:days<30?'var(--red)':'var(--text3)',background:days<30?'var(--red-dim)':'var(--bg3)',borderRadius:6,padding:'3px 8px'}}>{days>0?`${days}d restantes`:'Vencida'}</span>}
                      <button onClick={()=>{setEditing(goal);setShowModal(true);}} style={{fontSize:12,color:'var(--indigo)',background:'var(--indigo-dim)',border:'none',borderRadius:6,padding:'4px 10px',cursor:'pointer',fontFamily:'var(--font)'}}>Editar</button>
                      <button onClick={()=>handleDelete(goal.id)} style={{fontSize:12,color:'var(--red)',background:'var(--red-dim)',border:'none',borderRadius:6,padding:'4px 10px',cursor:'pointer',fontFamily:'var(--font)'}}>Excluir</button>
                    </div>
                  </div>
                  <ProgressBar value={eff} target={goal.target_amount} color={goal.color}/>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:14,flexWrap:'wrap',gap:8}}>
                    {!done&&<span style={{fontSize:12,color:'var(--text3)'}}>Aprox. <span style={{color:'var(--text)',fontFamily:'var(--mono)',fontWeight:500}}>{fmt(monthlyNeeded(goal))}/mês</span></span>}
                    {!done&&!goal.investment_id&&(
                      depositGoal?.id===goal.id?(
                        <div style={{display:'flex',gap:8,alignItems:'center'}}>
                          <input type="number" step="0.01" min="0" value={depositAmount} onChange={e=>setDepositAmount(e.target.value)} placeholder="Valor"
                            style={{width:110,padding:'6px 10px',fontSize:13,borderRadius:8,background:'var(--bg3)',border:'1px solid var(--border)',color:'var(--text)'}}/>
                          <button onClick={()=>handleDeposit(goal)} disabled={depositLoading} style={{fontSize:12,color:'#fff',background:'var(--green)',border:'none',borderRadius:7,padding:'6px 12px',cursor:'pointer',fontFamily:'var(--font)'}}>
                            {depositLoading?'...':'Confirmar'}
                          </button>
                          <button onClick={()=>{setDepositGoal(null);setDepositAmount('');}} style={{fontSize:12,color:'var(--text3)',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:7,padding:'6px 10px',cursor:'pointer',fontFamily:'var(--font)'}}>✕</button>
                        </div>
                      ):(
                        <button onClick={()=>setDepositGoal(goal)} style={{fontSize:12,color:'var(--green)',background:'var(--green-dim)',border:'none',borderRadius:7,padding:'6px 12px',cursor:'pointer',fontFamily:'var(--font)',fontWeight:500}}>+ Depositar</button>
                      )
                    )}
                    {goal.investment_id&&!done&&<span style={{fontSize:11,color:'var(--text3)'}}>Progresso via investimento vinculado</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
      {showModal&&<GoalModal goal={editing} categories={categories} onClose={()=>{setShowModal(false);setEditing(null);}} onSave={()=>{setShowModal(false);setEditing(null);load();}}/>}
    </div>
  );
}
