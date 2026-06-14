import { useState, useEffect } from 'react';
import api from '../lib/api';
import Navbar from '../components/Navbar';
import RecurringModal from '../components/RecurringModal';

const fmt=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v);

export default function RecurringPage() {
  const [items,setItems]=useState([]);
  const [loading,setLoading]=useState(true);
  const [showModal,setShowModal]=useState(false);
  const [editing,setEditing]=useState(null);
  const [generating,setGenerating]=useState(false);
  const [generated,setGenerated]=useState(null);

  async function load(){ setLoading(true); const {data}=await api.get('/api/recurring'); setItems(data); setLoading(false); }
  useEffect(()=>{load();},[]);

  async function handleGenerate(){ setGenerating(true); const {data}=await api.post('/api/recurring/generate'); setGenerated(data.generated); setGenerating(false); }
  async function handleToggle(item){ await api.put(`/api/recurring/${item.id}`,{...item,active:!item.active}); load(); }
  async function handleDelete(id){ if(!confirm('Excluir esta recorrente?')) return; await api.delete(`/api/recurring/${id}`); load(); }

  const active=items.filter(i=>i.active);
  const inactive=items.filter(i=>!i.active);

  return(
    <div style={{minHeight:'100vh',background:'var(--bg)'}}>
      <Navbar/>
      <main className="page-main" style={{maxWidth:640,margin:'0 auto',padding:'24px 16px 80px'}}>
        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:24,flexWrap:'wrap',gap:12}}>
          <div>
            <h1 style={{fontSize:20,fontWeight:600,letterSpacing:'-0.03em'}}>Recorrentes</h1>
            <p style={{color:'var(--text3)',fontSize:13,marginTop:4}}>Transações automáticas</p>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={handleGenerate} disabled={generating} style={{padding:'9px 14px',borderRadius:10,border:'1px solid var(--border)',background:'var(--bg2)',color:'var(--text2)',fontFamily:'var(--font)',fontSize:13,fontWeight:500,cursor:'pointer'}}>
              {generating?'⏳':'▶'} Gerar mês
            </button>
            <button onClick={()=>setShowModal(true)} style={{padding:'9px 16px',borderRadius:10,border:'none',background:'linear-gradient(135deg,var(--indigo),#a78bfa)',color:'#fff',fontFamily:'var(--font)',fontSize:13,fontWeight:600,cursor:'pointer'}}>＋ Nova</button>
          </div>
        </div>

        {generated!==null&&(
          <div style={{background:generated>0?'var(--green-dim)':'var(--bg3)',border:`1px solid ${generated>0?'rgba(45,212,160,0.25)':'var(--border)'}`,borderRadius:10,padding:'12px 16px',marginBottom:16,fontSize:13,color:generated>0?'var(--green)':'var(--text3)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <span>{generated>0?`✓ ${generated} transação(ões) gerada(s)!`:'Nada novo — já foi gerado neste mês.'}</span>
            <button onClick={()=>setGenerated(null)} style={{background:'none',border:'none',cursor:'pointer',color:'inherit',fontSize:16}}>×</button>
          </div>
        )}

        {loading?[1,2,3].map(i=><div key={i} className="skeleton" style={{height:64,borderRadius:10,marginBottom:8}}/>)
        :items.length===0?(
          <div style={{textAlign:'center',padding:'60px 0',color:'var(--text3)'}}>
            <div style={{fontSize:36,marginBottom:12}}>🔄</div>
            <p style={{fontSize:13}}>Nenhuma recorrente cadastrada.</p>
            <button onClick={()=>setShowModal(true)} style={{marginTop:12,background:'none',border:'none',color:'var(--indigo)',fontSize:13,cursor:'pointer',fontFamily:'var(--font)'}}>Criar →</button>
          </div>
        ):(<>
          {active.length>0&&<Section title={`Ativas (${active.length})`}>{active.map(i=><RRow key={i.id} item={i} onEdit={()=>{setEditing(i);setShowModal(true);}} onDelete={()=>handleDelete(i.id)} onToggle={()=>handleToggle(i)}/>)}</Section>}
          {inactive.length>0&&<Section title={`Pausadas (${inactive.length})`} style={{marginTop:14,opacity:0.7}}>{inactive.map(i=><RRow key={i.id} item={i} onEdit={()=>{setEditing(i);setShowModal(true);}} onDelete={()=>handleDelete(i.id)} onToggle={()=>handleToggle(i)}/>)}</Section>}
        </>)}
      </main>
      {showModal&&<RecurringModal item={editing} onClose={()=>{setShowModal(false);setEditing(null);}} onSave={()=>{setShowModal(false);setEditing(null);load();}}/>}
    </div>
  );
}

function Section({title,children,style}){
  return(
    <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:14,overflow:'hidden',...style}}>
      <div style={{padding:'10px 16px',borderBottom:'1px solid var(--border)'}}><span style={{fontSize:11,color:'var(--text3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.07em'}}>{title}</span></div>
      {children}
    </div>
  );
}

function RRow({item,onEdit,onDelete,onToggle}){
  const [hovered,setHovered]=useState(false);
  return(
    <div onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)}
      style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 16px',borderBottom:'1px solid var(--border)',transition:'background 0.15s',background:hovered?'var(--bg3)':'transparent'}}>
      <div style={{display:'flex',alignItems:'center',gap:12}}>
        <div style={{width:34,height:34,borderRadius:9,background:item.type==='income'?'var(--green-dim)':'var(--red-dim)',border:`1px solid ${item.type==='income'?'rgba(45,212,160,0.2)':'rgba(240,94,110,0.2)'}`,display:'flex',alignItems:'center',justifyContent:'center',color:item.type==='income'?'var(--green)':'var(--red)',fontSize:14,fontWeight:700}}>🔄</div>
        <div>
          <p style={{fontSize:13,fontWeight:500,color:'var(--text)'}}>{item.description||'—'}</p>
          <div style={{display:'flex',gap:6,marginTop:2}}>
            <span style={{fontSize:11,color:'var(--text3)'}}>{item.frequency==='weekly'?'Semanal':'Mensal'}</span>
            {item.day_of_month&&<span style={{fontSize:11,color:'var(--text3)'}}>· Dia {item.day_of_month}</span>}
            {item.categories&&<span style={{fontSize:11,color:'var(--text3)'}}>· {item.categories.name}</span>}
          </div>
        </div>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:10}}>
        <span style={{fontFamily:'var(--mono)',fontSize:13,fontWeight:500,color:item.type==='income'?'var(--green)':'var(--red)'}}>{item.type==='income'?'+':'-'}{new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(item.amount)}</span>
        {hovered&&(
          <div style={{display:'flex',gap:6}}>
            <button onClick={onToggle} style={{fontSize:12,color:item.active?'var(--amber)':'var(--green)',background:item.active?'rgba(245,166,35,0.12)':'var(--green-dim)',border:'none',borderRadius:6,padding:'4px 10px',cursor:'pointer',fontFamily:'var(--font)'}}>{item.active?'Pausar':'Ativar'}</button>
            <button onClick={onEdit}   style={{fontSize:12,color:'var(--indigo)',background:'var(--indigo-dim)',border:'none',borderRadius:6,padding:'4px 10px',cursor:'pointer',fontFamily:'var(--font)'}}>Editar</button>
            <button onClick={onDelete} style={{fontSize:12,color:'var(--red)',background:'var(--red-dim)',border:'none',borderRadius:6,padding:'4px 10px',cursor:'pointer',fontFamily:'var(--font)'}}>Excluir</button>
          </div>
        )}
      </div>
    </div>
  );
}
