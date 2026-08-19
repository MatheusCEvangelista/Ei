import { useState, useRef } from 'react';
import api from '../lib/api';
import { parseFile, BANKS } from './bankParsers';

// ─── Parsers (mantidos iguais aos anteriores) ─────────────────────────────
function parseMercadoPagoCSV(text) {
  const lines = text.split('\n').map(l=>l.trim()).filter(Boolean);
  const hi = lines.findIndex(l=>l.startsWith('RELEASE_DATE'));
  if (hi===-1) throw new Error('Formato inválido. Use o CSV padrão do Mercado Pago.');
  const txs=[];
  for (const line of lines.slice(hi+1)) {
    const cols=line.split(';');
    if (cols.length<4) continue;
    const [rawDate,rawDesc,,rawAmount]=cols;
    const [d,m,y]=rawDate.trim().split('-');
    if (!d||!m||!y) continue;
    const amount=parseFloat(rawAmount.trim().replace(/\./g,'').replace(',','.'));
    if (isNaN(amount)||amount===0) continue;
    txs.push({date:`${y}-${m}-${d}`,description:rawDesc.trim(),amount:Math.abs(amount),type:amount>0?'income':'expense',category_id:'',skip:rawDesc.trim().toLowerCase().startsWith('rendimento')});
  }
  if (!txs.length) throw new Error('Nenhuma transação encontrada.');
  return txs;
}

async function extractPDFText(file) {
  const pdfjsLib=await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.min.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.worker.min.mjs';
  const pdf=await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;
  let text='';
  for (let i=1;i<=pdf.numPages;i++) {
    const page=await pdf.getPage(i);
    const content=await page.getTextContent();
    const lineMap={};
    for (const item of content.items) {
      const y=Math.round(item.transform[5]);
      if (!lineMap[y]) lineMap[y]=[];
      lineMap[y].push(item.str);
    }
    Object.keys(lineMap).map(Number).sort((a,b)=>b-a).forEach(y=>{text+=lineMap[y].join(' ')+'\n';});
  }
  return text;
}

function parseMercadoPagoPDF(text) {
  const lines=text.split('\n').map(l=>l.trim()).filter(Boolean);
  const skip=['dinheiro retirado reserva','dinheiro retirado contas','dinheiro reservado reserva','dinheiro reservado contas','rendimentos'];
  const txs=[];
  for (const line of lines) {
    const m=line.match(/^(\d{2}-\d{2}-\d{4})\s+(.+?)\s+\d{9,}\s+R\$\s+(-?[\d.,]+)\s+R\$\s+[\d.,]+$/);
    if (!m) continue;
    const [,rawDate,desc,rawAmount]=m;
    const [d,mo,y]=rawDate.split('-');
    const amount=parseFloat(rawAmount.replace(/\./g,'').replace(',','.'));
    if (isNaN(amount)||amount===0) continue;
    txs.push({date:`${y}-${mo}-${d}`,description:desc.trim(),amount:Math.abs(amount),type:amount>0?'income':'expense',category_id:'',skip:skip.some(kw=>desc.toLowerCase().includes(kw))});
  }
  if (!txs.length) throw new Error('Nenhuma transação encontrada. Verifique se é extrato Mercado Pago PDF.');
  return txs;
}

