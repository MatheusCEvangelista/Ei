import { useState, useEffect } from 'react';
import api from '../lib/api';

const PRESET_COLORS = [
  '#7c7ff7','#a78bfa','#ec4899','#f05e6e',
  '#f5a623','#2dd4a0','#06b6d4','#3b82f6',
  '#84cc16','#f97316','#8b90a4','#14b8a6',
];

const inputStyle = {
  width: '100%', padding: '11px 14px', fontSize: 14,
  background: 'var(--bg3)', border: '1px solid var(--border)',
  borderRadius: 8, color: 'var(--text)',
};
const labelStyle = {
  display: 'block', fontSize: 12, color: 'var(--text2)',
  fontWeight: 500, marginBottom: 6, letterSpacing: '0.02em',
};

export default function CategoryModal({ category, onClose, onSave }) {
  const [form, setForm] = useState({ name: '', color: '#7c7ff7' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (category) setForm({ name: category.name, color: category.color });
  }, [category]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) return setError('Nome é obrigatório');
    setLoading(true);
    try {
      if (category) await api.put(`/api/categories/${category.id}`, form);
      else await api.post('/api/categories', form);
      onSave();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar');
    } finally { setLoading(false); }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16,
    }} onClick={onClose}>
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border-md)',
        borderRadius: 18, width: '100%', maxWidth: 380, padding: 28,
        boxShadow: 'var(--shadow)',
      }} className="fade-up" onClick={e => e.stopPropagation()}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.02em' }}>
            {category ? 'Editar categoria' : 'Nova categoria'}
          </h2>
          <button onClick={onClose} style={{
            width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)',
            background: 'var(--bg3)', color: 'var(--text2)', cursor: 'pointer', fontSize: 16,
          }}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Preview */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={{
                width: 60, height: 60, borderRadius: 16,
                background: form.color, display: 'flex', alignItems: 'center',
                justifyContent: 'center', color: '#fff',
                fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em',
                boxShadow: `0 8px 24px ${form.color}55`, transition: 'all 0.2s',
              }}>
                {form.name ? form.name.charAt(0).toUpperCase() : '?'}
              </div>
            </div>

            {/* Nome */}
            <div>
              <label style={labelStyle}>NOME</label>
              <input type="text" required maxLength={30}
                value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Academia, Streaming..." style={inputStyle} />
            </div>

            {/* Cores */}
            <div>
              <label style={labelStyle}>COR</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, marginBottom: 12 }}>
                {PRESET_COLORS.map(color => (
                  <button key={color} type="button" onClick={() => setForm({ ...form, color })}
                    style={{
                      width: '100%', aspectRatio: '1', borderRadius: 9, background: color,
                      border: form.color === color ? `2px solid #fff` : '2px solid transparent',
                      cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s',
                      boxShadow: form.color === color ? `0 0 0 3px ${color}55` : 'none',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                    onMouseOver={e => e.currentTarget.style.transform = 'scale(1.12)'}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>Cor personalizada:</span>
                <input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })}
                  style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', padding: 2, background: 'var(--bg3)' }} />
              </div>
            </div>

            {error && (
              <p style={{ fontSize: 13, color: 'var(--red)', background: 'var(--red-dim)', borderRadius: 8, padding: '10px 12px' }}>
                {error}
              </p>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={onClose} style={{
                flex: 1, padding: '12px 0', borderRadius: 10, fontSize: 14, fontWeight: 500,
                border: '1px solid var(--border)', background: 'transparent',
                color: 'var(--text2)', cursor: 'pointer', fontFamily: 'var(--font)',
              }}>Cancelar</button>
              <button type="submit" disabled={loading} style={{
                flex: 1, padding: '12px 0', borderRadius: 10, fontSize: 14, fontWeight: 600,
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
