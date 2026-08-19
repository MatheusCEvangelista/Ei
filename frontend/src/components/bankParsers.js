// ═══════════════════════════════════════════════════════════════════════════
// bankParsers.js — Parsers de extrato bancário para importação
// Adicione no topo do ImportModal.jsx substituindo os parsers anteriores
// ═══════════════════════════════════════════════════════════════════════════

// ── Utilitários compartilhados ────────────────────────────────────────────
export async function extractPDFText(file) {
  const pdfjsLib = await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.min.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.worker.min.mjs';
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page    = await pdf.getPage(i);
    const content = await page.getTextContent();
    const lineMap = {};
    for (const item of content.items) {
      const y = Math.round(item.transform[5]);
      if (!lineMap[y]) lineMap[y] = [];
      lineMap[y].push(item.str);
    }
    Object.keys(lineMap).map(Number).sort((a,b)=>b-a)
      .forEach(y => { text += lineMap[y].join(' ') + '\n'; });
  }
  return text;
}

// ── Auto-detecção de banco pelo conteúdo ──────────────────────────────────
export function detectBank(text) {
  const t = text.toLowerCase();
  if (/nubank|roxinho/i.test(t))                                    return 'nubank-pdf';
  if (/banco inter\b|bancointer|inter.*extrato/i.test(t))           return 'inter';
  if (/c6 bank|c6bank/i.test(t))                                    return 'c6';
  if (/mercado pago/i.test(t))                                      return 'mp-pdf';
  if (/sicoob.*cartão|sicoobcard|extrato.*cartão.*sicoob/i.test(t)) return 'sicoob-card';
  if (/sicoob/i.test(t))                                            return 'sicoob';
  if (/itaú|itau/i.test(t))                                         return 'itau';
  if (/pluxee|sodexo/i.test(t))                                     return 'pluxee';
  return null;
}

// ── Nubank CSV (cartão de crédito) ────────────────────────────────────────
// App Nubank → Transações → Exportar → CSV
export function parseNubankCSV(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const hi    = lines.findIndex(l => /data.*descri|descri.*data/i.test(l));
  if (hi === -1) throw new Error('Formato CSV Nubank não reconhecido. Use: App → Transações → Exportar.');

  const header  = lines[hi].toLowerCase().split(',').map(h => h.replace(/"/g,'').trim());
  const dateIdx = header.findIndex(h => h.includes('data'));
  const descIdx = header.findIndex(h => h.includes('descri'));
  const valIdx  = header.findIndex(h => h.includes('valor') || h.includes('amount'));

  if (dateIdx < 0 || descIdx < 0 || valIdx < 0)
    throw new Error('Colunas Data, Descrição e Valor não encontradas no CSV Nubank.');

  const txs = [];
  for (const line of lines.slice(hi + 1)) {
    if (!line.trim()) continue;
    const cols    = line.split(',').map(c => c.replace(/^"|"$/g,'').trim());
    if (cols.length < 3) continue;
    const rawDate = cols[dateIdx];
    const desc    = cols[descIdx];
    const rawVal  = cols[valIdx];

    let date;
    if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
      date = rawDate;
    } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(rawDate)) {
      const [d,m,y] = rawDate.split('/');
      date = `${y}-${m}-${d}`;
    } else continue;

    const amount = parseFloat(rawVal.replace(/[^\d.,-]/g,'').replace(',','.'));
    if (isNaN(amount) || amount === 0) continue;

    const isPayment = amount < 0 || /pagamento/i.test(desc);
    txs.push({
      date,
      description: desc.trim().slice(0, 80),
      amount:      Math.abs(amount),
      type:        isPayment ? 'income' : 'expense',
      category_id: '',
      skip:        isPayment,
    });
  }

  if (!txs.length) throw new Error('Nenhuma transação encontrada no CSV Nubank.');
  return txs;
}

// ── Mercado Pago CSV ──────────────────────────────────────────────────────
export function parseMercadoPagoCSV(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const hi    = lines.findIndex(l => l.startsWith('RELEASE_DATE'));
  if (hi === -1) throw new Error('Formato inválido. Use o CSV padrão do Mercado Pago.');
  const txs = [];
  for (const line of lines.slice(hi + 1)) {
    const cols = line.split(';');
    if (cols.length < 4) continue;
    const [rawDate, rawDesc,, rawAmount] = cols;
    const [d,m,y] = rawDate.trim().split('-');
    if (!d||!m||!y) continue;
    const amount = parseFloat(rawAmount.trim().replace(/\./g,'').replace(',','.'));
    if (isNaN(amount) || amount === 0) continue;
    txs.push({
      date: `${y}-${m}-${d}`,
      description: rawDesc.trim(),
      amount:      Math.abs(amount),
      type:        amount > 0 ? 'income' : 'expense',
      category_id: '',
      skip:        rawDesc.trim().toLowerCase().startsWith('rendimento'),
    });
  }
  if (!txs.length) throw new Error('Nenhuma transação encontrada no CSV Mercado Pago.');
  return txs;
}

