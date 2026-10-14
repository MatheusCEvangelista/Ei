import { useState, useRef, useEffect } from 'react';
import { BANKS, parseFile, detectBank, extractPDFText } from './bankParsers';
import { Button, InfoBox, SectionLabel } from './ui';
import api from '../lib/api';

const fmt = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);

const CATEGORY_KEYWORDS = {
  'Alimentação':   ['ifood','rappi','uber eats','mcdonalds','burger','pizza','restaurante','lanchonete','padaria','açougue','supermercado','mercado','pao de acucar','extra','carrefour','atacadao'],
  'Transporte':    ['uber','99','cabify','taxi','posto','combustivel','gasolina','etanol','pedagio','metrô','metro','onibus','bilhete'],
  'Saúde':         ['farmacia','drogaria','hospital','clinica','laboratorio','exame','medico','dentista','unimed','plano de saude'],
  'Lazer':         ['netflix','spotify','amazon prime','disney','hbo','cinema','teatro','show','steam','playstation','xbox'],
  'Moradia':       ['aluguel','condominio','agua','energia','luz','gas','internet','telefone','celular','tim','vivo','claro','oi'],
  'Educação':      ['escola','faculdade','curso','livro','material','amazon','shopee','mercado livre'],
  'Vestuário':     ['renner','c&a','riachuelo','zara','hm','magazine','marisa','lojas'],
  'Investimentos': ['xp','nuinvest','warren','rico','inter invest','btg','tesouro'],
};

function autoCategory(description, categories) {
  if (!description || !categories?.length) return null;
  const lower = description.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
  for (const [catName, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) {
      const found = categories.find(c => c.name.toLowerCase().includes(catName.toLowerCase()));
      if (found) return found.id;
    }
  }
  return null;
}

const STEPS = { SELECT_BANK:0, SELECT_FILE:1, SWIPE_CATS:2, PREVIEW:3, DONE:4 };