function parsePluxeePDF(text) {
  const MONTHS={'janeiro':'01','fevereiro':'02','março':'03','abril':'04','maio':'05','junho':'06','julho':'07','agosto':'08','setembro':'09','outubro':'10','novembro':'11','dezembro':'12'};
  const year=new Date().getFullYear();
  const lines=text.split('\n').map(l=>l.trim()).filter(Boolean);
  const txs=[];
  let currentDate=null;
  for (const line of lines) {
    const dh=line.match(/^(?:segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado|domingo)[-\s\w]*,?\s+(\d{1,2})\s+([\wÀ-ú]+)/i);
    if (dh) { const month=MONTHS[dh[2].toLowerCase()]; if (month) currentDate=`${year}-${month}-${dh[1].padStart(2,'0')}`; continue; }
    if (!currentDate) continue;
    const cr=line.match(/DISPONIBILIZACAO.*?R\$\s*([\d.,]+)/i);
    if (cr) { const a=parseFloat(cr[1].replace(/\./g,'').replace(',','.')); if (a>0) txs.push({date:currentDate,description:'Benefício Pluxee',amount:a,type:'income',category_id:'',skip:false}); continue; }
    if (/^\d{2}:\d{2}/.test(line)||/compra no|saldo/i.test(line)) continue;
    const pm=line.match(/^(.+?)\s+R\$\s*([\d.,]+)$/);
    if (pm) { const a=parseFloat(pm[2].replace(/\./g,'').replace(',','.')); if (a>0&&pm[1].length>2) txs.push({date:currentDate,description:pm[1].trim(),amount:a,type:'expense',category_id:'',skip:false}); }
  }
  if (!txs.length) throw new Error('Nenhuma transação encontrada. Verifique se é extrato Pluxee.');
  return txs;
}

function parseSicoobPDF(text) {
  const lines=text.split('\n').map(l=>l.trim()).filter(Boolean);
  const pm=text.match(/PER[IÍ]ODO:\s*\d{2}\/\d{2}\/(\d{4})/i);
  const year=pm?pm[1]:String(new Date().getFullYear());
  const skip=['saldo do dia','saldo anterior','saldo bloq','est.déb.conv','deb.conv.dem','juros vencidos','tarifas vencidas'];
  const txs=[];
  let i=0;
  while (i<lines.length) {
    const line=lines[i];
    const tm=line.match(/^(\d{2})\/(\d{2})\s+(.+?)\s+([\d.,]+)([CD])$/);
    if (!tm) { i++; continue; }
    const [,day,month,hist,rawVal,cd]=tm;
    const amount=parseFloat(rawVal.replace(/\./g,'').replace(',','.'));
    if (isNaN(amount)||amount===0) { i++; continue; }
    const extras=[];
    i++;
    while (i<lines.length) {
      const next=lines[i];
      if (/^\d{2}\/\d{2}\s/.test(next)) break;
      if (/^DOC\.:/.test(next)) { i++; break; }
      if (/^(RESUMO|\(\+\)|\(-\)|\(=\)|SALDO|ENCARGOS|VENCIMENTO|TAXA|CUSTO|SAC|OUVIDORIA)/i.test(next)) break;
      extras.push(next);
      i++;
    }
    const extra=extras.filter(l=>/^(Pagamento Pix|Recebimento Pix|\*{3}|\d{2}\.\d{3}|Ola,)/i.test(l)?false:true).slice(0,1).join(' ');
    const desc=extra?`${hist} - ${extra}`:hist;
    txs.push({date:`${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`,description:desc.slice(0,80),amount,type:cd==='C'?'income':'expense',category_id:'',skip:skip.some(kw=>hist.toLowerCase().includes(kw))});
  }
  if (!txs.length) throw new Error('Nenhuma transação encontrada. Verifique se é extrato Sicoob.');
  return txs;
}


