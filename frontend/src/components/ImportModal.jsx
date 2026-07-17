import { useState, useRef } from 'react';
import api from '../lib/api';

// ─── Parser CSV Mercado Pago (antigo) ──────────────────────────────────────
function parseMercadoPagoCSV(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const headerIdx = lines.findIndex(l => l.startsWith('RELEASE_DATE'));
  if (headerIdx === -1) throw new Error('Formato inválido. Use o CSV padrão do Mercado Pago.');
  const transactions = [];
  for (const line of lines.slice(headerIdx + 1)) {
    const cols = line.split(';');
    if (cols.length < 4) continue;
    const [rawDate, rawDesc,, rawAmount] = cols;
    const [d, m, y] = rawDate.trim().split('-');
    if (!d || !m || !y) continue;
    const date   = `${y}-${m}-${d}`;
    const amount = parseFloat(rawAmount.trim().replace(/\./g, '').replace(',', '.'));
    if (isNaN(amount) || amount === 0) continue;
    transactions.push({
      date, description: rawDesc.trim(),
      amount: Math.abs(amount),
      type: amount > 0 ? 'income' : 'expense',
      category_id: '',
      skip: rawDesc.trim().toLowerCase().startsWith('rendimento'),
    });
  }
  if (!transactions.length) throw new Error('Nenhuma transação encontrada no arquivo.');
  return transactions;
}

// ─── Extração de texto de PDF via pdfjs ───────────────────────────────────
async function extractPDFText(file) {
  const pdfjsLib = await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.min.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.worker.min.mjs';
  const arrayBuffer = await file.arrayBuffer();
  const pdf  = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page    = await pdf.getPage(i);
    const content = await page.getTextContent();
    const lineMap = {};
    for (const item of content.items) {
      const y = Math.round(item.transform[5]);
      if (!lineMap[y]) lineMap[y] = [];
      lineMap[y].push(item.str);
    }
    const sortedYs = Object.keys(lineMap).map(Number).sort((a, b) => b - a);
    for (const y of sortedYs) {
      fullText += lineMap[y].join(' ') + '\n';
    }
  }
  return fullText;
}

// ─── Parser PDF Mercado Pago (novo formato) ────────────────────────────────
function parseMercadoPagoPDF(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const transactions = [];

  // Palavras que indicam movimentação interna (ignorar)
  const skipKeywords = [
    'dinheiro retirado reserva',
    'dinheiro retirado contas',
    'dinheiro reservado reserva',
    'dinheiro reservado contas',
    'rendimentos',
  ];

  for (const line of lines) {
    // Padrão: DD-MM-YYYY ... R$ -?valor ... R$ saldo
    // Exemplos:
    //   01-07-2026 Pix enviado Lennon Cintra Garcia 165894680299 R$ -11,00 R$ 1,12
    //   06-07-2026 Pix recebido MATHEUS DE CASTRO EVANGELISTA 167467656774 R$ 690,00 R$ 706,90
    const match = line.match(
      /^(\d{2}-\d{2}-\d{4})\s+(.+?)\s+\d{9,}\s+R\$\s+(-?[\d.,]+)\s+R\$\s+[\d.,]+$/
    );
    if (!match) continue;

    const [, rawDate, desc, rawAmount] = match;
    const [d, mo, y] = rawDate.split('-');
    const date   = `${y}-${mo}-${d}`;
    const amount = parseFloat(rawAmount.replace(/\./g, '').replace(',', '.'));
    if (isNaN(amount) || amount === 0) continue;

    const descLower = desc.toLowerCase();
    const skip = skipKeywords.some(kw => descLower.includes(kw));

    transactions.push({
      date,
      description: desc.trim(),
      amount: Math.abs(amount),
      type: amount > 0 ? 'income' : 'expense',
      category_id: '',
      skip,
    });
  }

  if (!transactions.length) throw new Error('Nenhuma transação encontrada. Verifique se é um extrato Mercado Pago PDF.');
  return transactions;
}

