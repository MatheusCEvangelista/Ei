import { useState, useRef } from 'react';
import api from '../lib/api';

// ─── Parser CSV Mercado Pago ───────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const headerIdx = lines.findIndex(l => l.startsWith('RELEASE_DATE'));
  if (headerIdx === -1) throw new Error('Formato inválido. Use o CSV padrão do Mercado Pago.');
  const transactions = [];
  for (const line of lines.slice(headerIdx + 1)) {
    const cols = line.split(';');
    if (cols.length < 4) continue;
    const [rawDate, rawDesc, , rawAmount] = cols;
    const [d, m, y] = rawDate.trim().split('-');
    if (!d || !m || !y) continue;
    const date = `${y}-${m}-${d}`;
    const amount = parseFloat(rawAmount.trim().replace(/\./g, '').replace(',', '.'));
    if (isNaN(amount) || amount === 0) continue;
    const description = rawDesc.trim();
    transactions.push({
      date, description,
      amount: Math.abs(amount),
      type: amount > 0 ? 'income' : 'expense',
      category_id: '',
      skip: description.toLowerCase().startsWith('rendimento'),
    });
  }
  if (!transactions.length) throw new Error('Nenhuma transação encontrada no arquivo.');
  return transactions;
}

// ─── Parser PDF Itaú (via pdfjs-dist) ─────────────────────────────────────
async function parsePDF(file) {
  // Carrega pdfjs dinamicamente do CDN
  const pdfjsLib = await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.min.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.worker.min.mjs';

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    // Agrupa itens por linha (mesmo Y aproximado)
    const items = content.items;
    const lineMap = {};
    for (const item of items) {
      const y = Math.round(item.transform[5]);
      if (!lineMap[y]) lineMap[y] = [];
      lineMap[y].push(item.str);
    }
    const sortedYs = Object.keys(lineMap).map(Number).sort((a, b) => b - a);
    for (const y of sortedYs) {
      fullText += lineMap[y].join(' ') + '\n';
    }
  }

  return parseItauText(fullText);
}

function parseItauText(text) {
  const lines = text.split('\n');
  const transactions = [];
  const skipKeywords = ['SALDO DO DIA', 'período de visualização', 'emitido em',
    'data lançamentos', 'saldo em conta', 'Limite da Conta',
    'Total contratado', 'Os saldos', 'Aviso', 'Consultas,'];

  // DD/MM/AAAA + descrição + valor (± com pontos e vírgula)
  const pattern = /^(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+(-?[\d.]+,\d{2})(?:\s+-?[\d.]+,\d{2})?$/;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || skipKeywords.some(kw => line.includes(kw))) continue;

    const m = line.match(pattern);
    if (!m) continue;

    const [, rawDate, desc, rawAmount] = m;
    const [d, mo, y] = rawDate.split('/');
    const date = `${y}-${mo}-${d}`;
    const amount = parseFloat(rawAmount.replace(/\./g, '').replace(',', '.'));
    if (!amount) continue;

    const skipDesc = ['REND PAGO', 'APLICACAO COFRINHOS', 'DINHEIRO RESERVADO'];
    const skip = skipDesc.some(kw => desc.toUpperCase().includes(kw));

    transactions.push({
      date,
      description: desc.trim(),
      amount: Math.abs(amount),
      type: amount > 0 ? 'income' : 'expense',
      category_id: '',
      skip,
    });
  }

  if (!transactions.length) throw new Error('Nenhuma transação encontrada. Verifique se é um extrato Itaú válido.');
  return transactions;
}

// ─── Estilos reutilizáveis ────────────────────────────────────────────────
const labelStyle = {
  display: 'block', fontSize: 12, color: 'var(--text2)',
  fontWeight: 500, marginBottom: 6, letterSpacing: '0.02em',
};

