import { useState, useEffect } from 'react';
import api from '../lib/api';

const TYPES = [
  { value: 'stocks',       label: 'Ações',      icon: '📈' },
  { value: 'fiis',         label: 'FIIs',        icon: '🏢' },
  { value: 'crypto',       label: 'Cripto',      icon: '₿'  },
  { value: 'fixed_income', label: 'Renda Fixa',  icon: '🏦' },
  { value: 'treasury',     label: 'Tesouro',     icon: '🏛'  },
];

const inputStyle = { width: '100%', padding: '11px 14px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' };
const labelStyle = { display: 'block', fontSize: 12, color: 'var(--text2)', fontWeight: 500, marginBottom: 6, letterSpacing: '0.02em' };

export default function InvestmentModal({ investment, onClose, onSave }) {
  const [form, setForm] = useState({ name: '', ticker: '', type: 'stocks' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (investment) setForm({ name: investment.name, ticker: investment.ticker || '', type: investment.type });
  }, [investment]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (investment) await api.put(`/api/investments/${investment.id}`, form);
      else await api.post('/api/investments', form);
      onSave();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar');
    } finally { setLoading(false); }
  }

  const needsTicker = ['stocks', 'fiis', 'crypto'].includes(form.type);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 50 }} onClick={onClose}>
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border-md)', borderRadius: '18px 18px 0 0', width: '100%', maxWidth: 480, padding: '8px 24px 32px', boxShadow: 'var(--shadow)' }} className="fade-up" onClick={e => e.stopPropagation()}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--bg3)', margin: '10px auto 20px' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>{investment ? 'Editar investimento' : 'Novo investimento'}</h2>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text2)', cursor: 'pointer', fontSize: 16 }}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Tipo */}
            <div>
              <label style={labelStyle}>TIPO</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8 }}>
                {TYPES.map(t => (
                  <button key={t.value} type="button" onClick={() => setForm({ ...form, type: t.value })} style={{
                    padding: '10px 4px', borderRadius: 10, cursor: 'pointer', textAlign: 'center',
                    border: `1.5px solid ${form.type === t.value ? 'var(--indigo)' : 'var(--border)'}`,
                    background: form.type === t.value ? 'var(--indigo-dim)' : 'var(--bg3)',
                    fontFamily: 'var(--font)', transition: 'all 0.15s',
                  }}>
                    <div style={{ fontSize: 18, marginBottom: 4 }}>{t.icon}</div>
                    <div style={{ fontSize: 10, color: form.type === t.value ? 'var(--indigo)' : 'var(--text3)' }}>{t.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Nome */}
            <div>
              <label style={labelStyle}>NOME</label>
              <input type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Petrobras, Bitcoin, CDB Nubank..." style={inputStyle} />
            </div>

            {/* Ticker */}
            {needsTicker && (
              <div>
                <label style={labelStyle}>TICKER {form.type === 'crypto' ? '(BTC, ETH, BNB...)' : '(PETR4, MXRF11...)'}</label>
                <input type="text" value={form.ticker} onChange={e => setForm({ ...form, ticker: e.target.value.toUpperCase() })}
                  placeholder={form.type === 'crypto' ? 'BTC' : 'PETR4'}
                  style={{ ...inputStyle, fontFamily: 'var(--mono)', textTransform: 'uppercase' }} />
                <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                  {form.type === 'crypto' ? 'Usado para buscar cotação via CoinGecko' : 'Usado para buscar cotação via brapi.dev'}
                </p>
              </div>
            )}

            {error && <p style={{ fontSize: 13, color: 'var(--red)', background: 'var(--red-dim)', borderRadius: 8, padding: '10px 12px' }}>{error}</p>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={onClose} style={{ flex: 1, padding: '13px 0', borderRadius: 10, fontSize: 14, fontWeight: 500, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', cursor: 'pointer', fontFamily: 'var(--font)' }}>Cancelar</button>
              <button type="submit" disabled={loading} style={{ flex: 2, padding: '13px 0', borderRadius: 10, fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'var(--font)', background: loading ? 'var(--bg3)' : 'linear-gradient(135deg, var(--indigo), #a78bfa)', color: loading ? 'var(--text3)' : '#fff' }}>
                {loading ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