// ── Parser PDF Sicoob Cartão de Crédito (Sicoobcard) ─────────────────────
// Baseado no formato real: seções MOVIMENTOS e GASTOS, descrições em 2 linhas
function parseSicoobCardPDF(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Extrai ano do vencimento: "Vencimento: 19/08/2026"
  const vencMatch = text.match(/Vencimento:\s*(\d{2})\/(\d{2})\/(\d{4})/i);
  const vencYear  = vencMatch ? parseInt(vencMatch[3]) : new Date().getFullYear();
  const vencMonth = vencMatch ? parseInt(vencMatch[2]) : new Date().getMonth()+1;

  // Determina o ano de uma transação baseado no mês
  // Parcelas antigas (jan/fev em fatura de ago) usam o ano do vencimento
  function getTxYear(txMonth) {
    // Se o mês da transação é muito maior que o vencimento, é do ano anterior
    // Ex: mês 11 ou 12 numa fatura de jan = ano anterior
    if (txMonth > vencMonth + 1) return vencYear - 1;
    return vencYear;
  }

  // Transações a ignorar
  const skipKeywords = [
    'saldo anterior', 'anuidade', 'desc anuidade', 'pagamento-boleto',
    'pagamento boleto', 'limite', 'encargo', 'total da fatura',
    'pagamento minimo', 'rotativo', 'saque',
  ];

  const txs = [];
  let i = 0;
  let inTransactions = false; // começa a coletar após "MOVIMENTOS" ou "GASTOS"

  while (i < lines.length) {
    const line = lines[i];

    // Detecta início das seções de transações
    if (/^MOVIMENTOS$/i.test(line) || /^GASTOS DE/i.test(line)) {
      inTransactions = true; i++; continue;
    }

    // Para de processar após o TOTAL ou seções de resumo
    if (/^TOTAL\s+[\d.,]+/.test(line)) break;
    if (/^(DEMONSTRATIVO|LIMITES|ENCARGOS|RESUMO|PERFIL|CANAIS|O PAGAMENTO)/i.test(line)) break;

    if (!inTransactions) { i++; continue; }

    // ── Formato linha completa: DD/MM DESCRIÇÃO VALOR ────────────────────
    // Valor pode ter ponto de milhar: 1.234,56
    // Também captura negativos: -426,20
    const fullLine = line.match(/^(\d{2})\/(\d{2})\s+(.+?)\s+(-?[\d.]+,[\d]{2})$/);
    if (fullLine) {
      const [, day, month, desc, rawVal] = fullLine;
      const amount = parseFloat(rawVal.replace(/\./g,'').replace(',','.'));
      if (isNaN(amount) || amount === 0) { i++; continue; }

      const descLower = desc.toLowerCase();
      const isPayment = amount < 0 || /pagamento|pagto|credito em conta|estorno|desc anuidade/i.test(descLower);
      const skipTx    = skipKeywords.some(kw => descLower.includes(kw));

      txs.push({
        date:        `${getTxYear(parseInt(month))}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`,
        description: desc.trim().slice(0, 80),
        amount:      Math.abs(amount),
        type:        isPayment ? 'income' : 'expense',
        category_id: '',
        skip:        skipTx,
      });
      i++; continue;
    }

    // ── Formato descrição em 2 linhas ─────────────────────────────────────
    // Linha 1: "21/01 MERCADOLIVRE*ECLOCKV 07/10 SO"  (sem valor)
    // Linha 2: "GONALO 69,91"                          (continuação + valor)
    const partialLine = line.match(/^(\d{2})\/(\d{2})\s+(.+)$/);
    if (partialLine && i + 1 < lines.length) {
      const nextLine = lines[i + 1];
      // Próxima linha não começa com DD/MM e termina com valor
      const contLine = nextLine.match(/^(.+?)\s+(-?[\d.]+,[\d]{2})$/);
      if (contLine && !/^\d{2}\/\d{2}\s/.test(nextLine)) {
        const [, day, month, partDesc] = partialLine;
        const [, contDesc, rawVal]     = contLine;
        const amount = parseFloat(rawVal.replace(/\./g,'').replace(',','.'));

        if (!isNaN(amount) && amount !== 0) {
          const fullDesc  = `${partDesc} ${contDesc}`.trim();
          const descLower = fullDesc.toLowerCase();
          const isPayment = amount < 0 || /pagamento|estorno/i.test(descLower);
          const skipTx    = skipKeywords.some(kw => descLower.includes(kw));

          txs.push({
            date:        `${getTxYear(parseInt(month))}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`,
            description: fullDesc.slice(0, 80),
            amount:      Math.abs(amount),
            type:        isPayment ? 'income' : 'expense',
            category_id: '',
            skip:        skipTx,
          });
          i += 2; continue;
        }
      }
    }

    i++;
  }

  if (!txs.length) throw new Error(
    'Nenhuma transação encontrada. Confirme que é o extrato de cartão Sicoob (PDF da fatura Sicoobcard).'
  );
  return txs;
}

