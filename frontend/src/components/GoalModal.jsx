import { useState, useEffect } from 'react';
import api from '../lib/api';

const PRESET_COLORS = [
  '#7c7ff7','#a78bfa','#ec4899','#f05e6e',
  '#f5a623','#2dd4a0','#06b6d4','#3b82f6',
  '#84cc16','#f97316','#8b90a4','#14b8a6',
];

const inputStyle = {
  width: '100%', padding: '11px 14px',
  background: 'var(--bg3)', border: '1px solid var(--border)',
  borderRadius: 8, color: 'var(--text)',
};
const labelStyle = {
  display: 'block', fontSize: 12, color: 'var(--text2)',
  fontWeight: 500, marginBottom: 6, letterSpacing: '0.02em',
};

export default function GoalModal({ goal, categories, onClose, onSave }) {
  const [form, setForm] = useState({
    name: '', target_amount: '', current_amount: '',
    deadline: '', category_id: '', color: '#7c7ff7',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (goal) setForm({
      name: goal.name,
      target_amount: goal.target_amount,
      current_amount: goal.current_amount,
      deadline: goal.deadline || '',
      category_id: goal.category_id || '',
      color: goal.color || '#7c7ff7',
    });
  }, [goal]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (goal) await api.put(`/api/goals/${goal.id}`, form);
      else await api.post('/api/goals', form);
      onSave();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar');
    } finally { setLoading(false); }
  }

  const pct = form.target_amount > 0 ? Math.min(100, Math.round((form.current_amount / form.target_amount) * 100)) : 0;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 50, padding: 0,
    }} onClick={onClose}>
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border-md)',
        borderRadius: '18px 18px 0 0', width: '100%', maxWidth: 480,
        padding: '8px 24px 32px', boxShadow: 'var(--shadow)',
      }} className="fade-up" onClick={e => e.stopPropagation()}>

        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--bg3)', margin: '10px auto 20px' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.02em' }}>
            {goal ? 'Editar meta' : 'Nova meta'}
          </h2>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text2)', cursor: 'pointer', fontSize: 16 }}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Preview barra de progresso */}
            <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: form.name ? 'var(--text)' : 'var(--text3)' }}>
                  {form.name || 'Nome da meta'}
                </span>
                <span style={{ fontSize: 12, fontFamily: 'var(--mono)', color: form.color }}>{pct}%</span>
              </div>
              <div style={{ height: 6, background: 'var(--bg2)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: form.color, borderRadius: 99, transition: 'width 0.3s' }} />
              </div>
            </div>

            {/* Nome */}
            <div>
              <label style={labelStyle}>NOME DA META</label>
              <input type="text" required value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Viagem, Notebook, Reserva..." style={inputStyle} />
            </div>

            {/* Valor alvo + atual */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>VALOR ALVO (R$)</label>
                <input type="number" step="0.01" min="0" required value={form.target_amount}
                  onChange={e => setForm({ ...form, target_amount: e.target.value })}
                  placeholder="0,00" style={{ ...inputStyle, fontFamily: 'var(--mono)' }} />
              </div>
              <div>
                <label style={labelStyle}>JÁ GUARDADO (R$)</label>
                <input type="number" step="0.01" min="0" value={form.current_amount}
                  onChange={e => setForm({ ...form, current_amount: e.target.value })}
                  placeholder="0,00" style={{ ...inputStyle, fontFamily: 'var(--mono)', color: 'var(--green)' }} />
              </div>
            </div>

            {/* Prazo + categoria */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>PRAZO (OPCIONAL)</label>
                <input type="date" value={form.deadline}
                  onChange={e => setForm({ ...form, deadline: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>CATEGORIA</label>
                <select value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })} style={inputStyle}>
                  <option value="">Sem categoria</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            {/* Cor */}
            <div>
              <label style={labelStyle}>COR</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
                {PRESET_COLORS.map(color => (
                  <button key={color} type="button" onClick={() => setForm({ ...form, color })}
                    style={{
                      width: '100%', aspectRatio: '1', borderRadius: 9, background: color,
                      border: form.color === color ? '2px solid #fff' : '2px solid transparent',
                      cursor: 'pointer', boxShadow: form.color === color ? `0 0 0 3px ${color}55` : 'none',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'transform 0.15s',
                    }}
                    onMouseOver={e => e.currentTarget.style.transform = 'scale(1.1)'}
                    onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    {form.color === color && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>

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
