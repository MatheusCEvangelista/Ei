// ═══════════════════════════════════════════════════════════════════════════
// ImportModal.jsx — Modal de importação de extrato bancário
// Toda a lógica de parsing está em bankParsers.js
// ═══════════════════════════════════════════════════════════════════════════
import { useState, useRef } from 'react';
import { BANKS, parseFile, detectBank, extractPDFText } from './bankParsers';
import { Button, InfoBox, SectionLabel } from './ui';
import api from '../lib/api';

const fmt = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);

// ── Auto-categorização ────────────────────────────────────────────────────
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
  const lower = description.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  for (const [catName, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) {
      const found = categories.find(c => c.name.toLowerCase().includes(catName.toLowerCase()));
      if (found) return found.id;
    }
  }
  return null;
}

// ── Etapas ────────────────────────────────────────────────────────────────
const STEPS = { SELECT_BANK:0, SELECT_FILE:1, PREVIEW:2, DONE:3 };

export default function ImportModal({ onSave, onClose }) {
  const [step,       setStep]       = useState(STEPS.SELECT_BANK);
  const [bank,       setBank]       = useState(null);
  const [file,       setFile]       = useState(null);
  const [parsing,    setParsing]    = useState(false);
  const [error,      setError]      = useState('');
  const [parsed,     setParsed]     = useState([]); // linhas brutas do parser
  const [reviewed,   setReviewed]   = useState([]); // com edições do usuário
  const [importing,  setImporting]  = useState(false);
  const [result,     setResult]     = useState(null);
  const [categories, setCategories] = useState([]);
  const fileRef = useRef();

  // ── Seleção de banco ──────────────────────────────────────────────────
  async function handleBankSelect(b) {
    setBank(b); setError('');
    if (b.id === 'auto') {
      setStep(STEPS.SELECT_FILE);
    } else {
      setStep(STEPS.SELECT_FILE);
    }
    // Carrega categorias para auto-categorização
    try { const { data } = await api.get('/api/categories'); setCategories(data||[]); } catch {}
  }

  // ── Upload e parsing ──────────────────────────────────────────────────
  async function handleFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f); setError(''); setParsing(true);
    try {
      let bankId = bank?.id;
      // Auto-detecção
      if (bankId === 'auto' && f.name.endsWith('.pdf')) {
        const text     = await extractPDFText(f);
        const detected = detectBank(text);
        bankId = detected || 'generic';
      } else if (bankId === 'auto' && (f.name.endsWith('.csv'))) {
        bankId = 'mp-csv'; // fallback para CSV
      }
      const rows = await parseFile(bankId, f);
      const withCats = rows.map(r => ({
        ...r,
        selected:    !r.skip,
        category_id: autoCategory(r.description, categories),
      }));
      setParsed(rows);
      setReviewed(withCats);
      setStep(STEPS.PREVIEW);
    } catch(err) {
      setError(err.message || 'Erro ao processar o arquivo.');
    }
    setParsing(false);
  }

  // ── Edição na preview ─────────────────────────────────────────────────
  function updateRow(i, field, value) {
    setReviewed(prev => prev.map((r,j) => j===i ? {...r,[field]:value} : r));
  }

  // ── Importação final ──────────────────────────────────────────────────
  async function handleImport() {
    const toImport = reviewed.filter(r => r.selected);
    if (!toImport.length) { setError('Selecione pelo menos uma transação.'); return; }
    setImporting(true); setError('');
    let ok = 0, dup = 0, fail = 0;
    for (const tx of toImport) {
      try {
        await api.post('/api/transactions', {
          type:        tx.type,
          amount:      tx.amount,
          description: tx.description,
          date:        tx.date,
          category_id: tx.category_id || null,
          import_hash: btoa(unescape(encodeURIComponent(`${tx.date}${tx.description}${tx.amount}`))).slice(0,32),
        });
        ok++;
      } catch(err) {
        if (err.response?.status === 409) dup++;
        else fail++;
      }
    }
    setResult({ ok, dup, fail });
    setStep(STEPS.DONE);
    setImporting(false);
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',backdropFilter:'blur(4px)',display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:50,padding:'var(--space-4)'}} onClick={onClose}>
      <div style={{background:'var(--bg2)',border:'1px solid var(--border-md)',borderRadius:'var(--radius-xl) var(--radius-xl) 0 0',width:'100%',maxWidth:600,maxHeight:'90vh',display:'flex',flexDirection:'column',boxShadow:'var(--shadow)'}} onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'var(--space-4) var(--space-5)',borderBottom:'1px solid var(--border)',flexShrink:0}}>
          <div>
            <h2 style={{fontSize:'var(--text-lg)',fontWeight:'var(--font-semibold)'}}>
              {step===STEPS.SELECT_BANK && 'Importar extrato'}
              {step===STEPS.SELECT_FILE && `${bank?.label} — Selecionar arquivo`}
              {step===STEPS.PREVIEW    && `Revisar ${reviewed.length} transações`}
              {step===STEPS.DONE       && 'Importação concluída'}
            </h2>
            {step===STEPS.PREVIEW && (
              <p style={{fontSize:'var(--text-xs)',color:'var(--text3)',marginTop:2}}>
                {reviewed.filter(r=>r.selected).length} selecionadas de {reviewed.length}
              </p>
            )}
          </div>
          <div style={{display:'flex',gap:'var(--space-2)',alignItems:'center'}}>
            {step > STEPS.SELECT_BANK && step < STEPS.DONE && (
              <button onClick={()=>{ setStep(s=>s-1); setError(''); }}
                style={{fontSize:'var(--text-xs)',color:'var(--text3)',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:'4px 10px',cursor:'pointer',fontFamily:'var(--font)'}}>
                ← Voltar
              </button>
            )}
            <button onClick={onClose} style={{width:28,height:28,borderRadius:'var(--radius-sm)',border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text2)',cursor:'pointer',fontSize:16}}>×</button>
          </div>
        </div>

        {/* Conteúdo */}
        <div style={{overflowY:'auto',flex:1,padding:'var(--space-4) var(--space-5)'}}>

          {/* ── Etapa 1: Selecionar banco ── */}
          {step === STEPS.SELECT_BANK && (
            <div>
              <SectionLabel style={{marginBottom:'var(--space-3)'}}>Selecione seu banco</SectionLabel>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'var(--space-2)'}}>
                {BANKS.map(b => (
                  <button key={b.id} onClick={()=>handleBankSelect(b)}
                    style={{display:'flex',alignItems:'center',gap:'var(--space-3)',padding:'var(--space-3) var(--space-4)',borderRadius:'var(--radius-md)',border:'1px solid var(--border)',background:'var(--bg3)',cursor:'pointer',fontFamily:'var(--font)',textAlign:'left',transition:'all var(--transition)'}}
                    onMouseOver={e=>{e.currentTarget.style.borderColor='var(--indigo)';e.currentTarget.style.background='var(--indigo-dim)';}}
                    onMouseOut={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.background='var(--bg3)';}}>
                    <span style={{fontSize:22,flexShrink:0}}>{b.icon}</span>
                    <div style={{minWidth:0}}>
                      <p style={{fontSize:'var(--text-sm)',fontWeight:'var(--font-semibold)',color:'var(--text)'}}>{b.label}</p>
                      <p style={{fontSize:'var(--text-xs)',color:'var(--text3)'}}>{b.format}</p>
                    </div>
                    {b.badge && <span style={{marginLeft:'auto',fontSize:9,fontWeight:'var(--font-bold)',color:'var(--indigo)',background:'var(--indigo-dim)',borderRadius:'var(--radius-full)',padding:'1px 6px',flexShrink:0}}>{b.badge}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Etapa 2: Selecionar arquivo ── */}
          {step === STEPS.SELECT_FILE && (
            <div style={{display:'flex',flexDirection:'column',gap:'var(--space-4)'}}>
              {bank?.steps && (
                <div style={{background:'var(--bg3)',borderRadius:'var(--radius-md)',padding:'var(--space-4)'}}>
                  <SectionLabel style={{marginBottom:'var(--space-2)'}}>Como exportar do {bank.label}</SectionLabel>
                  {bank.steps.map((s,i)=>(
                    <div key={i} style={{display:'flex',gap:'var(--space-2)',marginBottom:'var(--space-1)'}}>
                      <span style={{width:20,height:20,borderRadius:'50%',background:'var(--indigo-dim)',color:'var(--indigo)',fontSize:11,fontWeight:'var(--font-bold)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{i+1}</span>
                      <span style={{fontSize:'var(--text-xs)',color:'var(--text2)',lineHeight:1.5}}>{s}</span>
                    </div>
                  ))}
                </div>
              )}

              <div onClick={()=>fileRef.current?.click()}
                style={{border:`2px dashed ${parsing?'var(--indigo)':'var(--border)'}`,borderRadius:'var(--radius-lg)',padding:'var(--space-8)',textAlign:'center',cursor:'pointer',transition:'all var(--transition)',background:parsing?'var(--indigo-dim)':'transparent'}}
                onMouseOver={e=>{e.currentTarget.style.borderColor='var(--indigo)';e.currentTarget.style.background='var(--indigo-dim)';}}
                onMouseOut={e=>{if(!parsing){e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.background='transparent';}}}>
                <input ref={fileRef} type="file" accept={bank?.accept||'.pdf,.csv'} style={{display:'none'}} onChange={handleFile}/>
                <div style={{fontSize:36,marginBottom:'var(--space-2)'}}>{parsing?'⏳':'📂'}</div>
                <p style={{fontSize:'var(--text-sm)',fontWeight:'var(--font-medium)',color:'var(--text)',marginBottom:'var(--space-1)'}}>
                  {parsing?'Processando...':'Clique para selecionar o arquivo'}
                </p>
                <p style={{fontSize:'var(--text-xs)',color:'var(--text3)'}}>
                  {bank?.format} — {bank?.accept?.replace(/\./g,'').toUpperCase()}
                </p>
              </div>
              {error && <InfoBox variant="danger">{error}</InfoBox>}
            </div>
          )}

          {/* ── Etapa 3: Preview/revisão ── */}
          {step === STEPS.PREVIEW && (
            <div>
              {/* Controles */}
              <div style={{display:'flex',gap:'var(--space-2)',marginBottom:'var(--space-3)',flexWrap:'wrap'}}>
                <button onClick={()=>setReviewed(prev=>prev.map(r=>({...r,selected:true})))}
                  style={{fontSize:'var(--text-xs)',padding:'4px 10px',borderRadius:'var(--radius-sm)',border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text2)',cursor:'pointer',fontFamily:'var(--font)'}}>
                  Selecionar tudo
                </button>
                <button onClick={()=>setReviewed(prev=>prev.map(r=>({...r,selected:false})))}
                  style={{fontSize:'var(--text-xs)',padding:'4px 10px',borderRadius:'var(--radius-sm)',border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text2)',cursor:'pointer',fontFamily:'var(--font)'}}>
                  Desmarcar tudo
                </button>
                <span style={{fontSize:'var(--text-xs)',color:'var(--text3)',padding:'4px 0',marginLeft:'auto'}}>
                  {reviewed.filter(r=>r.selected).length} de {reviewed.length} selecionadas
                </span>
              </div>

              {/* Lista */}
              <div style={{display:'flex',flexDirection:'column',gap:'var(--space-1)'}}>
                {reviewed.map((row,i) => (
                  <div key={i} style={{display:'flex',alignItems:'center',gap:'var(--space-2)',padding:'var(--space-2) var(--space-3)',borderRadius:'var(--radius-md)',background:row.selected?'var(--bg3)':'transparent',border:'1px solid var(--border)',opacity:row.selected?1:0.5,transition:'all var(--transition)'}}>
                    <input type="checkbox" checked={row.selected} onChange={e=>updateRow(i,'selected',e.target.checked)} style={{flexShrink:0,accentColor:'var(--indigo)'}}/>
                    <span style={{fontSize:11,fontWeight:'var(--font-bold)',color:row.type==='income'?'var(--green)':'var(--red)',width:14,textAlign:'center',flexShrink:0}}>{row.type==='income'?'↑':'↓'}</span>
                    <span style={{fontSize:'var(--text-xs)',color:'var(--text3)',flexShrink:0,width:72}}>{row.date}</span>
                    <span style={{flex:1,fontSize:'var(--text-xs)',color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{row.description}</span>
                    <select value={row.category_id||''} onChange={e=>updateRow(i,'category_id',e.target.value||null)}
                      style={{fontSize:10,padding:'2px 4px',borderRadius:4,border:'1px solid var(--border)',background:'var(--bg2)',color:'var(--text)',maxWidth:90,flexShrink:0}}>
                      <option value="">Sem cat.</option>
                      {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <span style={{fontFamily:'var(--mono)',fontSize:'var(--text-xs)',fontWeight:'var(--font-semibold)',color:row.type==='income'?'var(--green)':'var(--red)',flexShrink:0,width:72,textAlign:'right'}}>{fmt(row.amount)}</span>
                  </div>
                ))}
              </div>
              {error && <InfoBox variant="danger" style={{marginTop:'var(--space-3)'}}>{error}</InfoBox>}
            </div>
          )}

          {/* ── Etapa 4: Resultado ── */}
          {step === STEPS.DONE && result && (
            <div style={{textAlign:'center',padding:'var(--space-6) 0'}}>
              <div style={{fontSize:48,marginBottom:'var(--space-4)'}}>{result.fail===0?'🎉':'⚠️'}</div>
              <div style={{display:'flex',justifyContent:'center',gap:'var(--space-4)',marginBottom:'var(--space-5)'}}>
                <div style={{textAlign:'center'}}>
                  <p style={{fontFamily:'var(--mono)',fontSize:'var(--text-2xl)',fontWeight:'var(--font-bold)',color:'var(--green)'}}>{result.ok}</p>
                  <p style={{fontSize:'var(--text-xs)',color:'var(--text3)'}}>importadas</p>
                </div>
                {result.dup > 0 && (
                  <div style={{textAlign:'center'}}>
                    <p style={{fontFamily:'var(--mono)',fontSize:'var(--text-2xl)',fontWeight:'var(--font-bold)',color:'var(--amber)'}}>{result.dup}</p>
                    <p style={{fontSize:'var(--text-xs)',color:'var(--text3)'}}>duplicadas</p>
                  </div>
                )}
                {result.fail > 0 && (
                  <div style={{textAlign:'center'}}>
                    <p style={{fontFamily:'var(--mono)',fontSize:'var(--text-2xl)',fontWeight:'var(--font-bold)',color:'var(--red)'}}>{result.fail}</p>
                    <p style={{fontSize:'var(--text-xs)',color:'var(--text3)'}}>com erro</p>
                  </div>
                )}
              </div>
              <Button onClick={()=>{onSave();onClose();}} size="lg">Concluído</Button>
            </div>
          )}
        </div>

        {/* Footer com botão de importar */}
        {step === STEPS.PREVIEW && (
          <div style={{padding:'var(--space-4) var(--space-5)',borderTop:'1px solid var(--border)',flexShrink:0}}>
            <Button onClick={handleImport} disabled={importing||!reviewed.filter(r=>r.selected).length} size="lg" style={{width:'100%'}}>
              {importing?`Importando...`:`Importar ${reviewed.filter(r=>r.selected).length} transações`}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
