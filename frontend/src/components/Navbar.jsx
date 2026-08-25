import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useNavigate, NavLink, useLocation } from 'react-router-dom';
import NotificationBell from './NotificationBell';

const PRIMARY = [
  { to:'/',            label:'Dashboard',    icon:'🏠', end:true },
  { to:'/accounts',    label:'Contas',       icon:'🏦' },
  { to:'/credit-cards',label:'Cartões',      icon:'💳' },
  { to:'/investments', label:'Investimentos',icon:'📈' },
  { to:'/goals',       label:'Metas',        icon:'🎯' },
];

const SECONDARY = [
  { to:'/recurring',   label:'Recorrentes',  icon:'🔄' },
  { to:'/debts',       label:'Dívidas',      icon:'💰' },
  { to:'/budgets',     label:'Tetos',        icon:'📊' },
  { to:'/projections', label:'Projeção',     icon:'📉' },
  { to:'/categories',  label:'Categorias',   icon:'🏷️' },
  { to:'/calculators', label:'Calculadoras', icon:'🧮' },
  { to:'/report',      label:'Relatório',    icon:'📄' },
  { to:'/calendar', label:'Calendário', icon:'📅' },
  { to:'/networth', label:'Patrimônio', icon:'💎' },
  { to:'/annual', label:'Visão Anual', icon:'📅' },
  { to:'/scheduled', label:'Agendamentos', icon:'📅' },
];

