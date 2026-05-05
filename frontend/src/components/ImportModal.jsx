import { useState, useRef } from 'react';
import api from '../lib/api';

function parseCSV(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Acha a linha de cabeçalho real (RELEASE_DATE...)
  const headerIdx = lines.findIndex(l => l.startsWith('RELEASE_DATE'));
  if (headerIdx === -1) throw new Error('Formato inválido. Exporte o CSV no formato padrão do Mercado Pago.');

  const dataLines = lines.slice(headerIdx + 1);
  const transactions = [];

  for (const line of dataLines) {
    const cols = line.split(';');
    if (cols.length < 4) continue;

    const [rawDate, rawDesc, , rawAmount] = cols;

    // Converte DD-MM-AAAA → AAAA-MM-DD
    const [d, m, y] = rawDate.trim().split('-');
    if (!d || !m || !y) continue;
    const date = `${y}-${m}-${d}`;

    // Valor: troca ponto de milhar e vírgula decimal
    const amount = parseFloat(rawAmount.trim().replace(/\./g, '').replace(',', '.'));
    if (isNaN(amount) || amount === 0) continue;

    const description = rawDesc.trim();
    const type = amount > 0 ? 'income' : 'expense';

    // Ignora rendimentos por padrão (pode ser alterado pelo usuário)
    const isRendimento = description.toLowerCase().startsWith('rendimento');

    transactions.push({
      date,
      description,
      amount: Math.abs(amount),
      type,
      category_id: '',
      skip: isRendimento, // pré-marca rendimentos para ignorar
    });
  }

  if (!transactions.length) throw new Error('Nenhuma transação encontrada no arquivo.');
  return transactions;
}

const labelStyle = {
  display: 'block', fontSize: 12, color: 'var(--text2)',
  fontWeight: 500, marginBottom: 6, letterSpacing: '0.02em',
};

