import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm] = useState({ email: '', password: '', name: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isLogin) await login(form.email, form.password);
      else await register(form.email, form.password, form.name);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Ocorreu um erro. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    width: '100%', padding: '12px 14px', fontSize: 14,
    background: 'var(--bg3)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', color: 'var(--text)',
  };

  const labelStyle = { display: 'block', fontSize: 13, color: 'var(--text2)', marginBottom: 6, fontWeight: 500 };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: 16,
      backgroundImage: 'radial-gradient(ellipse at 60% 0%, rgba(124,127,247,0.08) 0%, transparent 60%)',
    }}>
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: 20, width: '100%', maxWidth: 400, padding: 36,
        boxShadow: 'var(--shadow)',
      }} className="fade-up">

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14, margin: '0 auto 14px',
            background: 'linear-gradient(135deg, var(--indigo), #a78bfa)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
          }}>💰</div>
          <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.03em' }}>FinanceApp</h1>
          <p style={{ color: 'var(--text3)', fontSize: 13, marginTop: 4 }}>Controle suas finanças com clareza</p>
        </div>

        {/* Toggle */}
        <div style={{
          display: 'flex', background: 'var(--bg3)', borderRadius: 10,
          padding: 3, marginBottom: 24, border: '1px solid var(--border)',
        }}>
          {['Entrar', 'Cadastrar'].map((label, i) => {
            const active = isLogin === (i === 0);
            return (
              <button key={label} onClick={() => setIsLogin(i === 0)} style={{
                flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 13, fontWeight: 500,
                border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                background: active ? 'var(--bg2)' : 'transparent',
                color: active ? 'var(--indigo)' : 'var(--text3)',
                boxShadow: active ? '0 1px 4px rgba(0,0,0,0.3)' : 'none',
              }}>{label}</button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {!isLogin && (
              <div>
                <label style={labelStyle}>Nome</label>
                <input style={inputStyle} type="text" placeholder="Seu nome"
                  value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
            )}
            <div>
              <label style={labelStyle}>Email</label>
              <input style={inputStyle} type="email" required placeholder="seu@email.com"
                value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Senha</label>
              <input style={inputStyle} type="password" required placeholder="••••••••"
                value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
            </div>

            {error && (
              <div style={{
                background: 'var(--red-dim)', border: '1px solid rgba(240,94,110,0.2)',
                color: 'var(--red)', fontSize: 13, borderRadius: 8, padding: '10px 14px',
              }}>{error}</div>
            )}

            <button type="submit" disabled={loading} style={{
              padding: '13px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font)', fontSize: 14, fontWeight: 600,
              background: loading ? 'var(--bg3)' : 'linear-gradient(135deg, var(--indigo), #a78bfa)',
              color: loading ? 'var(--text3)' : '#fff',
              transition: 'opacity 0.2s', marginTop: 4,
            }}>
              {loading ? 'Aguarde...' : isLogin ? 'Entrar' : 'Criar conta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
