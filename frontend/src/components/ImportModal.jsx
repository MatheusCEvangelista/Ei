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
  const lower = description.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  for (const [catName, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) {
      const found = categories.find(c => c.name.toLowerCase().includes(catName.toLowerCase()));
      if (found) return found.id;
    }
  }
  return null;
}

const STEPS = { SELECT_BANK:0, SELECT_FILE:1, PREVIEW:2, DONE:3 };

export default function ImportModal({ onSave, onClose }) {
  const [step,       setStep]       = useState(STEPS.SELECT_BANK);
  const [bank,       setBank]       = useState(null);
  const [parsing,    setParsing]    = useState(false);
  const [error,      setError]      = useState('');
  const [reviewed,   setReviewed]   = useState([]);
  const [importing,  setImporting]  = useState(false);
  const [result,     setResult]     = useState(null);
  const [categories, setCategories] = useState([]);
  const [isMobile,   setIsMobile]   = useState(window.innerWidth < 560);
  const fileRef = useRef();

  useEffect(() => {
    function onResize() { setIsMobile(window.innerWidth < 560); }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Fechar com ESC
  useEffect(() => {
    function handle(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [onClose]);

  async function handleBankSelect(b) {
    setBank(b); setError('');
    setStep(STEPS.SELECT_FILE);
    try { const { data } = await api.get('/api/categories'); setCategories(data||[]); } catch {}
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
      setReviewed(rows.map(r => ({
        ...r,
        selected:    !r.skip,
        category_id: autoCategory(r.description, categories),
      })));
      setStep(STEPS.PREVIEW);
    } catch(err) {
      setError(err.message || 'Erro ao processar o arquivo.');
    }
    setParsing(false);
  }

  function updateRow(i, field, value) {
    setReviewed(prev => prev.map((r,j) => j===i ? {...r,[field]:value} : r));
  }

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

  const selectedCount = reviewed.filter(r=>r.selected).length;

  return (
    <div
      style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',backdropFilter:'blur(4px)',display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:50}}
      onClick={onClose}>
      <div
        style={{background:'var(--bg2)',border:'1px solid var(--border-md)',borderRadius:'var(--radius-xl) var(--radius-xl) 0 0',width:'100%',maxWidth:620,maxHeight:'92vh',display:'flex',flexDirection:'column',boxShadow:'var(--shadow)'}}
        onClick={e=>e.stopPropagation()}>

        {/* Handle mobile */}
        <div style={{width:36,height:4,borderRadius:2,background:'var(--bg3)',margin:'10px auto 0',flexShrink:0}}/>

        {/* Header */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 20px',borderBottom:'1px solid var(--border)',flexShrink:0}}>
          <div style={{minWidth:0}}>
            <h2 style={{fontSize:'var(--text-md)',fontWeight:'var(--font-semibold)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
              {step===STEPS.SELECT_BANK && 'Importar extrato'}
              {step===STEPS.SELECT_FILE && `${bank?.label} — Arquivo`}
              {step===STEPS.PREVIEW    && `Revisar transações`}
              {step===STEPS.DONE       && 'Importação concluída'}
            </h2>
            {step===STEPS.PREVIEW && (
              <p style={{fontSize:'var(--text-xs)',color:'var(--text3)',marginTop:1}}>
                {selectedCount} de {reviewed.length} selecionadas
              </p>
            )}
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center',flexShrink:0,marginLeft:12}}>
            {step > STEPS.SELECT_BANK && step < STEPS.DONE && (
              <button onClick={()=>{setStep(s=>s-1);setError('');}}
                style={{fontSize:12,color:'var(--text3)',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:'4px 10px',cursor:'pointer',fontFamily:'var(--font)',whiteSpace:'nowrap'}}>
                ← Voltar
              </button>
            )}
            <button onClick={onClose}
              style={{width:28,height:28,borderRadius:'var(--radius-sm)',border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text2)',cursor:'pointer',fontSize:16,flexShrink:0}}>
              ×
            </button>
          </div>
        </div>

        {/* Conteúdo com scroll */}
        <div style={{overflowY:'auto',flex:1,padding:'16px 20px'}}>

          {/* ── Etapa 1: Selecionar banco ── */}
          {step === STEPS.SELECT_BANK && (
            <div>
              <SectionLabel style={{marginBottom:12}}>Selecione seu banco</SectionLabel>
              <div style={{
                display:'grid',
                gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                gap:8,
              }}>
                {BANKS.map(b => (
                  <button key={b.id} onClick={()=>handleBankSelect(b)}
                    style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',borderRadius:'var(--radius-md)',border:'1px solid var(--border)',background:'var(--bg3)',cursor:'pointer',fontFamily:'var(--font)',textAlign:'left',transition:'all var(--transition)',width:'100%'}}
                    onMouseOver={e=>{e.currentTarget.style.borderColor='var(--indigo)';e.currentTarget.style.background='var(--indigo-dim)';}}
                    onMouseOut={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.background='var(--bg3)';}}>
                    <span style={{fontSize:20,flexShrink:0}}>{b.icon}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <p style={{fontSize:'var(--text-sm)',fontWeight:'var(--font-semibold)',color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{b.label}</p>
                      <p style={{fontSize:'var(--text-xs)',color:'var(--text3)'}}>{b.format}</p>
                    </div>
                    {b.badge && (
                      <span style={{fontSize:9,fontWeight:'var(--font-bold)',color:'var(--indigo)',background:'var(--indigo-dim)',borderRadius:'var(--radius-full)',padding:'1px 6px',flexShrink:0}}>
                        {b.badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Etapa 2: Selecionar arquivo ── */}
          {step === STEPS.SELECT_FILE && (
            <div style={{display:'flex',flexDirection:'column',gap:16}}>
              {bank?.steps && (
                <div style={{background:'var(--bg3)',borderRadius:'var(--radius-md)',padding:16}}>
                  <SectionLabel style={{marginBottom:8}}>Como exportar do {bank.label}</SectionLabel>
                  {bank.steps.map((s,i)=>(
                    <div key={i} style={{display:'flex',gap:8,marginBottom:6}}>
                      <span style={{width:20,height:20,borderRadius:'50%',background:'var(--indigo-dim)',color:'var(--indigo)',fontSize:11,fontWeight:'var(--font-bold)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{i+1}</span>
                      <span style={{fontSize:'var(--text-xs)',color:'var(--text2)',lineHeight:1.5}}>{s}</span>
                    </div>
                  ))}
                </div>
              )}

              <div onClick={()=>fileRef.current?.click()}
                style={{border:`2px dashed ${parsing?'var(--indigo)':'var(--border)'}`,borderRadius:'var(--radius-lg)',padding:isMobile?'24px 16px':'40px 24px',textAlign:'center',cursor:'pointer',transition:'all var(--transition)',background:parsing?'var(--indigo-dim)':'transparent'}}
                onMouseOver={e=>{e.currentTarget.style.borderColor='var(--indigo)';e.currentTarget.style.background='var(--indigo-dim)';}}
                onMouseOut={e=>{if(!parsing){e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.background='transparent';}}}>
                <input ref={fileRef} type="file" accept={bank?.accept||'.pdf,.csv'} style={{display:'none'}} onChange={handleFile}/>
                <div style={{fontSize:32,marginBottom:8}}>{parsing?'⏳':'📂'}</div>
                <p style={{fontSize:'var(--text-sm)',fontWeight:'var(--font-medium)',color:'var(--text)',marginBottom:4}}>
                  {parsing?'Processando...':'Clique para selecionar'}
                </p>
                <p style={{fontSize:'var(--text-xs)',color:'var(--text3)'}}>
                  {bank?.format} • {bank?.accept?.replace(/\./g,'').toUpperCase()}
                </p>
              </div>
              {error && <InfoBox variant="danger">{error}</InfoBox>}
            </div>
          )}

          {/* ── Etapa 3: Preview — RESPONSIVO ── */}
          {step === STEPS.PREVIEW && (
            <div>
              {/* Controles */}
              <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap',alignItems:'center'}}>
                <button onClick={()=>setReviewed(prev=>prev.map(r=>({...r,selected:true})))}
                  style={{fontSize:11,padding:'4px 10px',borderRadius:'var(--radius-sm)',border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text2)',cursor:'pointer',fontFamily:'var(--font)'}}>
                  Sel. todas
                </button>
                <button onClick={()=>setReviewed(prev=>prev.map(r=>({...r,selected:false})))}
                  style={{fontSize:11,padding:'4px 10px',borderRadius:'var(--radius-sm)',border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text2)',cursor:'pointer',fontFamily:'var(--font)'}}>
                  Desmarcar
                </button>
                <span style={{fontSize:11,color:'var(--text3)',marginLeft:'auto'}}>
                  {selectedCount} / {reviewed.length}
                </span>
              </div>

              {/* Lista de transações */}
              <div style={{display:'flex',flexDirection:'column',gap:4}}>
                {reviewed.map((row,i) => (
                  <div key={i}
                    style={{borderRadius:'var(--radius-md)',background:row.selected?'var(--bg3)':'transparent',border:'1px solid var(--border)',opacity:row.selected?1:0.45,transition:'all var(--transition)',overflow:'hidden'}}>

                    {isMobile ? (
                      /* ── Layout mobile: 2 linhas ── */
                      <div style={{padding:'8px 10px'}}>
                        {/* Linha 1: checkbox + seta + descrição + valor */}
                        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:5}}>
                          <input type="checkbox" checked={row.selected} onChange={e=>updateRow(i,'selected',e.target.checked)}
                            style={{flexShrink:0,accentColor:'var(--indigo)',width:15,height:15}}/>
                          <span style={{fontSize:11,fontWeight:700,color:row.type==='income'?'var(--green)':'var(--red)',flexShrink:0}}>
                            {row.type==='income'?'↑':'↓'}
                          </span>
                          <span style={{flex:1,fontSize:12,color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                            {row.description}
                          </span>
                          <span style={{fontFamily:'var(--mono)',fontSize:12,fontWeight:700,color:row.type==='income'?'var(--green)':'var(--red)',flexShrink:0}}>
                            {fmt(row.amount)}
                          </span>
                        </div>
                        {/* Linha 2: data + categoria */}
                        <div style={{display:'flex',alignItems:'center',gap:8,paddingLeft:23}}>
                          <span style={{fontSize:10,color:'var(--text3)',flexShrink:0}}>{row.date}</span>
                          <select value={row.category_id||''} onChange={e=>updateRow(i,'category_id',e.target.value||null)}
                            style={{flex:1,fontSize:10,padding:'2px 4px',borderRadius:4,border:'1px solid var(--border)',background:'var(--bg2)',color:'var(--text)',minWidth:0}}>
                            <option value="">Sem categoria</option>
                            {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                      </div>
                    ) : (
                      /* ── Layout desktop: 1 linha ── */
                      <div style={{display:'flex',alignItems:'center',gap:8,padding:'7px 12px'}}>
                        <input type="checkbox" checked={row.selected} onChange={e=>updateRow(i,'selected',e.target.checked)}
                          style={{flexShrink:0,accentColor:'var(--indigo)'}}/>
                        <span style={{fontSize:11,fontWeight:700,color:row.type==='income'?'var(--green)':'var(--red)',width:12,textAlign:'center',flexShrink:0}}>
                          {row.type==='income'?'↑':'↓'}
                        </span>
                        <span style={{fontSize:11,color:'var(--text3)',flexShrink:0,width:66}}>{row.date}</span>
                        <span style={{flex:1,fontSize:12,color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                          {row.description}
                        </span>
                        <select value={row.category_id||''} onChange={e=>updateRow(i,'category_id',e.target.value||null)}
                          style={{fontSize:10,padding:'2px 4px',borderRadius:4,border:'1px solid var(--border)',background:'var(--bg2)',color:'var(--text)',width:96,flexShrink:0}}>
                          <option value="">Sem cat.</option>
                          {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <span style={{fontFamily:'var(--mono)',fontSize:11,fontWeight:700,color:row.type==='income'?'var(--green)':'var(--red)',flexShrink:0,width:70,textAlign:'right'}}>
                          {fmt(row.amount)}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {error && <InfoBox variant="danger" style={{marginTop:12}}>{error}</InfoBox>}
            </div>
          )}

          {/* ── Etapa 4: Resultado ── */}
          {step === STEPS.DONE && result && (
            <div style={{textAlign:'center',padding:'32px 0'}}>
              <div style={{fontSize:48,marginBottom:16}}>{result.fail===0?'🎉':'⚠️'}</div>
              <div style={{display:'flex',justifyContent:'center',gap:24,marginBottom:24,flexWrap:'wrap'}}>
                <div>
                  <p style={{fontFamily:'var(--mono)',fontSize:32,fontWeight:700,color:'var(--green)'}}>{result.ok}</p>
                  <p style={{fontSize:11,color:'var(--text3)'}}>importadas</p>
                </div>
                {result.dup > 0 && (
                  <div>
                    <p style={{fontFamily:'var(--mono)',fontSize:32,fontWeight:700,color:'var(--amber)'}}>{result.dup}</p>
                    <p style={{fontSize:11,color:'var(--text3)'}}>duplicadas</p>
                  </div>
                )}
                {result.fail > 0 && (
                  <div>
                    <p style={{fontFamily:'var(--mono)',fontSize:32,fontWeight:700,color:'var(--red)'}}>{result.fail}</p>
                    <p style={{fontSize:11,color:'var(--text3)'}}>com erro</p>
                  </div>
                )}
              </div>
              <Button onClick={()=>{onSave();onClose();}} size="lg">Concluído</Button>
            </div>
          )}
        </div>

        {/* Footer fixo com botão importar */}
        {step === STEPS.PREVIEW && (
          <div style={{padding:'12px 20px',borderTop:'1px solid var(--border)',flexShrink:0,background:'var(--bg2)'}}>
            <Button
              onClick={handleImport}
              disabled={importing || selectedCount === 0}
              size="lg"
              style={{width:'100%'}}>
              {importing
                ? 'Importando...'
                : `Importar ${selectedCount} transaç${selectedCount!==1?'ões':'ão'}`}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
