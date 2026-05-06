import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, NavLink } from 'react-router-dom';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleLogout() { await logout(); navigate('/login'); }

  const linkClass = ({ isActive }) =>
    `px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${isActive ? 'bg-[var(--indigo-dim)] text-[var(--indigo)]' : 'text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--bg3)]'}`;

  const links = [
    { to: '/',           label: 'Dashboard',   end: true },
    { to: '/goals',      label: 'Metas' },
    { to: '/recurring',  label: 'Recorrentes' },
    { to: '/accounts',   label: 'Contas' },
    { to: '/categories', label: 'Categorias' },
  ];

  return (
    <header style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 40 }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg, var(--indigo), #a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>💰</div>
          <span style={{ fontWeight: 600, fontSize: 15, letterSpacing: '-0.02em' }}>FinanceApp</span>
        </div>

        {/* Nav desktop */}
        <nav className="hidden sm:flex" style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {links.map(l => <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>{l.label}</NavLink>)}
        </nav>

        <div className="hidden sm:flex" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: 'var(--text3)' }}>{user?.user_metadata?.name || user?.email}</span>
          <button onClick={handleLogout} style={{ fontSize: 13, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)' }}>Sair</button>
        </div>

        {/* Hamburguer */}
        <button onClick={() => setMenuOpen(v => !v)} className="sm:hidden"
          style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, width: 36, height: 36, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer' }}>
          {[1,2,3].map(i => <span key={i} style={{ display: 'block', width: 16, height: 1.5, background: 'var(--text2)', borderRadius: 2 }} />)}
        </button>
      </div>

      {menuOpen && (
        <div style={{ background: 'var(--bg2)', borderTop: '1px solid var(--border)', padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: 4 }} className="sm:hidden fade-up">
          {links.map(l => <NavLink key={l.to} to={l.to} end={l.end} className={linkClass} onClick={() => setMenuOpen(false)}>{l.label}</NavLink>)}
          <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: 'var(--text3)' }}>{user?.user_metadata?.name || user?.email}</span>
            <button onClick={handleLogout} style={{ fontSize: 13, color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)' }}>Sair</button>
          </div>
        </div>
      )}
    </header>
  );
}
