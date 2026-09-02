import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../lib/api';

const fmt     = v  => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);
const fmtDate = d  => new Date(d+'T00:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'});

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function GlobalSearch({ onClose }) {
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total,   setTotal]   = useState(null);
  const inputRef  = useRef();
  const debounced = useDebounce(query, 350);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Fecha com Escape
  useEffect(() => {
    function handle(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [onClose]);

  useEffect(() => {
    if (!debounced || debounced.length < 2) { setResults([]); setTotal(null); return; }
    setLoading(true);
    api.get(`/api/search?q=${encodeURIComponent(debounced)}&limit=30`)
      .then(r => {
        setResults(r.data || []);
        setTotal(r.data?.length || 0);
      })
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [debounced]);

  // Agrupa por mês
  const grouped = results.reduce((acc, tx) => {
    const d   = new Date(tx.date+'T00:00:00');
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const lbl = d.toLocaleString('pt-BR',{month:'long',year:'numeric'});
    if (!acc[key]) acc[key] = { label: lbl, items: [] };
    acc[key].items.push(tx);
    return acc;
  }, {});

  const income  = results.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0);
  const expense = results.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);

  return (
    <>
      <style>{`
        @keyframes search-in {
          from{opacity:0;transform:translateY(-16px);}
          to{opacity:1;transform:translateY(0);}
        }
        .search-result-row:hover { background:var(--bg3) !important; }
      `}</style>

      {/* Overlay */}
      <div style={{position:'fixed',inset:0,zIndex:60,background:'rgba(0,0,0,0.55)',backdropFilter:'blur(4px)'}} onClick={onClose}/>

      {/* Modal */}
      <div style={{
        position:'fixed', top:80, left:'50%', transform:'translateX(-50%)',
        zIndex:61, width:'100%', maxWidth:580,
        background:'var(--bg2)', border:'1px solid var(--border-md)',
        borderRadius:'var(--radius-xl)', boxShadow:'0 16px 64px rgba(0,0,0,0.3)',
        animation:'search-in 0.2s ease forwards',
        maxHeight:'80vh', display:'flex', flexDirection:'column',
        padding: 'var(--space-1)',
      }}>
        {/* Campo de busca */}
        <div style={{display:'flex',alignItems:'center',gap:'var(--space-3)',padding:'var(--space-3) var(--space-4)',borderBottom:'1px solid var(--border)'}}>
          <span style={{fontSize:18,color:'var(--text3)',flexShrink:0}}>{loading?'⏳':'🔍'}</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e=>setQuery(e.target.value)}
            placeholder="Buscar em todas as transações..."
            style={{flex:1,border:'none',background:'transparent',fontSize:'var(--text-md)',color:'var(--text)',fontFamily:'var(--font)',outline:'none'}}
          />
          {query && (
            <button onClick={()=>setQuery('')}
              style={{width:24,height:24,borderRadius:'var(--radius-full)',border:'none',background:'var(--bg3)',color:'var(--text3)',cursor:'pointer',fontSize:14,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              ×
            </button>
          )}
          <kbd style={{fontSize:'var(--text-xs)',color:'var(--text3)',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:'2px 6px',flexShrink:0}}>ESC</kbd>
        </div>

        {/* Resultados */}
        <div style={{overflowY:'auto',flex:1}}>
          {/* Estado inicial */}
          {!query && (
            <div style={{padding:'var(--space-8)',textAlign:'center',color:'var(--text3)'}}>
              <div style={{fontSize:36,marginBottom:'var(--space-2)'}}>🔍</div>
              <p style={{fontSize:'var(--text-sm)'}}>Digite para buscar em todo o histórico</p>
              <p style={{fontSize:'var(--text-xs)',marginTop:'var(--space-1)'}}>Mínimo 2 caracteres</p>
            </div>
          )}

          {/* Sem resultados */}
          {query.length >= 2 && !loading && results.length === 0 && (
            <div style={{padding:'var(--space-8)',textAlign:'center',color:'var(--text3)'}}>
              <div style={{fontSize:36,marginBottom:'var(--space-2)'}}>🤷</div>
              <p style={{fontSize:'var(--text-sm)'}}>Nenhuma transação encontrada para "{query}"</p>
            </div>
          )}

          {/* Resumo dos resultados */}
          {results.length > 0 && (
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'var(--space-2) var(--space-4)',background:'var(--bg3)',borderBottom:'1px solid var(--border)'}}>
              <span style={{fontSize:'var(--text-xs)',color:'var(--text3)'}}>{total} resultado{total!==1?'s':''} para "{debounced}"</span>
              <div style={{display:'flex',gap:'var(--space-3)'}}>
                <span style={{fontSize:'var(--text-xs)',color:'var(--green)',fontFamily:'var(--mono)',fontWeight:'var(--font-semibold)'}}>↑ {fmt(income)}</span>
                <span style={{fontSize:'var(--text-xs)',color:'var(--red)',fontFamily:'var(--mono)',fontWeight:'var(--font-semibold)'}}>↓ {fmt(expense)}</span>
              </div>
            </div>
          )}

          {/* Lista agrupada por mês */}
          {Object.entries(grouped).map(([key,group])=>(
            <div key={key}>
              <div style={{padding:'var(--space-2) var(--space-4)',background:'var(--bg3)',borderBottom:'1px solid var(--border)'}}>
                <span style={{fontSize:'var(--text-xs)',color:'var(--text3)',fontWeight:'var(--font-semibold)',textTransform:'capitalize'}}>{group.label}</span>
              </div>
              {group.items.map(tx=>(
                <div key={tx.id} className="search-result-row"
                  style={{display:'flex',alignItems:'center',gap:'var(--space-3)',padding:'var(--space-3) var(--space-4)',borderBottom:'1px solid var(--border)',transition:'background var(--transition)',cursor:'default',background:'var(--bg2)'}}>
                  {/* Dot de categoria */}
                  <div style={{width:8,height:8,borderRadius:'var(--radius-full)',background:tx.categories?.color||'var(--border)',flexShrink:0}}/>
                  {/* Info */}
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{fontSize:'var(--text-sm)',color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontWeight:'var(--font-medium)'}}>{tx.description||'—'}</p>
                    <div style={{display:'flex',gap:'var(--space-2)',marginTop:1}}>
                      <span style={{fontSize:'var(--text-xs)',color:'var(--text3)'}}>{fmtDate(tx.date)}</span>
                      {tx.categories && <span style={{fontSize:'var(--text-xs)',color:'var(--text3)'}}>• {tx.categories.name}</span>}
                    </div>
                  </div>
                  {/* Valor */}
                  <span style={{fontFamily:'var(--mono)',fontSize:'var(--text-sm)',fontWeight:'var(--font-semibold)',color:tx.type==='income'?'var(--green)':'var(--red)',flexShrink:0}}>
                    {tx.type==='income'?'+':'-'}{fmt(tx.amount)}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Atalho de teclado */}
        <div style={{padding:'var(--space-2) var(--space-4)',borderTop:'1px solid var(--border)',display:'flex',gap:'var(--space-3)'}}>
          <span style={{fontSize:'var(--text-xs)',color:'var(--text3)'}}>
            <kbd style={{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:4,padding:'1px 5px',fontSize:10}}>ESC</kbd> fechar
          </span>
        </div>
      </div>
    </>
  );
}
