import { useState, useMemo } from 'react';

const fmt  = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v);
const inpS = { padding:'10px 12px', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text)', width:'100%' };

export default function TransactionList({ transactions, loading, onEdit, onDelete }) {
  const [search,     setSearch]     = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterCat,  setFilterCat]  = useState('all');

  const categories = useMemo(() => {
    const m = {};
    (transactions||[]).forEach(tx => { if(tx.categories) m[tx.categories.id] = tx.categories; });
    return Object.values(m);
  }, [transactions]);

  const filtered = useMemo(() => (transactions||[]).filter(tx => {
    const ms = !search || tx.description?.toLowerCase().includes(search.toLowerCase()) || tx.categories?.name?.toLowerCase().includes(search.toLowerCase());
    const mt = filterType==='all' || tx.type===filterType;
    const mc = filterCat==='all'  || tx.category_id===filterCat;
    return ms && mt && mc;
  }), [transactions, search, filterType, filterCat]);

  const hasFilters = search || filterType!=='all' || filterCat!=='all';

  if (loading) return (
    <div style={{display:'flex',flexDirection:'column',gap:8}}>
      {[1,2,3,4].map(i=><div key={i} className="skeleton" style={{height:60,borderRadius:10}}/>)}
    </div>
  );

  return (
    <div>
      <style>{`
        .tx-actions { opacity: 0; transition: opacity 0.15s; }
        .tx-row:hover .tx-actions { opacity: 1; }
        @media (max-width: 640px) { .tx-actions { opacity: 1 !important; } }
      `}</style>

      {/* Filtros */}
      <div className="filters-row" style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:16}}>
        <div style={{flex:1,minWidth:140,position:'relative'}}>
          <span style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'var(--text3)',fontSize:14}}>⌕</span>
          <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar..." style={{...inpS,paddingLeft:30}}/>
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
        {hasFilters && (
          <button onClick={()=>{setSearch('');setFilterType('all');setFilterCat('all');}}
            style={{...inpS,width:'auto',cursor:'pointer',color:'var(--text3)',whiteSpace:'nowrap',padding:'10px 14px'}}>
            Limpar
          </button>
        )}
      </div>

      {hasFilters && <p style={{fontSize:12,color:'var(--text3)',marginBottom:12}}>{filtered.length} resultado{filtered.length!==1?'s':''}</p>}

      {!transactions?.length ? (
        <p style={{textAlign:'center',color:'var(--text3)',fontSize:13,padding:'32px 0'}}>Nenhuma transação neste mês</p>
      ) : filtered.length===0 ? (
        <p style={{textAlign:'center',color:'var(--text3)',fontSize:13,padding:'32px 0'}}>Nenhuma transação encontrada</p>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:2}}>
          {filtered.map((tx,i) => (
            <TxRow key={tx.id} tx={tx} onEdit={onEdit} onDelete={onDelete} i={i}/>
          ))}
        </div>
      )}
    </div>
  );
}

function TxRow({ tx, onEdit, onDelete, i }) {
  const isIncome = tx.type === 'income';

  return (
    <div
      className="tx-row"
      style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'11px 10px',borderRadius:10,transition:'background 0.15s',animationDelay:`${i*20}ms`,gap:8}}
      className="tx-row fade-up"
      onMouseEnter={e=>e.currentTarget.style.background='var(--bg3)'}
      onMouseLeave={e=>e.currentTarget.style.background='transparent'}
    >
      {/* Ícone + info */}
      <div style={{display:'flex',alignItems:'center',gap:10,minWidth:0,flex:1}}>
        <div style={{
          width:34,height:34,borderRadius:9,flexShrink:0,
          background:isIncome?'var(--green-dim)':'var(--red-dim)',
          border:`1px solid ${isIncome?'rgba(45,212,160,0.2)':'rgba(240,94,110,0.2)'}`,
          display:'flex',alignItems:'center',justifyContent:'center',
          color:isIncome?'var(--green)':'var(--red)',fontSize:13,fontWeight:700,
        }}>
          {isIncome?'↑':'↓'}
        </div>
        <div style={{minWidth:0}}>
          <p style={{fontSize:13,fontWeight:500,color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
            {tx.description || tx.categories?.name || '—'}
          </p>
          <div style={{display:'flex',alignItems:'center',gap:5,marginTop:2,flexWrap:'wrap'}}>
            {tx.categories && (
              <span style={{fontSize:11,color:'var(--text3)',display:'flex',alignItems:'center',gap:3}}>
                <span style={{width:5,height:5,borderRadius:'50%',background:tx.categories.color,display:'inline-block',flexShrink:0}}/>
                {tx.categories.name}
              </span>
            )}
            <span style={{fontSize:11,color:'var(--text3)'}}>
              {tx.categories?'·':''} {new Date(tx.date+'T00:00:00').toLocaleDateString('pt-BR')}
            </span>
          </div>
        </div>
      </div>

      {/* Valor + botões */}
      <div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0}}>
        <span style={{fontFamily:'var(--mono)',fontSize:13,fontWeight:600,color:isIncome?'var(--green)':'var(--red)',whiteSpace:'nowrap'}}>
          {isIncome?'+':'-'}{fmt(tx.amount)}
        </span>

        {/* Botões inline — sempre visíveis no mobile, aparecem no hover no desktop */}
        <div className="tx-actions" style={{display:'flex',gap:4}}>
          <button
            onPointerUp={() => onEdit(tx)}
            style={{
              padding:'5px 10px',borderRadius:7,border:'none',cursor:'pointer',
              background:'var(--indigo-dim)',color:'var(--indigo)',
              fontSize:12,fontWeight:500,fontFamily:'var(--font)',
              whiteSpace:'nowrap',lineHeight:1.2,
            }}
          >
            Editar
          </button>
          <button
            onPointerUp={() => onDelete(tx.id)}
            style={{
              padding:'5px 10px',borderRadius:7,border:'none',cursor:'pointer',
              background:'var(--red-dim)',color:'var(--red)',
              fontSize:12,fontWeight:500,fontFamily:'var(--font)',
              whiteSpace:'nowrap',lineHeight:1.2,
            }}
          >
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
}