// ── Componente de swipe de categorização ──────────────────────────────────
function SwipeCard({ tx, categories, onDecide }) {
  const cardRef   = useRef();
  const startX    = useRef(null);
  const currentX  = useRef(0);
  const [dx, setDx]       = useState(0);
  const [exiting, setExiting] = useState(null); // 'left'|'right'
  const [catId, setCatId] = useState(tx.category_id || null);

  const catName = catId ? (categories.find(c=>c.id===catId)?.name||'?') : 'Sem categoria';
  const catColor = catId ? (categories.find(c=>c.id===catId)?.color||'var(--indigo)') : 'var(--text3)';
  const absDx = Math.abs(dx);
  const opacity = Math.max(0.2, 1 - absDx/200);
  const rotate  = dx / 15;

  function handleStart(x) { startX.current = x; currentX.current = 0; }
  function handleMove(x) {
    if (startX.current === null) return;
    const d = x - startX.current;
    currentX.current = d;
    setDx(d);
  }
  function handleEnd() {
    if (startX.current === null) return;
    startX.current = null;
    const d = currentX.current;
    if (d > 80) { commit('right'); }
    else if (d < -80) { commit('left'); }
    else { setDx(0); }
  }
  function commit(dir) {
    setExiting(dir);
    setTimeout(() => {
      if (dir === 'right') onDecide({ ...tx, category_id: catId, selected: true });
      else                 onDecide({ ...tx, category_id: catId, selected: false });
    }, 280);
  }

  return (
    <div style={{position:'relative',userSelect:'none'}}>
      {/* Indicadores de swipe */}
      <div style={{position:'absolute',top:20,left:20,opacity:Math.max(0,(-dx-30)/80),zIndex:2,background:'var(--red-dim)',border:'2px solid var(--red)',borderRadius:8,padding:'4px 12px',color:'var(--red)',fontWeight:700,fontSize:13,transform:'rotate(-15deg)'}}>PULAR</div>
      <div style={{position:'absolute',top:20,right:20,opacity:Math.max(0,(dx-30)/80),zIndex:2,background:'var(--green-dim)',border:'2px solid var(--green)',borderRadius:8,padding:'4px 12px',color:'var(--green)',fontWeight:700,fontSize:13,transform:'rotate(15deg)'}}>✓ INCLUIR</div>

      <div ref={cardRef}
        onMouseDown={e=>handleStart(e.clientX)}
        onMouseMove={e=>{ if(startX.current!==null) handleMove(e.clientX); }}
        onMouseUp={handleEnd} onMouseLeave={handleEnd}
        onTouchStart={e=>handleStart(e.touches[0].clientX)}
        onTouchMove={e=>handleMove(e.touches[0].clientX)}
        onTouchEnd={handleEnd}
        style={{
          background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:18,padding:'24px 20px',
          cursor:'grab',touchAction:'pan-y',
          transform: exiting==='right' ? 'translateX(120%) rotate(20deg)' :
                     exiting==='left'  ? 'translateX(-120%) rotate(-20deg)' :
                     `translateX(${dx}px) rotate(${rotate}deg)`,
          opacity: exiting ? 0 : opacity,
          transition: exiting ? 'transform 0.28s ease-out, opacity 0.28s' : 'none',
          boxShadow: absDx>30 ? '0 8px 40px rgba(0,0,0,0.18)' : '0 2px 12px rgba(0,0,0,0.06)',
        }}>

        {/* Tipo de transação */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
          <span style={{fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',
            color:tx.type==='income'?'var(--green)':'var(--red)',
            background:tx.type==='income'?'var(--green-dim)':'var(--red-dim)',
            borderRadius:20,padding:'3px 10px'}}>
            {tx.type==='income'?'▲ Receita':'▼ Despesa'}
          </span>
          <span style={{fontFamily:'var(--mono)',fontSize:18,fontWeight:700,
            color:tx.type==='income'?'var(--green)':'var(--red)'}}>
            {fmt(tx.amount)}
          </span>
        </div>

        <p style={{fontSize:15,fontWeight:600,color:'var(--text)',marginBottom:6,lineHeight:1.3}}>{tx.description||'Sem descrição'}</p>
        <p style={{fontSize:12,color:'var(--text3)',marginBottom:20}}>
          {tx.date ? new Date(tx.date+'T00:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}) : ''}
        </p>

        {/* Seletor de categoria */}
        <div onClick={e=>e.stopPropagation()} onMouseDown={e=>e.stopPropagation()}>
          <p style={{fontSize:11,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8}}>Categoria</p>
          <select value={catId||''} onChange={e=>setCatId(e.target.value||null)}
            style={{width:'100%',padding:'10px 14px',background:'var(--bg3)',border:`1px solid ${catId?catColor:'var(--border)'}`,borderRadius:10,color:catId?catColor:'var(--text3)',fontSize:13,fontFamily:'var(--font)',cursor:'pointer'}}>
            <option value="">Sem categoria</option>
            {categories.map(c=><option key={c.id} value={c.id}>{c.icon||'📦'} {c.name}</option>)}
          </select>
        </div>
      </div>

      {/* Botões de ação (alternativa ao swipe) */}
      <div style={{display:'flex',gap:12,marginTop:14}}>
        <button onClick={()=>commit('left')}
          style={{flex:1,padding:'12px',borderRadius:12,border:'1px solid var(--red)',background:'var(--red-dim)',color:'var(--red)',fontWeight:600,fontSize:13,cursor:'pointer',fontFamily:'var(--font)'}}>
          ✕ Pular
        </button>
        <button onClick={()=>commit('right')}
          style={{flex:1,padding:'12px',borderRadius:12,border:'none',background:'var(--green)',color:'#fff',fontWeight:600,fontSize:13,cursor:'pointer',fontFamily:'var(--font)'}}>
          ✓ Incluir
        </button>
      </div>
    </div>
  );
}

export default function ImportModal({ onSave, onClose }) {
  const [step,              setStep]              = useState(STEPS.SELECT_BANK);
  const [bank,              setBank]              = useState(null);
  const [parsing,           setParsing]           = useState(false);
  const [error,             setError]             = useState('');
  const [reviewed,          setReviewed]          = useState([]);
  const [swipeQueue,        setSwipeQueue]        = useState([]);
  const [swipeIndex,        setSwipeIndex]        = useState(0);
  const [importing,         setImporting]         = useState(false);
  const [result,            setResult]            = useState(null);
  const [categories,        setCategories]        = useState([]);
  const [accounts,          setAccounts]          = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [isMobile,          setIsMobile]          = useState(window.innerWidth < 560);
  const fileRef = useRef();

  useEffect(() => {
    function onResize() { setIsMobile(window.innerWidth < 560); }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    function handle(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [onClose]);

  async function handleBankSelect(b) {
    setBank(b); setError('');
    setStep(STEPS.SELECT_FILE);
    try {
      const [{ data: cats }, { data: accs }] = await Promise.all([
        api.get('/api/categories'),
        api.get('/api/accounts'),
      ]);
      setCategories(cats || []);
      setAccounts(accs || []);
    } catch {}
  }

  async function handleFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(''); setParsing(true);
    try {
      let bankId = bank?.id;
      if (bankId === 'auto' && f.name.endsWith('.pdf')) {
        const text = await extractPDFText(f);
        bankId = detectBank(text) || 'generic';
      } else if (bankId === 'auto') {
        bankId = 'mp-csv';
      }
      const rows = await parseFile(bankId, f);
      const withCats = rows.map(r => ({
        ...r,
        selected:    !r.skip,
        category_id: autoCategory(r.description, categories),
      }));
      setSwipeQueue(withCats.filter(r => !r.skip));
      setReviewed(withCats);
      setSwipeIndex(0);
      setStep(STEPS.SWIPE_CATS);
    } catch(err) {
      setError('Erro ao processar arquivo. Verifique se o formato é correto.');
      console.error(err);
    }
    setParsing(false);
  }

  function handleSwipeDecide(updatedTx) {
    // Atualiza o reviewed com a decisão do swipe
    setReviewed(prev => prev.map(r =>
      r.description === updatedTx.description && r.date === updatedTx.date && r.amount === updatedTx.amount
        ? { ...updatedTx }
        : r
    ));
    const next = swipeIndex + 1;
    if (next >= swipeQueue.length) {
      setStep(STEPS.PREVIEW);
    } else {
      setSwipeIndex(next);
    }
  }

  function skipSwipe() {
    setStep(STEPS.PREVIEW);
  }

  async function handleImport() {
    setImporting(true);
    let ok = 0, skip = 0, dup = 0;
    for (const tx of reviewed.filter(r => r.selected)) {
      try {
        await api.post('/api/transactions', {
          type:        tx.type,
          amount:      tx.amount,
          description: tx.description,
          date:        tx.date,
          category_id: tx.category_id || null,
          account_id:  selectedAccountId || null,
          import_hash: btoa(unescape(encodeURIComponent(`${tx.date}|${tx.description}|${tx.amount}`))).slice(0,32),
        });
        ok++;
      } catch(err) {
        if (err.response?.status === 409) dup++;
        else skip++;
      }
    }
    setResult({ ok, skip, dup });
    setImporting(false);
    setStep(STEPS.DONE);
    if (ok > 0) onSave?.();
  }

  // ── Overlay ────────────────────────────────────────────────────────────────
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1000,display:'flex',alignItems:'flex-end',justifyContent:'center'}}
      onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div style={{background:'var(--bg)',borderRadius:isMobile?'20px 20px 0 0':'20px',width:'100%',maxWidth:520,maxHeight:'92vh',overflow:'auto',padding:isMobile?'24px 16px 32px':'28px 28px 32px',position:'relative'}}>

        {/* Fechar */}
        <button onClick={onClose} style={{position:'absolute',top:16,right:16,background:'none',border:'none',fontSize:20,color:'var(--text3)',cursor:'pointer',lineHeight:1}}>×</button>

        {/* ── STEP 0: Selecionar banco ── */}
        {step === STEPS.SELECT_BANK && (
          <>
            <h2 style={{fontSize:17,fontWeight:600,marginBottom:4}}>Importar extrato</h2>
            <p style={{fontSize:13,color:'var(--text3)',marginBottom:20}}>Selecione seu banco ou formato</p>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              {BANKS.map(b=>(
                <button key={b.id} onClick={()=>handleBankSelect(b)}
                  style={{padding:'14px 12px',background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:12,cursor:'pointer',textAlign:'left',transition:'border 0.15s',fontFamily:'var(--font)'}}>
                  <p style={{fontSize:22,marginBottom:6}}>{b.icon||'🏦'}</p>
                  <p style={{fontSize:13,fontWeight:600,color:'var(--text)'}}>{b.name}</p>
                  <p style={{fontSize:11,color:'var(--text3)',marginTop:2}}>{b.hint||''}</p>
                </button>
              ))}
            </div>
          </>
        )}

        {/* ── STEP 1: Selecionar arquivo ── */}
        {step === STEPS.SELECT_FILE && (
          <>
            <h2 style={{fontSize:17,fontWeight:600,marginBottom:4}}>{bank?.icon} {bank?.name}</h2>
            <p style={{fontSize:13,color:'var(--text3)',marginBottom:20}}>{bank?.instructions||'Selecione o arquivo exportado pelo seu banco'}</p>
            {error && <InfoBox type="error" style={{marginBottom:14}}>{error}</InfoBox>}
            <button onClick={()=>fileRef.current?.click()} disabled={parsing}
              style={{width:'100%',padding:'16px',borderRadius:12,border:'2px dashed var(--border)',background:'var(--bg2)',cursor:parsing?'wait':'pointer',fontFamily:'var(--font)',fontSize:14,color:'var(--text3)',transition:'border 0.15s'}}>
              {parsing ? '⏳ Processando...' : '📂 Selecionar arquivo'}
            </button>
            <input ref={fileRef} type="file" accept=".csv,.ofx,.pdf" style={{display:'none'}} onChange={handleFile}/>
            <button onClick={()=>setStep(STEPS.SELECT_BANK)} style={{width:'100%',marginTop:10,padding:12,border:'none',background:'none',color:'var(--text3)',cursor:'pointer',fontSize:13,fontFamily:'var(--font)'}}>← Voltar</button>
          </>
        )}

        {/* ── STEP 2: Swipe de categorização ── */}
        {step === STEPS.SWIPE_CATS && swipeQueue.length > 0 && (
          <>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
              <div>
                <h2 style={{fontSize:17,fontWeight:600,marginBottom:2}}>Categorizar</h2>
                <p style={{fontSize:12,color:'var(--text3)'}}>
                  {swipeIndex + 1} de {swipeQueue.length} — deslize ou clique nos botões
                </p>
              </div>
              <button onClick={skipSwipe} style={{fontSize:12,color:'var(--indigo)',background:'none',border:'none',cursor:'pointer',fontFamily:'var(--font)',padding:'6px 10px'}}>Pular tudo →</button>
            </div>

            {/* Barra de progresso */}
            <div style={{height:3,background:'var(--bg3)',borderRadius:2,marginBottom:20,overflow:'hidden'}}>
              <div style={{height:'100%',width:`${((swipeIndex)/swipeQueue.length)*100}%`,background:'var(--indigo)',borderRadius:2,transition:'width 0.3s'}}/>
            </div>

            <SwipeCard
              key={`${swipeIndex}-${swipeQueue[swipeIndex]?.description}`}
              tx={swipeQueue[swipeIndex]}
              categories={categories}
              onDecide={handleSwipeDecide}
            />

            <p style={{fontSize:11,color:'var(--text3)',textAlign:'center',marginTop:16}}>
              ← deslize para pular &nbsp;·&nbsp; deslize para incluir →
            </p>
          </>
        )}

        {/* ── STEP 3: Preview / Revisão ── */}
        {step === STEPS.PREVIEW && (
          <>
            <h2 style={{fontSize:17,fontWeight:600,marginBottom:4}}>Revisar importação</h2>
            <p style={{fontSize:13,color:'var(--text3)',marginBottom:16}}>
              {reviewed.filter(r=>r.selected).length} de {reviewed.length} transações selecionadas
            </p>

            {/* Seletor de conta */}
            {accounts.length > 0 && (
              <div style={{marginBottom:14}}>
                <label style={{display:'block',fontSize:11,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:6}}>Lançar na conta</label>
                <select value={selectedAccountId} onChange={e=>setSelectedAccountId(e.target.value)}
                  style={{width:'100%',padding:'10px 14px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:10,color:'var(--text)',fontSize:13,fontFamily:'var(--font)'}}>
                  <option value="">Sem conta (genérico)</option>
                  {accounts.map(a=><option key={a.id} value={a.id}>{a.icon||'🏦'} {a.name}</option>)}
                </select>
              </div>
            )}

            <div style={{maxHeight:320,overflow:'auto',border:'1px solid var(--border)',borderRadius:12,marginBottom:16}}>
              {reviewed.map((tx,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',borderBottom:i<reviewed.length-1?'1px solid var(--border)':'none',background:tx.selected?'transparent':'var(--bg3)',opacity:tx.selected?1:0.5}}>
                  <input type="checkbox" checked={!!tx.selected}
                    onChange={e=>setReviewed(prev=>prev.map((r,j)=>j===i?{...r,selected:e.target.checked}:r))}
                    style={{width:15,height:15,accentColor:'var(--indigo)',cursor:'pointer',flexShrink:0}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{fontSize:12,fontWeight:500,color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{tx.description}</p>
                    <p style={{fontSize:11,color:'var(--text3)',marginTop:1}}>
                      {tx.date} · {tx.category_id ? categories.find(c=>c.id===tx.category_id)?.name||'?' : 'Sem cat.'}
                    </p>
                  </div>
                  <span style={{fontSize:12,fontFamily:'var(--mono)',fontWeight:600,color:tx.type==='income'?'var(--green)':'var(--red)',flexShrink:0}}>
                    {tx.type==='income'?'+':'-'}{fmt(tx.amount)}
                  </span>
                </div>
              ))}
            </div>

            <Button loading={importing} onClick={handleImport} style={{width:'100%'}}>
              {importing ? 'Importando...' : `Importar ${reviewed.filter(r=>r.selected).length} transações`}
            </Button>
          </>
        )}

        {/* ── STEP 4: Concluído ── */}
        {step === STEPS.DONE && result && (
          <div style={{textAlign:'center',padding:'20px 0'}}>
            <p style={{fontSize:40,marginBottom:12}}>🎉</p>
            <h2 style={{fontSize:18,fontWeight:600,marginBottom:8}}>Importação concluída!</h2>
            <div style={{display:'flex',justifyContent:'center',gap:12,marginBottom:20,flexWrap:'wrap'}}>
              <span style={{background:'var(--green-dim)',color:'var(--green)',borderRadius:20,padding:'4px 14px',fontSize:13,fontWeight:600}}>✓ {result.ok} importadas</span>
              {result.dup>0 && <span style={{background:'var(--amber-dim,rgba(245,158,11,0.1))',color:'var(--amber)',borderRadius:20,padding:'4px 14px',fontSize:13}}>⚠ {result.dup} duplicadas</span>}
              {result.skip>0 && <span style={{background:'var(--red-dim)',color:'var(--red)',borderRadius:20,padding:'4px 14px',fontSize:13}}>✗ {result.skip} erros</span>}
            </div>
            <Button onClick={onClose} style={{width:'100%'}}>Fechar</Button>
          </div>
        )}

      </div>
    </div>
  );
}