// ─── Parser PDF Pluxee (cartão multibenefícios) ────────────────────────────
function parsePluxeePDF(text) {
  const MONTHS = {
    'janeiro':'01','fevereiro':'02','março':'03','abril':'04',
    'maio':'05','junho':'06','julho':'07','agosto':'08',
    'setembro':'09','outubro':'10','novembro':'11','dezembro':'12',
  };
  const WEEKDAYS = ['segunda','terça','quarta','quinta','sexta','sábado','domingo'];
  const currentYear = new Date().getFullYear();

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const transactions = [];
  let currentDate = null;

  for (const line of lines) {
    // Detecta cabeçalho de dia: "sexta-feira, 10 julho" ou "segunda-feira, 1 junho"
    const dayHeader = line.match(
      /^(?:segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado|domingo)[-\s\w]*,?\s+(\d{1,2})\s+([\wÀ-ú]+)/i
    );
    if (dayHeader) {
      const day   = dayHeader[1].padStart(2, '0');
      const mName = dayHeader[2].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const month = MONTHS[dayHeader[2].toLowerCase()] ||
                    Object.entries(MONTHS).find(([k]) =>
                      k.normalize('NFD').replace(/[\u0300-\u036f]/g,'').startsWith(mName.slice(0,3))
                    )?.[1];
      if (month) currentDate = `${currentYear}-${month}-${day}`;
      continue;
    }

    if (!currentDate) continue;

    // Crédito: "DISPONIBILIZACAO DE BENEFICIO ... (CREDITO) R$ X.XXX,XX"
    const creditMatch = line.match(/DISPONIBILIZACAO.*?R\$\s*([\d.,]+)/i);
    if (creditMatch) {
      const amount = parseFloat(creditMatch[1].replace(/\./g,'').replace(',','.'));
      if (!isNaN(amount) && amount > 0) {
        transactions.push({
          date: currentDate,
          description: 'Benefício Pluxee',
          amount,
          type: 'income',
          category_id: '',
          skip: false,
        });
      }
      continue;
    }

    // Ignora linhas de hora, tipo de compra e saldo
    if (/^\d{2}:\d{2}/.test(line)) continue;
    if (/compra no|saldo (total|liberado|das|das carteiras)/i.test(line)) continue;
    if (/atualizado|multibenef/i.test(line)) continue;

    // Compra: "NOME DO ESTABELECIMENTO R$ X,XX"
    const purchaseMatch = line.match(/^(.+?)\s+R\$\s*([\d.,]+)$/);
    if (purchaseMatch) {
      const desc   = purchaseMatch[1].trim();
      const amount = parseFloat(purchaseMatch[2].replace(/\./g,'').replace(',','.'));
      if (!isNaN(amount) && amount > 0 && desc.length > 2) {
        transactions.push({
          date: currentDate,
          description: desc,
          amount,
          type: 'expense',
          category_id: '',
          skip: false,
        });
      }
    }
  }

  if (!transactions.length) throw new Error('Nenhuma transação encontrada. Verifique se é um extrato Pluxee válido.');
  return transactions;
}

// ─── Parser PDF Itaú (existente) ──────────────────────────────────────────
function parseItauPDF(text) {
  const lines = text.split('\n');
  const transactions = [];
  const skipKeywords = ['SALDO DO DIA','período de visualização','emitido em',
    'data lançamentos','saldo em conta','Limite da Conta','Total contratado',
    'Os saldos','Aviso','Consultas,'];
  const pattern = /^(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+(-?[\d.]+,\d{2})(?:\s+-?[\d.]+,\d{2})?$/;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || skipKeywords.some(kw => line.includes(kw))) continue;
    const m = line.match(pattern);
    if (!m) continue;
    const [, rawDate, desc, rawAmount] = m;
    const [d, mo, y] = rawDate.split('/');
    const date   = `${y}-${mo}-${d}`;
    const amount = parseFloat(rawAmount.replace(/\./g,'').replace(',','.'));
    if (!amount) continue;
    const skipDesc = ['REND PAGO','APLICACAO COFRINHOS','DINHEIRO RESERVADO'];
    transactions.push({
      date, description: desc.trim(),
      amount: Math.abs(amount),
      type: amount > 0 ? 'income' : 'expense',
      category_id: '',
      skip: skipDesc.some(kw => desc.toUpperCase().includes(kw)),
    });
  }
  if (!transactions.length) throw new Error('Nenhuma transação encontrada. Verifique se é um extrato Itaú válido.');
  return transactions;
}

