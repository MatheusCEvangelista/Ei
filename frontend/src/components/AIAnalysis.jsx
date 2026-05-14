import { useState } from 'react';
import api from '../lib/api';

export default function AIAnalysis({ transactions, summary, month, year }) {
  const [analysis, setAnalysis] = useState('');
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  async function analyze() {
    setLoading(true);
    setOpen(true);
    setAnalysis('');

    const fmt = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
    const byCategory = {};
    transactions.forEach(tx => {
      if (tx.type !== 'expense') return;
      const cat = tx.categories?.name || 'Sem categoria';
      byCategory[cat] = (byCategory[cat] || 0) + Number(tx.amount);
    });
    const catSummary = Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, val]) => `  - ${cat}: ${fmt(val)}`)
      .join('\n');

    const prompt = `Você é um assistente financeiro pessoal. Analise os dados do mês de ${MONTHS[month - 1]} de ${year}:

Receitas: ${fmt(summary.income)}
Despesas: ${fmt(summary.expense)}
Saldo:    ${fmt(summary.balance)}

Despesas por categoria:
${catSummary || '  (sem dados)'}

Total de transações: ${transactions.length}

Forneça uma análise em português com:
1. Um resumo do mês em 2-3 frases
2. Os 2-3 maiores gastos e se são preocupantes
3. Uma observação positiva (se houver)
4. 2-3 sugestões práticas e específicas para o próximo mês

Seja direto, use linguagem simples e seja construtivo. Não use markdown com asteriscos, use apenas texto limpo com números (1. 2. 3.) para listas.`;

    try {
      const { data } = await api.post('/api/ai', { prompt });
      setAnalysis(data.text || 'Não foi possível gerar a análise.');
    } catch (err) {
      setAnalysis(err.response?.data?.error || 'Erro ao gerar análise. Verifique se a GEMINI_API_KEY está configurada no backend.');
    } finally { setLoading(false); }
  }

  return (
    <>
      <button onClick={analyze} disabled={loading} style={{
        padding: '8px 14px', borderRadius: 10,
        border: '1px solid rgba(124,127,247,0.3)',
        background: 'var(--indigo-dim)',
        color: 'var(--indigo)', fontFamily: 'var(--font)', fontSize: 13, fontWeight: 500, cursor: 'pointer',
      }}>
        {loading ? '⏳' : '🤖'} <span className="hidden sm:inline">{loading ? 'Analisando...' : 'Analisar mês'}</span>
      </button>

      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 50 }} onClick={() => !loading && setOpen(false)}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border-md)', borderRadius: '18px 18px 0 0', width: '100%', maxWidth: 520, padding: '8px 24px 36px', boxShadow: 'var(--shadow)', maxHeight: '85vh', overflowY: 'auto' }} className="fade-up" onClick={e => e.stopPropagation()}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--bg3)', margin: '10px auto 20px' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--indigo-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🤖</div>
                <div>
                  <h2 style={{ fontSize: 15, fontWeight: 600 }}>Análise do mês</h2>
                  <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>{MONTHS[month - 1]} {year} · Gemini AI</p>
                </div>
              </div>
              {!loading && <button onClick={() => setOpen(false)} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text2)', cursor: 'pointer', fontSize: 16 }}>×</button>}
            </div>

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 18, width: i === 4 ? '60%' : '100%' }} />)}
                <p style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', marginTop: 8 }}>Analisando suas finanças...</p>
              </div>
            ) : (
              <div style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{analysis}</div>
            )}

            {!loading && analysis && (
              <button onClick={analyze} style={{ marginTop: 20, fontSize: 12, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)' }}>↺ Gerar nova análise</button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
