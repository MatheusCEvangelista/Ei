import { useState, useEffect } from 'react';
import api from '../lib/api';
import Navbar from '../components/Navbar';
import CategoryModal from '../components/CategoryModal';

export default function CategoriesPage() {
  const [categories,setCategories]=useState([]);
  const [loading,setLoading]=useState(true);
  const [showModal,setShowModal]=useState(false);
  const [editing,setEditing]=useState(null);

  async function load() {
    setLoading(true);
    try{ const {data}=await api.get('/api/categories'); setCategories(data); }
    finally{ setLoading(false); }
  }
  useEffect(()=>{load();},[]);

  async function handleDelete(id) {
    if(!confirm('Excluir esta categoria?')) return;
    try{ await api.delete(`/api/categories/${id}`); load(); }
    catch(err){ alert(err.response?.data?.error||'Erro ao excluir'); }
  }

  const fixed=categories.filter(c=>c.is_fixed);
  const custom=categories.filter(c=>!c.is_fixed);

  return(
    <div style={{minHeight:'100vh',background:'var(--bg)'}}>
      <Navbar/>
      <main className="page-main" style={{maxWidth:640,margin:'0 auto',padding:'24px 16px 80px'}}>
        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:28}}>
          <div>
            <h1 style={{fontSize:20,fontWeight:600,letterSpacing:'-0.03em'}}>Categorias</h1>
            <p style={{color:'var(--text3)',fontSize:13,marginTop:4}}>Gerencie suas categorias de despesas</p>
          </div>
          <button onClick={()=>setShowModal(true)} style={{padding:'9px 16px',borderRadius:10,border:'none',background:'linear-gradient(135deg,var(--indigo),#a78bfa)',color:'#fff',fontFamily:'var(--font)',fontSize:13,fontWeight:600,cursor:'pointer'}}>＋ Nova categoria</button>
        </div>
        <Section title={`Padrão (${fixed.length})`} loading={loading}>
          {fixed.map((cat,i)=><CatRow key={cat.id} category={cat} i={i} onEdit={()=>{setEditing(cat);setShowModal(true);}} onDelete={()=>handleDelete(cat.id)}/>)}
        </Section>
        <Section title={`Personalizadas (${custom.length})`} loading={loading} style={{marginTop:14}}>
          {custom.length===0&&!loading?(
            <div style={{textAlign:'center',padding:'28px 0'}}>
              <p style={{color:'var(--text3)',fontSize:13}}>Nenhuma categoria personalizada.</p>
              <button onClick={()=>setShowModal(true)} style={{marginTop:10,background:'none',border:'none',color:'var(--indigo)',fontSize:13,cursor:'pointer',fontFamily:'var(--font)'}}>Criar →</button>
            </div>
          ):custom.map((cat,i)=><CatRow key={cat.id} category={cat} i={i} onEdit={()=>{setEditing(cat);setShowModal(true);}} onDelete={()=>handleDelete(cat.id)}/>)}
        </Section>
      </main>
      {showModal&&<CategoryModal category={editing} onClose={()=>{setShowModal(false);setEditing(null);}} onSave={()=>{setShowModal(false);setEditing(null);load();}}/>}
    </div>
  );
}

function Section({title,children,loading,style}){
  return(
    <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:'18px 18px 10px',...style}}>
      <p style={{fontSize:11,color:'var(--text3)',fontWeight:600,letterSpacing:'0.07em',textTransform:'uppercase',marginBottom:14}}>{title}</p>
      {loading?[1,2,3].map(i=><div key={i} className="skeleton" style={{height:48,marginBottom:6}}/>):children}
    </div>
  );
}

function CatRow({category,onEdit,onDelete,i}){
  const [hovered,setHovered]=useState(false);
  return(
    <div onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)}
      style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 8px',borderRadius:10,transition:'background 0.15s',background:hovered?'var(--bg3)':'transparent',animationDelay:`${i*40}ms`}} className="fade-up">
      <div style={{display:'flex',alignItems:'center',gap:12}}>
        <div style={{width:36,height:36,borderRadius:10,flexShrink:0,background:category.color+'22',border:`1px solid ${category.color}44`,display:'flex',alignItems:'center',justifyContent:'center',color:category.color,fontSize:15,fontWeight:700}}>
          {category.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <p style={{fontSize:13,fontWeight:500,color:'var(--text)'}}>{category.name}</p>
          <p style={{fontSize:11,color:'var(--text3)',marginTop:1}}>{category.is_fixed?'Padrão do sistema':'Personalizada'}</p>
        </div>
      </div>
      {hovered&&!category.is_fixed&&(
        <div style={{display:'flex',gap:8}}>
          <button onClick={onEdit} style={{fontSize:12,color:'var(--indigo)',background:'var(--indigo-dim)',border:'none',borderRadius:6,padding:'4px 10px',cursor:'pointer',fontFamily:'var(--font)'}}>Editar</button>
          <button onClick={onDelete} style={{fontSize:12,color:'var(--red)',background:'var(--red-dim)',border:'none',borderRadius:6,padding:'4px 10px',cursor:'pointer',fontFamily:'var(--font)'}}>Excluir</button>
        </div>
      )}
    </div>
  );
}