function parseItauPDF(text) {
  const lines=text.split('\n');
  const skip=['SALDO DO DIA','período de visualização','emitido em','data lançamentos','saldo em conta','Limite da Conta','Total contratado','Os saldos','Aviso','Consultas,'];
  const pat=/^(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+(-?[\d.]+,\d{2})(?:\s+-?[\d.]+,\d{2})?$/;
  const txs=[];
  for (const rawLine of lines) {
    const line=rawLine.trim();
    if (!line||skip.some(kw=>line.includes(kw))) continue;
    const m=line.match(pat);
    if (!m) continue;
    const [,rawDate,desc,rawAmount]=m;
    const [d,mo,y]=rawDate.split('/');
    const amount=parseFloat(rawAmount.replace(/\./g,'').replace(',','.'));
    if (!amount) continue;
    const skipD=['REND PAGO','APLICACAO COFRINHOS','DINHEIRO RESERVADO'];
    txs.push({date:`${y}-${mo}-${d}`,description:desc.trim(),amount:Math.abs(amount),type:amount>0?'income':'expense',category_id:'',skip:skipD.some(kw=>desc.toUpperCase().includes(kw))});
  }
  if (!txs.length) throw new Error('Nenhuma transação encontrada. Verifique se é extrato Itaú.');
  return txs;
}

// ─── Config dos bancos ────────────────────────────────────────────────────
const BANKS = [
  { id:'mp-csv',  label:'Mercado Pago', icon:'💳', format:'CSV', accept:'.csv,text/csv',       steps:['Abra o app do Mercado Pago','Vá em Atividade → Extrato','Toque em "Exportar" → CSV','Selecione o período e baixe'] },
  { id:'mp-pdf',  label:'Mercado Pago', icon:'💳', format:'PDF', accept:'.pdf,application/pdf', badge:'Novo', steps:['Acesse mercadopago.com.br','Vá em Conta → Extrato de conta','Clique em "Baixar PDF"','Selecione o período'] },
  { id:'pluxee',  label:'Pluxee',       icon:'🎫', format:'PDF', accept:'.pdf,application/pdf', badge:'Novo', steps:['Acesse o app ou site da Pluxee','Vá em Extrato → Multibenefícios','Exporte o extrato em PDF','Selecione o período'] },
  { id:'sicoob',      label:'Sicoob',         icon:'🟢', format:'PDF', accept:'.pdf,application/pdf', steps:['Acesse o internet banking do Sicoob','Vá em Extrato → Conta Corrente','Selecione o período desejado','Clique em "Emitir" e salve o PDF'] },
  { id:'sicoob-card', label:'Sicoob Cartão',  icon:'💳', format:'PDF', accept:'.pdf,application/pdf', badge:'Novo', steps:['Acesse o internet banking do Sicoob','Vá em Cartões → Fatura do Cartão','Selecione o mês desejado','Clique em "Imprimir/Salvar" o PDF'] },
  { id:'itau',    label:'Itaú',         icon:'🏦', format:'PDF', accept:'.pdf,application/pdf', steps:['Acesse o app ou internet banking Itaú','Vá em Conta corrente → Extrato','Selecione o período desejado','Clique em "Exportar" → PDF'] },
];

const lbl = { display:'block', fontSize:12, color:'var(--text2)', fontWeight:500, marginBottom:6, letterSpacing:'0.02em' };
const fmt  = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v);
const fmtDate = d => new Date(d+'T00:00:00').toLocaleDateString('pt-BR');