// ── Mercado Pago PDF ──────────────────────────────────────────────────────
export function parseMercadoPagoPDF(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const skip  = ['dinheiro retirado reserva','dinheiro retirado contas','dinheiro reservado','rendimentos'];
  const txs   = [];
  for (const line of lines) {
    const m = line.match(/^(\d{2}-\d{2}-\d{4})\s+(.+?)\s+\d{9,}\s+R\$\s+(-?[\d.,]+)\s+R\$\s+[\d.,]+$/);
    if (!m) continue;
    const [,rawDate,desc,rawAmount] = m;
    const [d,mo,y] = rawDate.split('-');
    const amount = parseFloat(rawAmount.replace(/\./g,'').replace(',','.'));
    if (isNaN(amount)||amount===0) continue;
    txs.push({ date:`${y}-${mo}-${d}`, description:desc.trim(), amount:Math.abs(amount), type:amount>0?'income':'expense', category_id:'', skip:skip.some(kw=>desc.toLowerCase().includes(kw)) });
  }
  if (!txs.length) throw new Error('Nenhuma transação encontrada no PDF Mercado Pago.');
  return txs;
}

// ── Pluxee PDF ────────────────────────────────────────────────────────────
export function parsePluxeePDF(text) {
  const MONTHS = {janeiro:'01',fevereiro:'02','março':'03',abril:'04',maio:'05',junho:'06',julho:'07',agosto:'08',setembro:'09',outubro:'10',novembro:'11',dezembro:'12'};
  const year   = new Date().getFullYear();
  const lines  = text.split('\n').map(l => l.trim()).filter(Boolean);
  const txs    = [];
  let currentDate = null;
  for (const line of lines) {
    const dh = line.match(/^(?:segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado|domingo)[-\s\w]*,?\s+(\d{1,2})\s+([\wÀ-ú]+)/i);
    if (dh) { const month = MONTHS[dh[2].toLowerCase()]; if (month) currentDate=`${year}-${month}-${dh[1].padStart(2,'0')}`; continue; }
    if (!currentDate) continue;
    const cr = line.match(/DISPONIBILIZACAO.*?R\$\s*([\d.,]+)/i);
    if (cr) { const a=parseFloat(cr[1].replace(/\./g,'').replace(',','.')); if(a>0) txs.push({date:currentDate,description:'Benefício Pluxee',amount:a,type:'income',category_id:'',skip:false}); continue; }
    const pm = line.match(/^(.+?)\s+R\$\s*([\d.,]+)$/);
    if (pm) { const a=parseFloat(pm[2].replace(/\./g,'').replace(',','.')); if(a>0&&pm[1].length>2) txs.push({date:currentDate,description:pm[1].trim(),amount:a,type:'expense',category_id:'',skip:false}); }
  }
  if (!txs.length) throw new Error('Nenhuma transação encontrada no PDF Pluxee.');
  return txs;
}