// ─── Componente principal ─────────────────────────────────────────────────
export default function ImportModal({ onClose, onSave }) {
  const [step, setStep] = useState('upload');
  const [bankType, setBankType] = useState(null); // 'mp' | 'itau'
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loadingFile, setLoadingFile] = useState(false);
  const fileRef = useRef();

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setError('');
    setLoadingFile(true);
    try {
      let parsed;
      if (bankType === 'mp') {
        const text = await file.text();
        parsed = parseCSV(text);
      } else {
        parsed = await parsePDF(file);
      }
      const { data: cats } = await api.get('/api/categories');
      setCategories(cats);
      setTransactions(parsed);
      setStep('preview');
    } catch (err) {
      setError(err.message || 'Erro ao processar o arquivo.');
    } finally {
      setLoadingFile(false);
    }
  }

  function updateTx(i, field, value) {
    setTransactions(prev => prev.map((tx, idx) => idx === i ? { ...tx, [field]: value } : tx));
  }

  async function handleImport() {
    const toImport = transactions.filter(tx => !tx.skip);
    if (!toImport.length) { setError('Nenhuma transação selecionada.'); return; }
    setImporting(true);
    setProgress(0);
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
      setProgress(Math.round((count / toImport.length) * 100));
    }
    setImporting(false);
    onSave();
  }

  const toImport = transactions.filter(tx => !tx.skip);
  const fmt = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  const fmtDate = d => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');

  const banks = [
    { id: 'mp',   label: 'Mercado Pago', icon: '💳', format: 'CSV', accept: '.csv,text/csv',
      steps: ['Abra o app do Mercado Pago', 'Vá em Atividade → Extrato', 'Toque em "Exportar" → CSV', 'Selecione o período e baixe'] },
    { id: 'itau', label: 'Itaú',         icon: '🏦', format: 'PDF', accept: '.pdf,application/pdf',
      steps: ['Acesse o app ou internet banking Itaú', 'Vá em Conta corrente → Extrato', 'Selecione o período desejado', 'Clique em "Exportar" → PDF'] },
  ];

  const selectedBank = banks.find(b => b.id === bankType);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: step === 'preview' ? 'flex-start' : 'center',
      justifyContent: 'center', zIndex: 50, padding: 16, overflowY: 'auto',
    }} onClick={onClose}>
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border-md)',
        borderRadius: 18, width: '100%',
        maxWidth: step === 'preview' ? 700 : 480,
        padding: '8px 24px 32px', boxShadow: 'var(--shadow)',
        marginTop: step === 'preview' ? 0 : 'auto',
        marginBottom: step === 'preview' ? 0 : 'auto',
      }} className="fade-up" onClick={e => e.stopPropagation()}>

        {/* Handle */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--bg3)', margin: '10px auto 20px' }} />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.02em' }}>
              {step === 'upload' ? 'Importar extrato bancário' : `Revisar — ${toImport.length} de ${transactions.length} transações`}
            </h2>
            {step === 'preview' && (
              <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>
                Desmarque o que não quer importar, ajuste categorias e confirme.
              </p>
            )}
          </div>
          <button onClick={onClose} style={{
            width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)',
            background: 'var(--bg3)', color: 'var(--text2)', cursor: 'pointer', fontSize: 16, flexShrink: 0,
          }}>×</button>
        </div>

        {/* ── STEP: UPLOAD ── */}
        {step === 'upload' && (
          <div>
            {/* Seleção de banco */}
            <p style={labelStyle}>SELECIONE SEU BANCO</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 22 }}>
              {banks.map(b => (
                <button key={b.id} onClick={() => setBankType(b.id)} style={{
                  padding: '14px 12px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                  fontFamily: 'var(--font)', transition: 'all 0.15s',
                  border: `1.5px solid ${bankType === b.id ? 'var(--indigo)' : 'var(--border)'}`,
                  background: bankType === b.id ? 'var(--indigo-dim)' : 'var(--bg3)',
                }}>
                  <div style={{ fontSize: 22, marginBottom: 6 }}>{b.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{b.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Formato: {b.format}</div>
                </button>
              ))}
            </div>

            {/* Instruções + drop zone */}
            {selectedBank && (
              <>
                <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 10, color: 'var(--text)' }}>
                    Como exportar no {selectedBank.label}:
                  </p>
                  {selectedBank.steps.map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                      <div style={{ width: 20, height: 20, borderRadius: 6, background: 'var(--indigo-dim)', color: 'var(--indigo)', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</div>
                      <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>{s}</p>
                    </div>
                  ))}
                </div>

                <div
                  onClick={() => !loadingFile && fileRef.current.click()}
                  style={{
                    border: '2px dashed var(--border-md)', borderRadius: 14,
                    padding: '28px 20px', textAlign: 'center',
                    cursor: loadingFile ? 'wait' : 'pointer', transition: 'all 0.2s',
                  }}
                  onMouseOver={e => { if (!loadingFile) { e.currentTarget.style.borderColor = 'var(--indigo)'; e.currentTarget.style.background = 'var(--indigo-dim)'; }}}
                  onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border-md)'; e.currentTarget.style.background = 'transparent'; }}
                >
                  {loadingFile ? (
                    <>
                      <div style={{ fontSize: 26, marginBottom: 8 }}>⏳</div>
                      <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>Lendo o arquivo...</p>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 26, marginBottom: 8 }}>{selectedBank.format === 'PDF' ? '📄' : '📂'}</div>
                      <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>
                        Clique para selecionar o arquivo {selectedBank.format}
                      </p>
                      <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                        Extrato {selectedBank.label} em {selectedBank.format}
                      </p>
                    </>
                  )}
                  <input ref={fileRef} type="file" accept={selectedBank.accept} onChange={handleFile} style={{ display: 'none' }} />
                </div>
              </>
            )}

            {error && (
              <p style={{ fontSize: 13, color: 'var(--red)', background: 'var(--red-dim)', borderRadius: 8, padding: '10px 12px', marginTop: 14 }}>{error}</p>
            )}
          </div>
        )}

        {/* ── STEP: PREVIEW ── */}
        {step === 'preview' && (
          <div>
            {/* Resumo */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 18 }}>
              {[
                { label: 'Receitas',  value: fmt(toImport.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)),  color: 'var(--green)' },
                { label: 'Despesas',  value: fmt(toImport.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)), color: 'var(--red)' },
                { label: 'Ignoradas', value: transactions.filter(t => t.skip).length, color: 'var(--text3)' },
              ].map(c => (
                <div key={c.label} style={{ background: 'var(--bg3)', borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
                  <p style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{c.label}</p>
                  <p style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 600, color: c.color }}>{c.value}</p>
                </div>
              ))}
            </div>

            {/* Tabela */}
            <div style={{ maxHeight: 360, overflowY: 'auto', borderRadius: 10, border: '1px solid var(--border)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '32px 80px 1fr 100px 90px 32px', gap: 8, padding: '8px 12px', background: 'var(--bg3)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0 }}>
                {['', 'Data', 'Descrição', 'Categoria', 'Valor', ''].map((h, i) => (
                  <span key={i} style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
                ))}
              </div>

              {transactions.map((tx, i) => (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: '32px 80px 1fr 100px 90px 32px',
                  gap: 8, padding: '8px 12px', alignItems: 'center',
                  borderBottom: '1px solid var(--border)',
                  opacity: tx.skip ? 0.35 : 1,
                  background: tx.skip ? 'transparent' : 'var(--bg2)',
                  transition: 'opacity 0.2s',
                }}>
                  <input type="checkbox" checked={!tx.skip}
                    onChange={() => updateTx(i, 'skip', !tx.skip)}
                    style={{ width: 16, height: 16, accentColor: 'var(--indigo)', cursor: 'pointer' }} />
                  <span style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{fmtDate(tx.date)}</span>
                  <input value={tx.description} disabled={tx.skip}
                    onChange={e => updateTx(i, 'description', e.target.value)}
                    style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)', width: '100%' }} />
                  <select value={tx.category_id} disabled={tx.skip}
                    onChange={e => updateTx(i, 'category_id', e.target.value)}
                    style={{ fontSize: 12, padding: '4px 6px', borderRadius: 6, background: 'var(--bg3)', border: '1px solid var(--border)', color: tx.category_id ? 'var(--text)' : 'var(--text3)', width: '100%' }}>
                    <option value="">Sem cat.</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 500, color: tx.type === 'income' ? 'var(--green)' : 'var(--red)' }}>
                      {tx.type === 'income' ? '+' : '-'}{fmt(tx.amount)}
                    </span>
                  </div>
                  <button onClick={() => updateTx(i, 'type', tx.type === 'income' ? 'expense' : 'income')}
                    disabled={tx.skip} title="Inverter tipo"
                    style={{ width: 24, height: 24, borderRadius: 6, border: 'none', cursor: 'pointer', background: tx.type === 'income' ? 'var(--green-dim)' : 'var(--red-dim)', color: tx.type === 'income' ? 'var(--green)' : 'var(--red)', fontSize: 12, fontWeight: 700 }}>
                    {tx.type === 'income' ? '↑' : '↓'}
                  </button>
                </div>
              ))}
            </div>

            {error && (
              <p style={{ fontSize: 13, color: 'var(--red)', background: 'var(--red-dim)', borderRadius: 8, padding: '10px 12px', marginTop: 12 }}>{error}</p>
            )}

            {importing && (
              <div style={{ marginTop: 14 }}>
                <div style={{ background: 'var(--bg3)', borderRadius: 99, height: 6, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, var(--indigo), #a78bfa)', borderRadius: 99, transition: 'width 0.2s' }} />
                </div>
                <p style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', marginTop: 8 }}>Importando... {progress}%</p>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={() => setStep('upload')} style={{
                flex: 1, padding: '13px 0', borderRadius: 10, fontSize: 14, fontWeight: 500,
                border: '1px solid var(--border)', background: 'transparent',
                color: 'var(--text2)', cursor: 'pointer', fontFamily: 'var(--font)',
              }}>← Voltar</button>
              <button onClick={handleImport} disabled={importing || !toImport.length} style={{
                flex: 2, padding: '13px 0', borderRadius: 10, fontSize: 14, fontWeight: 600,
                border: 'none', cursor: 'pointer', fontFamily: 'var(--font)',
                background: importing ? 'var(--bg3)' : 'linear-gradient(135deg, var(--indigo), #a78bfa)',
                color: importing ? 'var(--text3)' : '#fff',
              }}>
                {importing ? `Importando... ${progress}%` : `Importar ${toImport.length} transações`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