export default function ImportModal({ onClose, onSave }) {
  const [step,         setStep]         = useState('upload');
  const [bankType,     setBankType]     = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [categories,   setCategories]   = useState([]);
  const [error,        setError]        = useState('');
  const [importing,    setImporting]    = useState(false);
  const [progress,     setProgress]     = useState(0);
  const [loadingFile,  setLoadingFile]  = useState(false);
  const [importResult, setImportResult] = useState(null); // { imported, skipped }
  const fileRef = useRef();

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setError(''); setLoadingFile(true);
    try {
      // 1. Parse do arquivo
      let parsed;
      const parsed = await parseFile(bankType, file);

      // 2. Checa duplicatas e auto-categoriza em paralelo
      const [dupRes, catRes, catsRes] = await Promise.all([
        api.post('/api/import/check-duplicates', { transactions: parsed }),
        api.post('/api/import/categorize', { transactions: parsed }),
        api.get('/api/categories'),
      ]);

      const withDups  = dupRes.data.transactions;
      const withCats  = catRes.data;

      // 3. Merge: duplicata + sugestão de categoria
      const merged = withDups.map((tx, i) => ({
        ...tx,
        category_id:             withCats[i]?.suggested_category_id || '',
        suggested_category_id:   withCats[i]?.suggested_category_id || null,
        suggested_category_name: withCats[i]?.suggested_category_name || null,
        suggestion_source:       withCats[i]?.suggestion_source || null,
        skip: tx.skip || tx.is_duplicate,
      }));

      setCategories(catsRes.data);
      setTransactions(merged);
      setStep('preview');

    } catch(err) {
      setError(err.message || 'Erro ao processar o arquivo.');
    } finally {
      setLoadingFile(false);
      e.target.value = '';
    }
  }

  function updateTx(i, field, value) {
    setTransactions(prev => prev.map((tx, idx) => idx===i ? { ...tx, [field]:value } : tx));
  }

  async function handleImport() {
    const toImport = transactions.filter(tx => !tx.skip);
    if (!toImport.length) { setError('Nenhuma transação selecionada.'); return; }
    setImporting(true); setProgress(0);
    let imported = 0, skipped = 0;

    for (const tx of toImport) {
      try {
        await api.post('/api/transactions', {
          date:        tx.date,
          description: tx.description,
          amount:      tx.amount,
          type:        tx.type,
          category_id: tx.category_id || null,
          import_hash: tx.import_hash,
        });
        imported++;
      } catch(_) { skipped++; } // duplicate ou erro
      setProgress(Math.round((imported+skipped)/toImport.length*100));
    }

    setImporting(false);
    setImportResult({ imported, skipped });
    setStep('result');
  }

  const toImport      = transactions.filter(tx=>!tx.skip);
  const duplicateCount = transactions.filter(tx=>tx.is_duplicate).length;
  const selectedBank  = BANKS.find(b=>b.id===bankType);

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.65)',backdropFilter:'blur(4px)',display:'flex',alignItems:step==='preview'?'flex-start':'center',justifyContent:'center',zIndex:50,padding:16,overflowY:'auto'}} onClick={onClose}>
      <div style={{background:'var(--bg2)',border:'1px solid var(--border-md)',borderRadius:18,width:'100%',maxWidth:step==='preview'?720:500,padding:'8px 24px 32px',boxShadow:'var(--shadow)',marginTop:step==='preview'?8:'auto',marginBottom:step==='preview'?8:'auto'}} className="fade-up" onClick={e=>e.stopPropagation()}>
        <div style={{width:36,height:4,borderRadius:2,background:'var(--bg3)',margin:'10px auto 20px'}}/>

        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
          <div>
            <h2 style={{fontSize:16,fontWeight:600,letterSpacing:'-0.02em'}}>
              {step==='upload'?'Importar extrato':step==='preview'?`Revisar — ${toImport.length} transações`:'Importação concluída'}
            </h2>
            {step==='preview'&&<p style={{fontSize:12,color:'var(--text3)',marginTop:3}}>Categorias sugeridas automaticamente. Ajuste se necessário.</p>}
          </div>
          <button onClick={onClose} style={{width:28,height:28,borderRadius:7,border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text2)',cursor:'pointer',fontSize:16,flexShrink:0}}>×</button>
        </div>

        {/* ── UPLOAD ── */}
        {step==='upload'&&(
          <div>
            <label style={lbl}>SELECIONE SEU BANCO / FORMATO</label>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:20}}>
              {BANKS.map(b=>(
                <button key={b.id} onClick={()=>setBankType(b.id)} style={{padding:'12px 8px',borderRadius:12,cursor:'pointer',textAlign:'left',fontFamily:'var(--font)',transition:'all 0.15s',border:`1.5px solid ${bankType===b.id?'var(--indigo)':'var(--border)'}`,background:bankType===b.id?'var(--indigo-dim)':'var(--bg3)',position:'relative'}}>
                  {b.badge&&<span style={{position:'absolute',top:5,right:5,fontSize:9,fontWeight:700,color:'var(--green)',background:'var(--green-dim)',borderRadius:4,padding:'1px 5px'}}>{b.badge}</span>}
                  <div style={{fontSize:18,marginBottom:4}}>{b.icon}</div>
                  <div style={{fontSize:11,fontWeight:600,color:'var(--text)'}}>{b.label}</div>
                  <div style={{fontSize:10,color:'var(--text3)'}}>{b.format}</div>
                </button>
              ))}
            </div>

            {selectedBank&&(
              <>
                <div style={{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:10,padding:'12px 14px',marginBottom:14}}>
                  <p style={{fontSize:12,fontWeight:500,marginBottom:8,color:'var(--text)'}}>Como exportar:</p>
                  {selectedBank.steps.map((s,i)=>(
                    <div key={i} style={{display:'flex',gap:8,marginBottom:6}}>
                      <div style={{width:18,height:18,borderRadius:5,background:'var(--indigo-dim)',color:'var(--indigo)',fontSize:10,fontWeight:600,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{i+1}</div>
                      <p style={{fontSize:12,color:'var(--text2)'}}>{s}</p>
                    </div>
                  ))}
                </div>

                {/* Info sobre importação inteligente */}
                <div style={{background:'rgba(45,212,160,0.08)',border:'1px solid rgba(45,212,160,0.2)',borderRadius:10,padding:'10px 14px',marginBottom:14,fontSize:12,color:'var(--text2)'}}>
                  ✨ <strong>Importação inteligente:</strong> categorias serão sugeridas automaticamente e transações já importadas não serão duplicadas.
                </div>

                <div onClick={()=>!loadingFile&&fileRef.current.click()}
                  style={{border:'2px dashed var(--border-md)',borderRadius:12,padding:'24px 16px',textAlign:'center',cursor:loadingFile?'wait':'pointer',transition:'all 0.2s'}}
                  onMouseOver={e=>{if(!loadingFile){e.currentTarget.style.borderColor='var(--indigo)';e.currentTarget.style.background='var(--indigo-dim)';}}}
                  onMouseOut={e=>{e.currentTarget.style.borderColor='var(--border-md)';e.currentTarget.style.background='transparent';}}>
                  {loadingFile
                    ?<><div style={{fontSize:22,marginBottom:6}}>⏳</div><p style={{fontSize:13,color:'var(--text)'}}>Analisando arquivo...</p></>
                    :<><div style={{fontSize:22,marginBottom:6}}>{selectedBank.format==='PDF'?'📄':'📂'}</div>
                      <p style={{fontSize:13,fontWeight:500,color:'var(--text)'}}>Clique para selecionar o {selectedBank.format}</p></>
                  }
                  <input ref={fileRef} type="file" accept={selectedBank.accept} onChange={handleFile} style={{display:'none'}}/>
                </div>
              </>
            )}
            {error&&<p style={{fontSize:13,color:'var(--red)',background:'var(--red-dim)',borderRadius:8,padding:'10px 12px',marginTop:12}}>{error}</p>}
          </div>
        )}

        {/* ── PREVIEW ── */}
        {step==='preview'&&(
          <div>
            {/* Resumo */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:14}}>
              {[
                {label:'Novas',       value:transactions.filter(t=>!t.is_duplicate&&!t.skip).length, color:'var(--green)'},
                {label:'Receitas',    value:fmt(toImport.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0)),  color:'var(--green)'},
                {label:'Despesas',    value:fmt(toImport.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0)), color:'var(--red)'},
                {label:'Já existem', value:duplicateCount, color:'var(--amber)'},
              ].map(c=>(
                <div key={c.label} style={{background:'var(--bg3)',borderRadius:9,padding:'10px 12px',textAlign:'center'}}>
                  <p style={{fontSize:10,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:4}}>{c.label}</p>
                  <p style={{fontFamily:'var(--mono)',fontSize:13,fontWeight:600,color:c.color}}>{c.value}</p>
                </div>
              ))}
            </div>

            {duplicateCount>0&&(
              <div style={{background:'rgba(245,166,35,0.08)',border:'1px solid rgba(245,166,35,0.25)',borderRadius:9,padding:'8px 12px',marginBottom:12,fontSize:12,color:'var(--amber)'}}>
                ⚠️ {duplicateCount} transação(ões) já importada(s) anteriormente — marcadas para ignorar automaticamente.
              </div>
            )}

            {/* Tabela */}
            <div style={{maxHeight:380,overflowY:'auto',borderRadius:10,border:'1px solid var(--border)'}}>
              <div style={{display:'grid',gridTemplateColumns:'24px 68px 1fr 110px 76px 24px',gap:5,padding:'7px 10px',background:'var(--bg3)',borderBottom:'1px solid var(--border)',position:'sticky',top:0}}>
                {['','Data','Descrição','Categoria','Valor',''].map((h,i)=>(
                  <span key={i} style={{fontSize:10,color:'var(--text3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em'}}>{h}</span>
                ))}
              </div>

              {transactions.map((tx,i)=>(
                <div key={i} style={{display:'grid',gridTemplateColumns:'24px 68px 1fr 110px 76px 24px',gap:5,padding:'7px 10px',alignItems:'center',borderBottom:'1px solid var(--border)',opacity:tx.skip?0.3:1,background:tx.skip?'transparent':tx.is_duplicate?'rgba(245,166,35,0.04)':'var(--bg2)',transition:'opacity 0.2s'}}>
                  <input type="checkbox" checked={!tx.skip} onChange={()=>updateTx(i,'skip',!tx.skip)} style={{width:14,height:14,accentColor:'var(--indigo)',cursor:'pointer'}}/>
                  <span style={{fontSize:10,color:'var(--text3)',fontFamily:'var(--mono)'}}>{fmtDate(tx.date)}</span>
                  <div style={{minWidth:0}}>
                    <p style={{fontSize:11,color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{tx.description}</p>
                    {tx.is_duplicate&&<span style={{fontSize:9,color:'var(--amber)',fontWeight:600}}>já importado</span>}
                  </div>
                  <div>
                    <select value={tx.category_id} disabled={tx.skip} onChange={e=>updateTx(i,'category_id',e.target.value)}
                      style={{fontSize:10,padding:'3px 4px',borderRadius:6,background:'var(--bg3)',border:`1px solid ${tx.suggested_category_id&&tx.category_id===tx.suggested_category_id?'rgba(45,212,160,0.4)':'var(--border)'}`,color:tx.category_id?'var(--text)':'var(--text3)',width:'100%'}}>
                      <option value="">Sem cat.</option>
                      {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    {tx.suggested_category_name&&tx.category_id===tx.suggested_category_id&&(
                      <p style={{fontSize:9,color:'var(--green)',marginTop:2}}>✨ {tx.suggestion_source==='user_rule'?'sua regra':'sugerido'}</p>
                    )}
                  </div>
                  <div style={{textAlign:'right'}}>
                    <span style={{fontFamily:'var(--mono)',fontSize:10,fontWeight:500,color:tx.type==='income'?'var(--green)':'var(--red)'}}>
                      {tx.type==='income'?'+':'-'}{fmt(tx.amount)}
                    </span>
                  </div>
                  <button onClick={()=>updateTx(i,'type',tx.type==='income'?'expense':'income')} disabled={tx.skip}
                    style={{width:20,height:20,borderRadius:4,border:'none',cursor:'pointer',background:tx.type==='income'?'var(--green-dim)':'var(--red-dim)',color:tx.type==='income'?'var(--green)':'var(--red)',fontSize:10,fontWeight:700}}>
                    {tx.type==='income'?'↑':'↓'}
                  </button>
                </div>
              ))}
            </div>

            {error&&<p style={{fontSize:13,color:'var(--red)',background:'var(--red-dim)',borderRadius:8,padding:'10px 12px',marginTop:10}}>{error}</p>}

            {importing&&(
              <div style={{marginTop:12}}>
                <div style={{background:'var(--bg3)',borderRadius:99,height:5,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${progress}%`,background:'linear-gradient(90deg,var(--indigo),#a78bfa)',borderRadius:99,transition:'width 0.2s'}}/>
                </div>
                <p style={{fontSize:12,color:'var(--text3)',textAlign:'center',marginTop:6}}>Importando... {progress}%</p>
              </div>
            )}

            <div style={{display:'flex',gap:10,marginTop:14}}>
              <button onClick={()=>setStep('upload')} style={{flex:1,padding:'12px 0',borderRadius:10,fontSize:13,fontWeight:500,border:'1px solid var(--border)',background:'transparent',color:'var(--text2)',cursor:'pointer',fontFamily:'var(--font)'}}>← Voltar</button>
              <button onClick={handleImport} disabled={importing||!toImport.length} style={{flex:2,padding:'12px 0',borderRadius:10,fontSize:13,fontWeight:600,border:'none',cursor:'pointer',fontFamily:'var(--font)',background:importing?'var(--bg3)':'linear-gradient(135deg,var(--indigo),#a78bfa)',color:importing?'var(--text3)':'#fff'}}>
                {importing?`Importando... ${progress}%`:`Importar ${toImport.length} transações`}
              </button>
            </div>
          </div>
        )}

        {/* ── RESULTADO ── */}
        {step==='result'&&importResult&&(
          <div style={{textAlign:'center',padding:'20px 0'}}>
            <div style={{fontSize:48,marginBottom:16}}>🎉</div>
            <h3 style={{fontSize:18,fontWeight:600,marginBottom:8}}>Importação concluída!</h3>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,margin:'20px 0',textAlign:'center'}}>
              <div style={{background:'var(--green-dim)',border:'1px solid rgba(45,212,160,0.25)',borderRadius:12,padding:'16px'}}>
                <p style={{fontFamily:'var(--mono)',fontSize:28,fontWeight:700,color:'var(--green)'}}>{importResult.imported}</p>
                <p style={{fontSize:12,color:'var(--text3)',marginTop:4}}>transações importadas</p>
              </div>
              <div style={{background:'rgba(245,166,35,0.08)',border:'1px solid rgba(245,166,35,0.2)',borderRadius:12,padding:'16px'}}>
                <p style={{fontFamily:'var(--mono)',fontSize:28,fontWeight:700,color:'var(--amber)'}}>{importResult.skipped}</p>
                <p style={{fontSize:12,color:'var(--text3)',marginTop:4}}>já existiam</p>
              </div>
            </div>
            <button onClick={onSave} style={{padding:'13px 40px',borderRadius:10,border:'none',cursor:'pointer',fontFamily:'var(--font)',fontSize:14,fontWeight:600,background:'linear-gradient(135deg,var(--indigo),#a78bfa)',color:'#fff'}}>
              Ver no dashboard →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