// ── Sicoob Conta Corrente PDF ─────────────────────────────────────────────
export function parseSicoobPDF(text) {
  const lines   = text.split('\n').map(l => l.trim()).filter(Boolean);
  const pm      = text.match(/PER[IÍ]ODO:\s*\d{2}\/\d{2}\/(\d{4})/i);
  const year    = pm ? pm[1] : String(new Date().getFullYear());
  const skip    = ['saldo do dia','saldo anterior','saldo bloq','est.déb.conv','deb.conv.dem','juros vencidos','tarifas vencidas'];
  const txs     = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const tm   = line.match(/^(\d{2})\/(\d{2})\s+(.+?)\s+([\d.,]+)([CD])$/);
    if (!tm) { i++; continue; }
    const [,day,month,hist,rawVal,cd] = tm;
    const amount = parseFloat(rawVal.replace(/\./g,'').replace(',','.'));
    if (isNaN(amount)||amount===0) { i++; continue; }
    const extras = [];
    i++;
    while (i < lines.length) {
      const next = lines[i];
      if (/^\d{2}\/\d{2}\s/.test(next)) break;
      if (/^DOC\.:/.test(next)) { i++; break; }
      if (/^(RESUMO|\(\+\)|\(-\)|\(=\)|SALDO|ENCARGOS|VENCIMENTO|TAXA|CUSTO|SAC|OUVIDORIA)/i.test(next)) break;
      extras.push(next); i++;
    }
    const extra = extras.filter(l => !/^(Pagamento Pix|Recebimento Pix|\*{3}|\d{2}\.\d{3}|Ola,)/i.test(l)).slice(0,1).join(' ');
    const desc  = extra ? `${hist} - ${extra}` : hist;
    txs.push({ date:`${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`, description:desc.slice(0,80), amount, type:cd==='C'?'income':'expense', category_id:'', skip:skip.some(kw=>hist.toLowerCase().includes(kw)) });
  }
  if (!txs.length) throw new Error('Nenhuma transação encontrada. Verifique se é extrato Sicoob Conta Corrente.');
  return txs;
}

// ── Sicoob Cartão de Crédito PDF ──────────────────────────────────────────
export function parseSicoobCardPDF(text) {
  const lines     = text.split('\n').map(l => l.trim()).filter(Boolean);
  const vencMatch = text.match(/Vencimento:\s*(\d{2})\/(\d{2})\/(\d{4})/i);
  const vencYear  = vencMatch ? parseInt(vencMatch[3]) : new Date().getFullYear();
  const vencMonth = vencMatch ? parseInt(vencMatch[2]) : new Date().getMonth() + 1;

  function getTxYear(txMonth) {
    return txMonth > vencMonth + 1 ? vencYear - 1 : vencYear;
  }

  const skipKeywords = ['saldo anterior','anuidade','desc anuidade','pagamento-boleto','pagamento boleto','limite','encargo','total da fatura','pagamento minimo','rotativo','saque'];
  const txs = [];
  let i = 0, inTx = false;

  while (i < lines.length) {
    const line = lines[i];
    if (/^MOVIMENTOS$/i.test(line) || /^GASTOS DE/i.test(line)) { inTx = true; i++; continue; }
    if (/^TOTAL\s+[\d.,]+/.test(line)) break;
    if (/^(DEMONSTRATIVO|LIMITES|ENCARGOS|RESUMO|PERFIL|CANAIS|O PAGAMENTO)/i.test(line)) break;
    if (!inTx) { i++; continue; }

    // Linha completa: DD/MM DESCRIÇÃO VALOR
    const fullLine = line.match(/^(\d{2})\/(\d{2})\s+(.+?)\s+(-?[\d.]+,[\d]{2})$/);
    if (fullLine) {
      const [,day,month,desc,rawVal] = fullLine;
      const amount = parseFloat(rawVal.replace(/\./g,'').replace(',','.'));
      if (!amount) { i++; continue; }
      const isPayment = amount < 0 || /pagamento|estorno|desc anuidade/i.test(desc);
      txs.push({ date:`${getTxYear(parseInt(month))}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`, description:desc.trim().slice(0,80), amount:Math.abs(amount), type:isPayment?'income':'expense', category_id:'', skip:skipKeywords.some(k=>desc.toLowerCase().includes(k)) });
      i++; continue;
    }

    // Descrição em 2 linhas
    const partial = line.match(/^(\d{2})\/(\d{2})\s+(.+)$/);
    if (partial && i + 1 < lines.length) {
      const next = lines[i+1];
      const cont = next.match(/^(.+?)\s+(-?[\d.]+,[\d]{2})$/);
      if (cont && !/^\d{2}\/\d{2}\s/.test(next)) {
        const [,day,month,partDesc] = partial;
        const [,contDesc,rawVal]    = cont;
        const amount = parseFloat(rawVal.replace(/\./g,'').replace(',','.'));
        if (!isNaN(amount) && amount !== 0) {
          const fullDesc  = `${partDesc} ${contDesc}`.trim();
          const isPayment = amount < 0 || /pagamento|estorno/i.test(fullDesc);
          txs.push({ date:`${getTxYear(parseInt(month))}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`, description:fullDesc.slice(0,80), amount:Math.abs(amount), type:isPayment?'income':'expense', category_id:'', skip:skipKeywords.some(k=>fullDesc.toLowerCase().includes(k)) });
          i += 2; continue;
        }
      }
    }
    i++;
  }
  if (!txs.length) throw new Error('Nenhuma transação encontrada. Confirme que é fatura do cartão Sicoob.');
  return txs;
}