export default function ImportModal({ onClose, onSave }) {
  const [step, setStep] = useState('upload'); // upload | preview | importing
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileRef = useRef();

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setError('');
    try {
      const text = await file.text();
      const parsed = parseCSV(text);
      const { data: cats } = await api.get('/api/categories');
      setCategories(cats);
      setTransactions(parsed);
      setStep('preview');
    } catch (err) {
      setError(err.message);
    }
  }

  function updateTx(i, field, value) {
    setTransactions(prev => prev.map((tx, idx) => idx === i ? { ...tx, [field]: value } : tx));
  }

  function toggleSkip(i) {
    setTransactions(prev => prev.map((tx, idx) => idx === i ? { ...tx, skip: !tx.skip } : tx));
  }

  async function handleImport() {
    const toImport = transactions.filter(tx => !tx.skip);
    if (!toImport.length) { setError('Nenhuma transação selecionada para importar.'); return; }
    setImporting(true);
    setProgress(0);
    let count = 0;
    for (const tx of toImport) {
      try {
        await api.post('/api/transactions', {
          date: tx.date,
          description: tx.description,
          amount: tx.amount,
          type: tx.type,
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

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: step === 'preview' ? 'flex-start' : 'center',
      justifyContent: 'center', zIndex: 50, padding: step === 'preview' ? '16px' : '16px',
      overflowY: 'auto',
    }} onClick={onClose}>
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border-md)',
        borderRadius: 18, width: '100%',
        maxWidth: step === 'preview' ? 700 : 440,
        padding: '8px 24px 32px',
        boxShadow: 'var(--shadow)',
        marginTop: step === 'preview' ? 0 : 'auto',
        marginBottom: step === 'preview' ? 0 : 'auto',
      }} className="fade-up" onClick={e => e.stopPropagation()}>

        {/* Handle */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--bg3)', margin: '10px auto 20px' }} />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.02em' }}>
              {step === 'upload' ? 'Importar CSV do Mercado Pago' : `Revisar importação — ${toImport.length} de ${transactions.length} transações`}
            </h2>
            {step === 'preview' && (
              <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>
                Desmarque as que não quer importar, ajuste categorias e confirme.
              </p>
            )}
          </div>
          <button onClick={onClose} style={{
            width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)',
            background: 'var(--bg3)', color: 'var(--text2)', cursor: 'pointer', fontSize: 16, flexShrink: 0,
          }}>×</button>
        </div>

        {/* STEP: UPLOAD */}
        {step === 'upload' && (
          <div>
            {/* Instruções */}
            <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', marginBottom: 20 }}>
              <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 10, color: 'var(--text)' }}>Como exportar no Mercado Pago:</p>
              {['Abra o app ou site do Mercado Pago', 'Vá em Atividade → Extrato', 'Toque em "Baixar" ou "Exportar"', 'Escolha o período e selecione CSV', 'Salve e envie o arquivo aqui'].map((step, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 20, height: 20, borderRadius: 6, background: 'var(--indigo-dim)', color: 'var(--indigo)', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</div>
                  <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>{step}</p>
                </div>
              ))}
            </div>

            {/* Drop zone */}
            <div
              onClick={() => fileRef.current.click()}
              style={{
                border: '2px dashed var(--border-md)', borderRadius: 14,
                padding: '32px 20px', textAlign: 'center', cursor: 'pointer',
                transition: 'border-color 0.2s, background 0.2s',
              }}
              onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--indigo)'; e.currentTarget.style.background = 'var(--indigo-dim)'; }}
              onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border-md)'; e.currentTarget.style.background = 'transparent'; }}
            >
              <div style={{ fontSize: 28, marginBottom: 10 }}>📂</div>
              <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>Clique para selecionar o arquivo CSV</p>
              <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>Somente arquivos .csv do Mercado Pago</p>
              <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFile} style={{ display: 'none' }} />
            </div>

            {error && (
              <p style={{ fontSize: 13, color: 'var(--red)', background: 'var(--red-dim)', borderRadius: 8, padding: '10px 12px', marginTop: 14 }}>{error}</p>
            )}
          </div>
        )}

        {/* STEP: PREVIEW */}
        {step === 'preview' && (
          <div>
            {/* Resumo */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 18 }}>
              {[
                { label: 'Receitas', value: fmt(toImport.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)), color: 'var(--green)' },
                { label: 'Despesas', value: fmt(toImport.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)), color: 'var(--red)' },
                { label: 'Ignoradas', value: transactions.filter(t => t.skip).length, color: 'var(--text3)' },
              ].map(c => (
                <div key={c.label} style={{ background: 'var(--bg3)', borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
                  <p style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{c.label}</p>
                  <p style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 600, color: c.color }}>{c.value}</p>
                </div>
              ))}
            </div>

            {/* Tabela */}
            <div style={{ maxHeight: 380, overflowY: 'auto', borderRadius: 10, border: '1px solid var(--border)' }}>
              {/* Cabeçalho */}
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
                  {/* Checkbox */}
                  <input type="checkbox" checked={!tx.skip} onChange={() => toggleSkip(i)}
                    style={{ width: 16, height: 16, accentColor: 'var(--indigo)', cursor: 'pointer' }} />

                  {/* Data */}
                  <span style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{fmtDate(tx.date)}</span>

                  {/* Descrição editável */}
                  <input
                    value={tx.description}
                    onChange={e => updateTx(i, 'description', e.target.value)}
                    disabled={tx.skip}
                    style={{
                      fontSize: 12, padding: '4px 8px', borderRadius: 6,
                      background: 'var(--bg3)', border: '1px solid var(--border)',
                      color: 'var(--text)', width: '100%',
                    }}
                  />

                  {/* Categoria */}
                  <select
                    value={tx.category_id}
                    onChange={e => updateTx(i, 'category_id', e.target.value)}
                    disabled={tx.skip}
                    style={{
                      fontSize: 12, padding: '4px 6px', borderRadius: 6,
                      background: 'var(--bg3)', border: '1px solid var(--border)',
                      color: tx.category_id ? 'var(--text)' : 'var(--text3)', width: '100%',
                    }}
                  >
                    <option value="">Sem cat.</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>

                  {/* Valor + tipo */}
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 500, color: tx.type === 'income' ? 'var(--green)' : 'var(--red)' }}>
                      {tx.type === 'income' ? '+' : '-'}{fmt(tx.amount)}
                    </span>
                  </div>

                  {/* Toggle tipo */}
                  <button
                    onClick={() => updateTx(i, 'type', tx.type === 'income' ? 'expense' : 'income')}
                    disabled={tx.skip}
                    title="Inverter tipo"
                    style={{
                      width: 24, height: 24, borderRadius: 6, border: 'none', cursor: 'pointer',
                      background: tx.type === 'income' ? 'var(--green-dim)' : 'var(--red-dim)',
                      color: tx.type === 'income' ? 'var(--green)' : 'var(--red)',
                      fontSize: 12, fontWeight: 700,
                    }}>
                    {tx.type === 'income' ? '↑' : '↓'}
                  </button>
                </div>
              ))}
            </div>

            {error && (
              <p style={{ fontSize: 13, color: 'var(--red)', background: 'var(--red-dim)', borderRadius: 8, padding: '10px 12px', marginTop: 12 }}>{error}</p>
            )}

            {/* Progress */}
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
