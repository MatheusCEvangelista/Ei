import { useState, useMemo } from 'react';
const fmt     = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v);
const inpS = { padding:'10px 12px', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text)', width:'100%' };

export default function TransactionList({ transactions, loading, onEdit, onDelete }) {
  const [search,     setSearch]     = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterCat,  setFilterCat]  = useState('all');

  const categories = useMemo(()=>{
    const m={};
    (transactions||[]).forEach(tx=>{ if(tx.categories) m[tx.categories.id]=tx.categories; });
    return Object.values(m);
  },[transactions]);

  const filtered = useMemo(()=>(transactions||[]).filter(tx=>{
    const ms=!search||tx.description?.toLowerCase().includes(search.toLowerCase())||tx.categories?.name?.toLowerCase().includes(search.toLowerCase());
    const mt=filterType==='all'||tx.type===filterType;
    const mc=filterCat==='all'||tx.category_id===filterCat;
    return ms&&mt&&mc;
  }),[transactions,search,filterType,filterCat]);

  const hasFilters=search||filterType!=='all'||filterCat!=='all';

  if (loading) return <div style={{display:'flex',flexDirection:'column',gap:8}}>{[1,2,3,4].map(i=><div key={i} className="skeleton" style={{height:56}}/>)}</div>;

  return (
    <div>
      <div className="filters-row" style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:16}}>
        <div style={{flex:1,minWidth:140,position:'relative'}}>
          <span style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'var(--text3)'}}>⌕</span>
          <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar..." style={{...inpS,paddingLeft:28}}/>
        </div>
        <select value={filterType} onChange={e=>setFilterType(e.target.value)} style={inpS}>
          <option value="all">Todos os tipos</option>
          <option value="income">Receitas</option>
          <option value="expense">Despesas</option>
        </select>
        <select value={filterCat} onChange={e=>setFilterCat(e.target.value)} style={inpS}>
          <option value="all">Todas as categorias</option>
          {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {hasFilters&&(
          <button onClick={()=>{setSearch('');setFilterType('all');setFilterCat('all');}} style={{...inpS,width:'auto',cursor:'pointer',color:'var(--text3)',whiteSpace:'nowrap',padding:'10px 14px'}}>Limpar</button>
        )}
      </div>
      {hasFilters&&<p style={{fontSize:12,color:'var(--text3)',marginBottom:12}}>{filtered.length} resultado{filtered.length!==1?'s':''}</p>}

      {!transactions?.length?(
        <p style={{textAlign:'center',color:'var(--text3)',fontSize:13,padding:'32px 0'}}>Nenhuma transação neste mês</p>
      ):filtered.length===0?(
        <p style={{textAlign:'center',color:'var(--text3)',fontSize:13,padding:'32px 0'}}>Nenhuma transação encontrada</p>
      ):(
        <div style={{display:'flex',flexDirection:'column',gap:2}}>
          {filtered.map((tx,i)=><TxRow key={tx.id} tx={tx} onEdit={onEdit} onDelete={onDelete} i={i}/>)}
        </div>
      )}
    </div>
  );
}

function TxRow({ tx, onEdit, onDelete, i }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isIncome = tx.type==='income';

  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 10px',borderRadius:10,transition:'background 0.15s',animationDelay:`${i*30}ms`}}
      className="fade-up"
      onMouseOver={e=>e.currentTarget.style.background='var(--bg3)'}
      onMouseOut={e=>{ if(!menuOpen) e.currentTarget.style.background='transparent'; }}>

      <div style={{display:'flex',alignItems:'center',gap:12,minWidth:0}}>
        <div style={{width:36,height:36,borderRadius:10,flexShrink:0,background:isIncome?'var(--green-dim)':'var(--red-dim)',border:`1px solid ${isIncome?'rgba(45,212,160,0.2)':'rgba(240,94,110,0.2)'}`,display:'flex',alignItems:'center',justifyContent:'center',color:isIncome?'var(--green)':'var(--red)',fontSize:14,fontWeight:700}}>
          {isIncome?'↑':'↓'}
        </div>
        <div style={{minWidth:0}}>
          <p className="text-truncate" style={{fontSize:13,fontWeight:500,color:'var(--text)'}}>{tx.description||tx.categories?.name||'—'}</p>
          <div style={{display:'flex',alignItems:'center',gap:6,marginTop:2}}>
            {tx.categories&&<span style={{fontSize:11,color:'var(--text3)',display:'flex',alignItems:'center',gap:4}}><span style={{width:6,height:6,borderRadius:'50%',background:tx.categories.color,display:'inline-block',flexShrink:0}}/>{tx.categories.name}</span>}
            <span style={{fontSize:11,color:'var(--text3)'}}>· {new Date(tx.date+'T00:00:00').toLocaleDateString('pt-BR')}</span>
          </div>
        </div>
      </div>

      <div style={{display:'flex',alignItems:'center',gap:10,flexShrink:0,marginLeft:8}}>
        <span style={{fontFamily:'var(--mono)',fontSize:13,fontWeight:500,color:isIncome?'var(--green)':'var(--red)'}}>{isIncome?'+':'-'}{fmt(tx.amount)}</span>

        {/* Botão ⋯ único para desktop e mobile */}
        <div style={{position:'relative'}}>
          <button
            onClick={()=>setMenuOpen(v=>!v)}
            style={{width:28,height:28,borderRadius:7,background:'var(--bg3)',border:'1px solid var(--border)',color:'var(--text2)',fontSize:15,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}
          >⋯</button>

          {menuOpen&&(
            <>
              {/* Overlay para fechar ao clicar fora */}
              <div style={{position:'fixed',inset:0,zIndex:19}} onClick={()=>setMenuOpen(false)}/>
              <div style={{position:'absolute',right:0,top:34,zIndex:20,background:'var(--bg2)',border:'1px solid var(--border-md)',borderRadius:10,padding:6,display:'flex',flexDirection:'column',gap:4,boxShadow:'var(--shadow)',minWidth:120}}>
                <button onClick={()=>{onEdit(tx);setMenuOpen(false);}} style={{fontSize:13,color:'var(--indigo)',background:'var(--indigo-dim)',border:'none',borderRadius:7,padding:'8px 12px',cursor:'pointer',fontFamily:'var(--font)',textAlign:'left',whiteSpace:'nowrap'}}>✏️ Editar</button>
                <button onClick={()=>{onDelete(tx.id);setMenuOpen(false);}} style={{fontSize:13,color:'var(--red)',background:'var(--red-dim)',border:'none',borderRadius:7,padding:'8px 12px',cursor:'pointer',fontFamily:'var(--font)',textAlign:'left',whiteSpace:'nowrap'}}>🗑 Excluir</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