// ── Itaú PDF ──────────────────────────────────────────────────────────────
export function parseItauPDF(text) {
  const lines = text.split('\n');
  const skip  = ['SALDO DO DIA','período de visualização','emitido em','data lançamentos','saldo em conta','Limite da Conta','Total contratado','Os saldos','Aviso','Consultas,'];
  const pat   = /^(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+(-?[\d.]+,\d{2})(?:\s+-?[\d.]+,\d{2})?$/;
  const txs   = [];
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || skip.some(kw=>line.includes(kw))) continue;
    const m = line.match(pat);
    if (!m) continue;
    const [,rawDate,desc,rawAmount] = m;
    const [d,mo,y] = rawDate.split('/');
    const amount = parseFloat(rawAmount.replace(/\./g,'').replace(',','.'));
    if (!amount) continue;
    const skipD = ['REND PAGO','APLICACAO COFRINHOS','DINHEIRO RESERVADO'];
    txs.push({ date:`${y}-${mo}-${d}`, description:desc.trim(), amount:Math.abs(amount), type:amount>0?'income':'expense', category_id:'', skip:skipD.some(kw=>desc.toUpperCase().includes(kw)) });
  }
  if (!txs.length) throw new Error('Nenhuma transação encontrada. Verifique se é extrato Itaú.');
  return txs;
}

// ── Parser genérico (fallback para Inter, C6 e outros) ────────────────────
// Cobre os formatos mais comuns de extratos brasileiros
export function parseGenericBankPDF(text, bankName = 'banco') {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const yearMatch = text.match(/(?:período|extrato|fatura|data).*?(\d{4})/i) || text.match(/(\d{4})/);
  const year      = yearMatch ? yearMatch[1] : String(new Date().getFullYear());

  const skipKeywords = ['saldo','total','limite','encargo','resumo','agencia','agência','titular','período','pagamento minimo','imposto','tarifas'];

  const txs = [];

  for (const line of lines) {
    if (/^(página|page|impresso|gerado|SAC|ouvidoria|central de atendimento)/i.test(line)) continue;

    // Formato A: DD/MM DESCRIÇÃO VALOR C/D
    const mA = line.match(/^(\d{2})\/(\d{2})\s+(.+?)\s+([\d.]+,\d{2})\s*([CcDd])$/);
    if (mA) {
      const [,day,month,desc,rawVal,cd] = mA;
      const amount = parseFloat(rawVal.replace(/\./g,'').replace(',','.'));
      if (!amount) continue;
      if (skipKeywords.some(k => desc.toLowerCase().includes(k))) continue;
      txs.push({ date:`${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`, description:desc.trim().slice(0,80), amount, type:/[Cc]/.test(cd)?'income':'expense', category_id:'', skip:false });
      continue;
    }

    // Formato B: DD/MM DESCRIÇÃO VALOR (sem C/D)
    const mB = line.match(/^(\d{2})\/(\d{2})\s+(.+?)\s+(-?[\d.]+,\d{2})$/);
    if (mB) {
      const [,day,month,desc,rawVal] = mB;
      const amount = parseFloat(rawVal.replace(/\./g,'').replace(',','.'));
      if (!amount) continue;
      const descL = desc.toLowerCase();
      if (skipKeywords.some(k => descL.includes(k))) continue;
      const isIncome = amount < 0 || /pix receb|ted receb|transferencia receb|deposito|salario|credito/i.test(descL);
      txs.push({ date:`${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`, description:desc.trim().slice(0,80), amount:Math.abs(amount), type:isIncome?'income':'expense', category_id:'', skip:false });
      continue;
    }

    // Formato C: DD/MM/YYYY DESCRIÇÃO VALOR
    const mC = line.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(.+?)\s+(-?[\d.]+,\d{2})$/);
    if (mC) {
      const [,day,month,yr,desc,rawVal] = mC;
      const amount = parseFloat(rawVal.replace(/\./g,'').replace(',','.'));
      if (!amount) continue;
      const descL = desc.toLowerCase();
      if (skipKeywords.some(k => descL.includes(k))) continue;
      const isIncome = amount < 0 || /pix receb|ted receb|deposito|salario/i.test(descL);
      txs.push({ date:`${yr}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`, description:desc.trim().slice(0,80), amount:Math.abs(amount), type:isIncome?'income':'expense', category_id:'', skip:false });
    }
  }

  if (!txs.length) throw new Error(`Nenhuma transação encontrada no extrato de ${bankName}. Compartilhe o PDF com o suporte para ajustarmos o parser.`);
  return txs;
}