// ─── Config dos bancos ────────────────────────────────────────────────────
const BANKS = [
  {
    id: 'mp-csv', label: 'Mercado Pago', icon: '💳', format: 'CSV',
    accept: '.csv,text/csv',
    steps: ['Abra o app do Mercado Pago','Vá em Atividade → Extrato','Toque em "Exportar" → CSV','Selecione o período e baixe'],
  },
  {
    id: 'mp-pdf', label: 'Mercado Pago', icon: '💳', format: 'PDF',
    accept: '.pdf,application/pdf',
    badge: 'Novo',
    steps: ['Acesse mercadopago.com.br no navegador','Vá em Conta → Extrato de conta','Clique em "Baixar PDF"','Selecione o período'],
  },
  {
    id: 'pluxee', label: 'Pluxee', icon: '🎫', format: 'PDF',
    accept: '.pdf,application/pdf',
    badge: 'Novo',
    steps: ['Acesse o app ou site da Pluxee','Vá em Extrato → Multibenefícios','Exporte o extrato em PDF','Selecione o período'],
  },
  {
    id: 'itau', label: 'Itaú', icon: '🏦', format: 'PDF',
    accept: '.pdf,application/pdf',
    steps: ['Acesse o app ou internet banking Itaú','Vá em Conta corrente → Extrato','Selecione o período desejado','Clique em "Exportar" → PDF'],
  },
];

const labelStyle = { display:'block', fontSize:12, color:'var(--text2)', fontWeight:500, marginBottom:6, letterSpacing:'0.02em' };

