import { useState, useEffect } from 'react';
import api from '../lib/api';

const inputStyle = {
  width: '100%', padding: '12px 14px',
  background: 'var(--bg3)', border: '1px solid var(--border)',
  borderRadius: 8, color: 'var(--text)',
};
const labelStyle = {
  display: 'block', fontSize: 12, color: 'var(--text2)',
  fontWeight: 500, marginBottom: 6, letterSpacing: '0.02em',
};

export default function TransactionModal({ transaction, onClose, onSave }) {
  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({ type: 'expense', amount: '', description: '', category_id: '', date: today });
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/api/categories').then(r => setCategories(r.data));
    if (transaction) setForm({
      type: transaction.type, amount: transaction.amount,
      description: transaction.description || '', category_id: transaction.category_id || '', date: transaction.date,
    });
  }, [transaction]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      if (transaction) await api.put(`/api/transactions/${transaction.id}`, form);
      else await api.post('/api/transactions', form);
      onSave();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar');
    } finally { setLoading(false); }
  }

  const isIncome = form.type === 'income';

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      zIndex: 50, padding: 0,
    }} onClick={onClose}>
      {/* Sheet no mobile (bottom), modal no desktop (center) */}
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border-md)',
        borderRadius: '18px 18px 0 0', width: '100%', maxWidth: 480,
        padding: '8px 24px 32px', boxShadow: 'var(--shadow)',
      }} className="fade-up sm:rounded-[18px] sm:mb-8" onClick={e => e.stopPropagation()}>

        {/* Handle mobile */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--bg3)', margin: '10px auto 20px' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.02em' }}>
            {transaction ? 'Editar transação' : 'Nova transação'}
          </h2>
          <button onClick={onClose} style={{
            width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)',
            background: 'var(--bg3)', color: 'var(--text2)', cursor: 'pointer', fontSize: 16,
          }}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Tipo */}
            <div style={{ display: 'flex', background: 'var(--bg3)', borderRadius: 10, padding: 3, border: '1px solid var(--border)' }}>
              {[['expense','Despesa','var(--red)','var(--red-dim)'],['income','Receita','var(--green)','var(--green-dim)']].map(([val,label,color,dim]) => {
                const active = form.type === val;
                return (
                  <button key={val} type="button" onClick={() => setForm({ ...form, type: val })} style={{
                    flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 14, fontWeight: 500,
                    border: 'none', cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all 0.2s',
                    background: active ? dim : 'transparent', color: active ? color : 'var(--text3)',
                  }}>{label}</button>
                );
              })}
            </div>

            {/* Valor */}
            <div>
              <label style={labelStyle}>VALOR (R$)</label>
              <input type="number" step="0.01" min="0" required
                value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })}
                placeholder="0,00" style={{ ...inputStyle, fontFamily: 'var(--mono)', fontSize: '20px', fontWeight: 500,
                  color: isIncome ? 'var(--green)' : 'var(--red)' }} />
            </div>

            {/* Descrição */}
            <div>
              <label style={labelStyle}>DESCRIÇÃO</label>
              <input type="text" value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Ex: Aluguel, Mercado..." style={inputStyle} />
            </div>

            {/* Categoria + Data */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>CATEGORIA</label>
                <select value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })} style={inputStyle}>
                  <option value="">Sem categoria</option>
                  {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>DATA</label>
                <input type="date" required value={form.date}
                  onChange={e => setForm({ ...form, date: e.target.value })} style={inputStyle} />
              </div>
            </div>

            {error && (
              <p style={{ fontSize: 13, color: 'var(--red)', background: 'var(--red-dim)', borderRadius: 8, padding: '10px 12px' }}>
                {error}
              </p>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={onClose} style={{
                flex: 1, padding: '13px 0', borderRadius: 10, fontSize: 14, fontWeight: 500,
                border: '1px solid var(--border)', background: 'transparent',
                color: 'var(--text2)', cursor: 'pointer', fontFamily: 'var(--font)',
              }}>Cancelar</button>
              <button type="submit" disabled={loading} style={{
                flex: 2, padding: '13px 0', borderRadius: 10, fontSize: 14, fontWeight: 600,
                border: 'none', cursor: 'pointer', fontFamily: 'var(--font)',
                background: loading ? 'var(--bg3)' : 'linear-gradient(135deg, var(--indigo), #a78bfa)',
                color: loading ? 'var(--text3)' : '#fff',
              }}>{loading ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