// ── Mapa de bancos disponíveis ────────────────────────────────────────────
export const BANKS = [
  { id:'auto',        label:'Detectar automaticamente', icon:'🔍', format:'PDF', accept:'.pdf,application/pdf', badge:'Novo',
    steps:['Selecione o PDF do seu extrato','O sistema detecta o banco automaticamente','Revise as transações antes de importar'] },
  { id:'nubank-csv',  label:'Nubank',       icon:'🟣', format:'CSV', accept:'.csv,text/csv',
    steps:['Abra o app Nubank','Vá em Transações (ícone de lista)','Toque nos 3 pontos → Exportar','Selecione o período e baixe o CSV'] },
  { id:'mp-csv',      label:'Mercado Pago', icon:'💳', format:'CSV', accept:'.csv,text/csv',
    steps:['Abra o app do Mercado Pago','Vá em Atividade → Extrato','Toque em "Exportar" → CSV','Selecione o período e baixe'] },
  { id:'mp-pdf',      label:'Mercado Pago', icon:'💳', format:'PDF', accept:'.pdf,application/pdf',
    steps:['Acesse mercadopago.com.br','Vá em Conta → Extrato de conta','Clique em "Baixar PDF"'] },
  { id:'sicoob',      label:'Sicoob',       icon:'🟢', format:'PDF', accept:'.pdf,application/pdf',
    steps:['Acesse o internet banking do Sicoob','Vá em Extrato → Conta Corrente','Selecione o período e clique em "Emitir"'] },
  { id:'sicoob-card', label:'Sicoob Cartão',icon:'💳', format:'PDF', accept:'.pdf,application/pdf',
    steps:['Acesse o internet banking do Sicoob','Vá em Cartões → Fatura do Cartão','Selecione o mês e salve o PDF'] },
  { id:'itau',        label:'Itaú',         icon:'🏦', format:'PDF', accept:'.pdf,application/pdf',
    steps:['Acesse o app ou internet banking Itaú','Vá em Conta corrente → Extrato','Selecione o período → Exportar → PDF'] },
  { id:'inter',       label:'Inter',        icon:'🟠', format:'PDF', accept:'.pdf,application/pdf', badge:'Beta',
    steps:['Abra o app do Inter','Vá em Extrato → Compartilhar','Selecione o período e salve o PDF'] },
  { id:'c6',          label:'C6 Bank',      icon:'⬛', format:'PDF', accept:'.pdf,application/pdf', badge:'Beta',
    steps:['Abra o app do C6 Bank','Vá em Extrato → Compartilhar extrato','Selecione o período e salve o PDF'] },
  { id:'pluxee',      label:'Pluxee',       icon:'🎫', format:'PDF', accept:'.pdf,application/pdf',
    steps:['Acesse o app ou site da Pluxee','Vá em Extrato → Multibenefícios','Exporte em PDF'] },
];

// ── Dispatcher — chama o parser correto ───────────────────────────────────
export async function parseFile(bankType, file) {
  const text = bankType.endsWith('-csv') || bankType === 'nubank-csv'
    ? await file.text()
    : await extractPDFText(file);

  if (bankType === 'auto') {
    const detected = detectBank(text);
    if (!detected) return parseGenericBankPDF(text, 'banco detectado');
    return parseFile(detected, file);  // re-chama com o banco detectado
  }

  switch (bankType) {
    case 'nubank-csv':   return parseNubankCSV(text);
    case 'mp-csv':       return parseMercadoPagoCSV(text);
    case 'mp-pdf':       return parseMercadoPagoPDF(text);
    case 'pluxee':       return parsePluxeePDF(text);
    case 'sicoob':       return parseSicoobPDF(text);
    case 'sicoob-card':  return parseSicoobCardPDF(text);
    case 'itau':         return parseItauPDF(text);
    case 'inter':        return parseGenericBankPDF(text, 'Inter');
    case 'c6':           return parseGenericBankPDF(text, 'C6 Bank');
    case 'nubank-pdf':   return parseGenericBankPDF(text, 'Nubank');
    default:             return parseGenericBankPDF(text, bankType);
  }
}