// ─── Componente principal ─────────────────────────────────────────────────
export default function ImportModal({ onClose, onSave }) {
  const [step,        setStep]        = useState('upload');
  const [bankType,    setBankType]    = useState(null);
  const [transactions,setTransactions]= useState([]);
  const [categories,  setCategories]  = useState([]);
  const [error,       setError]       = useState('');
  const [importing,   setImporting]   = useState(false);
  const [progress,    setProgress]    = useState(0);
  const [loadingFile, setLoadingFile] = useState(false);
  const fileRef = useRef();

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setError(''); setLoadingFile(true);
    try {
      let parsed;
      if (bankType === 'mp-csv') {
        parsed = parseMercadoPagoCSV(await file.text());
      } else if (bankType === 'mp-pdf') {
        const text = await extractPDFText(file);
        parsed = parseMercadoPagoPDF(text);
      } else if (bankType === 'pluxee') {
        const text = await extractPDFText(file);
        parsed = parsePluxeePDF(text);
      } else {
        const text = await extractPDFText(file);
        parsed = parseItauPDF(text);
      }
      const { data: cats } = await api.get('/api/categories');
      setCategories(cats);
      setTransactions(parsed);
      setStep('preview');
    } catch (err) {
      setError(err.message || 'Erro ao processar o arquivo.');
    } finally {
      setLoadingFile(false);
      e.target.value = '';
    }
  }

  function updateTx(i, field, value) {
    setTransactions(prev => prev.map((tx, idx) => idx === i ? { ...tx, [field]: value } : tx));
  }

  async function handleImport() {
    const toImport = transactions.filter(tx => !tx.skip);
    if (!toImport.length) { setError('Nenhuma transação selecionada.'); return; }
    setImporting(true); setProgress(0);
    let count = 0;
    for (const tx of toImport) {
      try {
        await api.post('/api/transactions', {
          date: tx.date, description: tx.description,
          amount: tx.amount, type: tx.type,
          category_id: tx.category_id || null,
        });
      } catch (_) {}
      count++;
      setProgress(Math.round(count / toImport.length * 100));
    }
    setImporting(false);
    onSave();
  }

  const toImport    = transactions.filter(tx => !tx.skip);
  const fmt         = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v);
  const fmtDate     = d => new Date(d+'T00:00:00').toLocaleDateString('pt-BR');
  const selectedBank = BANKS.find(b => b.id === bankType);

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.65)',backdropFilter:'blur(4px)',display:'flex',alignItems:step==='preview'?'flex-start':'center',justifyContent:'center',zIndex:50,padding:16,overflowY:'auto'}} onClick={onClose}>
      <div style={{background:'var(--bg2)',border:'1px solid var(--border-md)',borderRadius:18,width:'100%',maxWidth:step==='preview'?700:500,padding:'8px 24px 32px',boxShadow:'var(--shadow)',marginTop:step==='preview'?0:'auto',marginBottom:step==='preview'?0:'auto'}} className="fade-up" onClick={e=>e.stopPropagation()}>

        <div style={{width:36,height:4,borderRadius:2,background:'var(--bg3)',margin:'10px auto 20px'}}/>

        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:22}}>
          <div>
            <h2 style={{fontSize:16,fontWeight:600,letterSpacing:'-0.02em'}}>
              {step==='upload'?'Importar extrato bancário':`Revisar — ${toImport.length} de ${transactions.length} transações`}
            </h2>
            {step==='preview'&&<p style={{fontSize:12,color:'var(--text3)',marginTop:3}}>Desmarque o que não quer importar, ajuste categorias e confirme.</p>}
          </div>
          <button onClick={onClose} style={{width:28,height:28,borderRadius:7,border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text2)',cursor:'pointer',fontSize:16,flexShrink:0}}>×</button>
        </div>

        {/* ── UPLOAD ── */}
        {step==='upload'&&(
          <div>
            <p style={labelStyle}>SELECIONE SEU BANCO / FORMATO</p>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:22}}>
              {BANKS.map(b=>(
                <button key={b.id} onClick={()=>setBankType(b.id)} style={{padding:'14px 12px',borderRadius:12,cursor:'pointer',textAlign:'left',fontFamily:'var(--font)',transition:'all 0.15s',border:`1.5px solid ${bankType===b.id?'var(--indigo)':'var(--border)'}`,background:bankType===b.id?'var(--indigo-dim)':'var(--bg3)',position:'relative'}}>
                  {b.badge&&<span style={{position:'absolute',top:8,right:8,fontSize:10,fontWeight:700,color:'var(--green)',background:'var(--green-dim)',borderRadius:4,padding:'2px 5px'}}>{b.badge}</span>}
                  <div style={{fontSize:22,marginBottom:6}}>{b.icon}</div>
                  <div style={{fontSize:13,fontWeight:600,color:'var(--text)'}}>{b.label}</div>
                  <div style={{fontSize:11,color:'var(--text3)',marginTop:2}}>Formato: {b.format}</div>
                </button>
              ))}
            </div>

            {selectedBank&&(
              <>
                <div style={{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:12,padding:'14px 16px',marginBottom:16}}>
                  <p style={{fontSize:13,fontWeight:500,marginBottom:10,color:'var(--text)'}}>Como exportar:</p>
                  {selectedBank.steps.map((s,i)=>(
                    <div key={i} style={{display:'flex',alignItems:'flex-start',gap:10,marginBottom:8}}>
                      <div style={{width:20,height:20,borderRadius:6,background:'var(--indigo-dim)',color:'var(--indigo)',fontSize:11,fontWeight:600,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{i+1}</div>
                      <p style={{fontSize:13,color:'var(--text2)',lineHeight:1.5}}>{s}</p>
                    </div>
                  ))}
                </div>

                <div onClick={()=>!loadingFile&&fileRef.current.click()}
                  style={{border:'2px dashed var(--border-md)',borderRadius:14,padding:'28px 20px',textAlign:'center',cursor:loadingFile?'wait':'pointer',transition:'all 0.2s'}}
                  onMouseOver={e=>{if(!loadingFile){e.currentTarget.style.borderColor='var(--indigo)';e.currentTarget.style.background='var(--indigo-dim)';}}}
                  onMouseOut={e=>{e.currentTarget.style.borderColor='var(--border-md)';e.currentTarget.style.background='transparent';}}>
                  {loadingFile?(
                    <><div style={{fontSize:26,marginBottom:8}}>⏳</div><p style={{fontSize:14,fontWeight:500,color:'var(--text)'}}>Lendo o arquivo...</p></>
                  ):(
                    <><div style={{fontSize:26,marginBottom:8}}>{selectedBank.format==='PDF'?'📄':'📂'}</div>
                    <p style={{fontSize:14,fontWeight:500,color:'var(--text)'}}>Clique para selecionar o {selectedBank.format}</p>
                    <p style={{fontSize:12,color:'var(--text3)',marginTop:4}}>Extrato {selectedBank.label} em {selectedBank.format}</p></>
                  )}
                  <input ref={fileRef} type="file" accept={selectedBank.accept} onChange={handleFile} style={{display:'none'}}/>
                </div>
              </>
            )}

            {error&&<p style={{fontSize:13,color:'var(--red)',background:'var(--red-dim)',borderRadius:8,padding:'10px 12px',marginTop:14}}>{error}</p>}
          </div>
        )}

        {/* ── PREVIEW ── */}
        {step==='preview'&&(
          <div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:18}}>
              {[
                {label:'Receitas',  value:fmt(toImport.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0)),  color:'var(--green)'},
                {label:'Despesas',  value:fmt(toImport.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0)), color:'var(--red)'},
                {label:'Ignoradas', value:transactions.filter(t=>t.skip).length, color:'var(--text3)'},
              ].map(c=>(
                <div key={c.label} style={{background:'var(--bg3)',borderRadius:10,padding:'12px 14px',textAlign:'center'}}>
                  <p style={{fontSize:11,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:6}}>{c.label}</p>
                  <p style={{fontFamily:'var(--mono)',fontSize:14,fontWeight:600,color:c.color}}>{c.value}</p>
                </div>
              ))}
            </div>

            <div style={{maxHeight:380,overflowY:'auto',borderRadius:10,border:'1px solid var(--border)'}}>
              <div style={{display:'grid',gridTemplateColumns:'28px 76px 1fr 100px 88px 28px',gap:6,padding:'8px 12px',background:'var(--bg3)',borderBottom:'1px solid var(--border)',position:'sticky',top:0}}>
                {['','Data','Descrição','Categoria','Valor',''].map((h,i)=>(
                  <span key={i} style={{fontSize:11,color:'var(--text3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em'}}>{h}</span>
                ))}
              </div>

              {transactions.map((tx,i)=>(
                <div key={i} style={{display:'grid',gridTemplateColumns:'28px 76px 1fr 100px 88px 28px',gap:6,padding:'8px 12px',alignItems:'center',borderBottom:'1px solid var(--border)',opacity:tx.skip?0.3:1,background:tx.skip?'transparent':'var(--bg2)',transition:'opacity 0.2s'}}>
                  <input type="checkbox" checked={!tx.skip} onChange={()=>updateTx(i,'skip',!tx.skip)} style={{width:15,height:15,accentColor:'var(--indigo)',cursor:'pointer'}}/>
                  <span style={{fontSize:11,color:'var(--text3)',fontFamily:'var(--mono)'}}>{fmtDate(tx.date)}</span>
                  <input value={tx.description} disabled={tx.skip} onChange={e=>updateTx(i,'description',e.target.value)}
                    style={{fontSize:11,padding:'3px 7px',borderRadius:6,background:'var(--bg3)',border:'1px solid var(--border)',color:'var(--text)',width:'100%'}}/>
                  <select value={tx.category_id} disabled={tx.skip} onChange={e=>updateTx(i,'category_id',e.target.value)}
                    style={{fontSize:11,padding:'3px 5px',borderRadius:6,background:'var(--bg3)',border:'1px solid var(--border)',color:tx.category_id?'var(--text)':'var(--text3)',width:'100%'}}>
                    <option value="">Sem cat.</option>
                    {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <div style={{textAlign:'right'}}>
                    <span style={{fontFamily:'var(--mono)',fontSize:11,fontWeight:500,color:tx.type==='income'?'var(--green)':'var(--red)'}}>
                      {tx.type==='income'?'+':'-'}{fmt(tx.amount)}
                    </span>
                  </div>
                  <button onClick={()=>updateTx(i,'type',tx.type==='income'?'expense':'income')} disabled={tx.skip} title="Inverter tipo"
                    style={{width:22,height:22,borderRadius:5,border:'none',cursor:'pointer',background:tx.type==='income'?'var(--green-dim)':'var(--red-dim)',color:tx.type==='income'?'var(--green)':'var(--red)',fontSize:11,fontWeight:700}}>
                    {tx.type==='income'?'↑':'↓'}
                  </button>
                </div>
              ))}
            </div>

            {error&&<p style={{fontSize:13,color:'var(--red)',background:'var(--red-dim)',borderRadius:8,padding:'10px 12px',marginTop:12}}>{error}</p>}

            {importing&&(
              <div style={{marginTop:14}}>
                <div style={{background:'var(--bg3)',borderRadius:99,height:6,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${progress}%`,background:'linear-gradient(90deg,var(--indigo),#a78bfa)',borderRadius:99,transition:'width 0.2s'}}/>
                </div>
                <p style={{fontSize:12,color:'var(--text3)',textAlign:'center',marginTop:8}}>Importando... {progress}%</p>
              </div>
            )}

            <div style={{display:'flex',gap:10,marginTop:16}}>
              <button onClick={()=>setStep('upload')} style={{flex:1,padding:'13px 0',borderRadius:10,fontSize:14,fontWeight:500,border:'1px solid var(--border)',background:'transparent',color:'var(--text2)',cursor:'pointer',fontFamily:'var(--font)'}}>← Voltar</button>
              <button onClick={handleImport} disabled={importing||!toImport.length} style={{flex:2,padding:'13px 0',borderRadius:10,fontSize:14,fontWeight:600,border:'none',cursor:'pointer',fontFamily:'var(--font)',background:importing?'var(--bg3)':'linear-gradient(135deg,var(--indigo),#a78bfa)',color:importing?'var(--text3)':'#fff'}}>
                {importing?`Importando... ${progress}%`:`Importar ${toImport.length} transações`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