export default function Navbar() {
  const { user, logout }       = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate               = useNavigate();
  const location               = useLocation();
  const [moreOpen,   setMoreOpen]   = useState(false);
  const [sheetOpen,  setSheetOpen]  = useState(false);
  const moreRef = useRef();
  const isDark  = theme === 'dark';

  async function handleLogout() { await logout(); navigate('/login'); }

  useEffect(() => {
    if (!moreOpen) return;
    function handle(e) { if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false); }
    const t = setTimeout(() => document.addEventListener('pointerdown', handle), 0);
    return () => { clearTimeout(t); document.removeEventListener('pointerdown', handle); };
  }, [moreOpen]);

  const secondaryActive = SECONDARY.some(l =>
    l.end ? location.pathname === l.to : location.pathname.startsWith(l.to)
  );

  const linkStyle = (isActive) => ({
    padding:'6px 10px', borderRadius:8, fontSize:13, fontWeight:500,
    whiteSpace:'nowrap', textDecoration:'none', transition:'all 0.15s',
    color: isActive ? 'var(--indigo)' : 'var(--text)',
    background: isActive ? 'var(--indigo-dim)' : 'transparent',
    opacity: isActive ? 1 : 0.85,
  });

  return (
    <>
      <style>{`
        .nb-hide { display:flex; }
        .bottom-nav { display:none; }
        @media(max-width:820px){
          .nb-hide   { display:none !important; }
          .bottom-nav{ display:flex; }
        }
      `}</style>

      {/* ── TOP BAR ── */}
      <header style={{background:'var(--bg2)',borderBottom:'1px solid var(--border)',position:'sticky',top:0,zIndex:40}}>
        <div style={{maxWidth:1100,margin:'0 auto',padding:'0 16px',height:54,display:'flex',alignItems:'center',gap:14}}>

          {/* Logo Ei! */}
          <div style={{flexShrink:0,cursor:'pointer',display:'flex',alignItems:'center'}} onClick={()=>navigate('/')}>
            <img src="/logo.png" alt="Ei!" style={{height:38,width:'auto',objectFit:'contain'}}/>
          </div>

          {/* Links primários desktop */}
          <nav className="nb-hide" style={{display:'flex',alignItems:'center',gap:2,flex:1,overflow:'visible',minWidth:0}}>
            {PRIMARY.map(l=>(
              <NavLink key={l.to} to={l.to} end={l.end} style={({isActive})=>linkStyle(isActive)}>
                {l.label}
              </NavLink>
            ))}

            {/* Mais ▾ */}
            <div ref={moreRef} style={{position:'relative'}}>
              <button onClick={()=>setMoreOpen(v=>!v)} style={{
                padding:'6px 10px', borderRadius:8, fontSize:13, fontWeight:500,
                border:'none', cursor:'pointer', fontFamily:'var(--font)',
                background: moreOpen||secondaryActive ? 'var(--indigo-dim)' : 'transparent',
                color: moreOpen||secondaryActive ? 'var(--indigo)' : 'var(--text)',
                display:'flex', alignItems:'center', gap:4, whiteSpace:'nowrap',
                opacity: moreOpen||secondaryActive ? 1 : 0.85,
              }}>
                Mais {moreOpen?'▴':'▾'}
              </button>

              {moreOpen && (
                <div style={{
                  position:'absolute', left:0, top:42, zIndex:50,
                  background:'var(--bg2)', border:'1px solid var(--border-md)',
                  borderRadius:12, padding:6, display:'grid',
                  gridTemplateColumns:'1fr 1fr', gap:4,
                  boxShadow:'var(--shadow)', minWidth:280,
                }}>
                  {SECONDARY.map(l=>(
                    <NavLink key={l.to} to={l.to} onClick={()=>setMoreOpen(false)}
                      style={({isActive})=>({
                        padding:'9px 12px', borderRadius:8, fontSize:13, fontWeight:500,
                        textDecoration:'none', display:'flex', alignItems:'center', gap:8,
                        color: isActive?'var(--indigo)':'var(--text)',
                        background: isActive?'var(--indigo-dim)':'transparent',
                        transition:'background 0.1s',
                      })}
                      onMouseOver={e=>{ if(!e.currentTarget.style.background.includes('var(--indigo-dim)')) e.currentTarget.style.background='var(--bg3)'; }}
                      onMouseOut={e=>{ if(!e.currentTarget.style.background.includes('var(--indigo-dim)')) e.currentTarget.style.background='transparent'; }}
                    >
                      <span style={{fontSize:16}}>{l.icon}</span>{l.label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          </nav>

          {/* Ações direita */}
          <div style={{display:'flex',alignItems:'center',gap:8,marginLeft:'auto',flexShrink:0}}>
            <NotificationBell/>
            <button onClick={toggleTheme} title={isDark?'Modo claro':'Modo escuro'}
              style={{width:32,height:32,borderRadius:8,border:'1px solid var(--border)',background:'var(--bg3)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:15}}>
              {isDark?'☀️':'🌙'}
            </button>
            <button onClick={handleLogout} className="nb-hide"
              style={{fontSize:12,color:'var(--text2)',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:7,padding:'4px 10px',cursor:'pointer',fontFamily:'var(--font)'}}
              onMouseOver={e=>e.currentTarget.style.color='var(--red)'}
              onMouseOut={e=>e.currentTarget.style.color='var(--text2)'}>
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* ── BOTTOM NAV mobile ── */}
      <nav className="bottom-nav" style={{
        position:'fixed', bottom:0, left:0, right:0, zIndex:40,
        background:'var(--bg2)', borderTop:'1px solid var(--border)',
        padding:'6px 4px calc(6px + env(safe-area-inset-bottom))',
        justifyContent:'space-around', alignItems:'center',
      }}>
        {PRIMARY.slice(0,4).map(l=>(
          <NavLink key={l.to} to={l.to} end={l.end} style={({isActive})=>({
            display:'flex', flexDirection:'column', alignItems:'center', gap:2,
            textDecoration:'none', padding:'4px 10px', borderRadius:10,
            color: isActive ? 'var(--indigo)' : 'var(--text3)',
            background: isActive ? 'var(--indigo-dim)' : 'transparent',
            minWidth:56, transition:'all 0.15s',
          })}>
            <span style={{fontSize:19}}>{l.icon}</span>
            <span style={{fontSize:10,fontWeight:500}}>{l.label}</span>
          </NavLink>
        ))}
        <button onClick={()=>setSheetOpen(true)} style={{
          display:'flex', flexDirection:'column', alignItems:'center', gap:2,
          background:'transparent', border:'none', cursor:'pointer', fontFamily:'var(--font)',
          padding:'4px 10px', borderRadius:10, minWidth:56,
          color: secondaryActive ? 'var(--indigo)' : 'var(--text3)',
        }}>
          <span style={{fontSize:19}}>☰</span>
          <span style={{fontSize:10,fontWeight:500}}>Mais</span>
        </button>
      </nav>

      {/* ── Sheet mobile ── */}
      {sheetOpen && (
        <div style={{position:'fixed',inset:0,zIndex:50,background:'rgba(0,0,0,0.5)',backdropFilter:'blur(3px)'}} onClick={()=>setSheetOpen(false)}>
          <div style={{position:'absolute',bottom:0,left:0,right:0,background:'var(--bg2)',borderRadius:'18px 18px 0 0',padding:'8px 16px 32px',boxShadow:'var(--shadow)'}} onClick={e=>e.stopPropagation()}>
            <div style={{width:36,height:4,borderRadius:2,background:'var(--bg3)',margin:'8px auto 14px'}}/>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,padding:'0 4px'}}>
              <img src="/logo.png" alt="Ei!" style={{height:32,width:'auto'}}/>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <span style={{fontSize:12,color:'var(--text3)',maxWidth:150,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                  {user?.user_metadata?.name||user?.email}
                </span>
                <button onClick={handleLogout} style={{fontSize:13,color:'var(--red)',background:'var(--red-dim)',border:'none',borderRadius:7,padding:'5px 12px',cursor:'pointer',fontFamily:'var(--font)'}}>Sair</button>
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              {[PRIMARY[4], ...SECONDARY].map(l=>(
                <NavLink key={l.to} to={l.to} onClick={()=>setSheetOpen(false)}
                  style={({isActive})=>({
                    display:'flex', alignItems:'center', gap:10,
                    padding:'12px 14px', borderRadius:10, textDecoration:'none',
                    color: isActive?'var(--indigo)':'var(--text)',
                    background: isActive?'var(--indigo-dim)':'var(--bg3)',
                    border:`1px solid ${isActive?'rgba(124,127,247,0.3)':'var(--border)'}`,
                    fontSize:13, fontWeight:500,
                  })}>
                  <span style={{fontSize:18}}>{l.icon}</span>{l.label}
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media(max-width:820px){
          main,.page-main{padding-bottom:calc(80px + env(safe-area-inset-bottom)) !important;}
        }
      `}</style>
    </>
  );
}
