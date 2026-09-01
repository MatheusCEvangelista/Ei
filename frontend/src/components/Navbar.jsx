import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useNavigate, NavLink, useLocation } from 'react-router-dom';
import NotificationBell from './NotificationBell';

// ── Links primários (sempre visíveis no desktop) ──────────────────────────
const PRIMARY = [
  { to:'/',             label:'Dashboard',    icon:'🏠', end:true },
  { to:'/accounts',    label:'Contas',       icon:'🏦' },
  { to:'/credit-cards',label:'Cartões',      icon:'💳' },
  { to:'/investments', label:'Investimentos',icon:'📈' },
  { to:'/goals',       label:'Metas',        icon:'🎯' },
];

// ── Links secundários organizados por grupo ───────────────────────────────
const SECONDARY_GROUPS = [
  {
    label: '💰 Financeiro',
    links: [
      { to:'/debts',      label:'Dívidas',       icon:'💳' },
      { to:'/recurring',  label:'Recorrentes',   icon:'🔄' },
      { to:'/scheduled',  label:'Agendamentos',  icon:'📅' },
      { to:'/transfers',  label:'Transferências',icon:'↕️' },
    ],
  },
  {
    label: '📊 Análise',
    links: [
      { to:'/budgets',     label:'Tetos',        icon:'📊' },
      { to:'/projections', label:'Projeção',     icon:'📉' },
      { to:'/annual',      label:'Visão Anual',  icon:'📆' },
      { to:'/planning',    label:'Planejamento', icon:'🗺️' },
      { to:'/networth',    label:'Patrimônio',   icon:'💎' },
      { to:'/calendar',    label:'Calendário',   icon:'🗓️' },
      { to:'/report',      label:'Relatório',    icon:'📄' },
    ],
  },
  {
    label: '⚙️ Configurações',
    links: [
      { to:'/categories',  label:'Categorias',   icon:'🏷️' },
      { to:'/calculators', label:'Calculadoras', icon:'🧮' },
      { to:'/alerts',      label:'Alertas',      icon:'🔔' },
      { to:'/notifications',label:'Notificações',icon:'⚙️' },
    ],
  },
];

const SECONDARY = SECONDARY_GROUPS.flatMap(g => g.links);

// ── Bottom nav mobile — 4 tabs principais ────────────────────────────────
const BOTTOM_TABS = [
  { to:'/',             label:'Início',   icon:'🏠', end:true  },
  { to:'/accounts',    label:'Contas',   icon:'🏦'            },
  { to:'/investments', label:'Invest.',  icon:'📈'            },
  { to:'/goals',       label:'Metas',    icon:'🎯'            },
];

export default function Navbar() {
  const { user, logout }       = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate               = useNavigate();
  const location               = useLocation();
  const [moreOpen,  setMoreOpen]  = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const moreRef = useRef();
  const isDark  = theme === 'dark';

  async function handleLogout() { await logout(); navigate('/login'); }

  useEffect(() => {
    if (!moreOpen) return;
    function handle(e) {
      if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false);
    }
    const t = setTimeout(() => document.addEventListener('pointerdown', handle), 0);
    return () => { clearTimeout(t); document.removeEventListener('pointerdown', handle); };
  }, [moreOpen]);

  const secondaryActive = SECONDARY.some(l =>
    l.end ? location.pathname === l.to : location.pathname.startsWith(l.to)
  );

  const linkStyle = (isActive) => ({
    padding:'6px 10px', borderRadius:'var(--radius-sm)',
    fontSize:'var(--text-sm)', fontWeight:'var(--font-medium)',
    whiteSpace:'nowrap', textDecoration:'none',
    transition:'all var(--transition)',
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
          .nb-hide { display:none !important; }
          .bottom-nav { display:flex; }
        }
      `}</style>

      {/* ── TOP BAR ──────────────────────────────────────────────────────── */}
      <header style={{background:'var(--bg2)',borderBottom:'1px solid var(--border)',position:'sticky',top:0,zIndex:40}}>
        <div style={{maxWidth:1100,margin:'0 auto',padding:'0 var(--space-4)',height:54,display:'flex',alignItems:'center',gap:'var(--space-4)'}}>

          {/* Logo */}
          <div style={{flexShrink:0,cursor:'pointer',display:'flex',alignItems:'center'}} onClick={()=>navigate('/')}>
            <img src="/logo.png" alt="Ei!" style={{height:36,width:'auto',objectFit:'contain'}}/>
          </div>

          {/* Links primários desktop */}
          <nav className="nb-hide" style={{display:'flex',alignItems:'center',gap:'var(--space-1)',flex:1,overflow:'visible',minWidth:0}}>
            {PRIMARY.map(l=>(
              <NavLink key={l.to} to={l.to} end={l.end} style={({isActive})=>linkStyle(isActive)}>
                {l.label}
              </NavLink>
            ))}

            {/* Dropdown Mais ▾ */}
            <div ref={moreRef} style={{position:'relative'}}>
              <button onClick={()=>setMoreOpen(v=>!v)} style={{
                padding:'6px 10px', borderRadius:'var(--radius-sm)',
                fontSize:'var(--text-sm)', fontWeight:'var(--font-medium)',
                border:'none', cursor:'pointer', fontFamily:'var(--font)',
                background: moreOpen||secondaryActive ? 'var(--indigo-dim)' : 'transparent',
                color: moreOpen||secondaryActive ? 'var(--indigo)' : 'var(--text)',
                display:'flex', alignItems:'center', gap:4, whiteSpace:'nowrap',
                opacity: moreOpen||secondaryActive ? 1 : 0.85,
                transition:'all var(--transition)',
              }}>
                Mais {moreOpen?'▴':'▾'}
              </button>

              {moreOpen && (
                <div style={{
                  position:'absolute', left:0, top:42, zIndex:50,
                  background:'var(--bg2)', border:'1px solid var(--border-md)',
                  borderRadius:'var(--radius-lg)', padding:'var(--space-3)',
                  boxShadow:'var(--shadow)', minWidth:480,
                  display:'flex', gap:'var(--space-4)',
                }}>
                  {SECONDARY_GROUPS.map(group=>(
                    <div key={group.label} style={{flex:1}}>
                      <p style={{fontSize:'var(--text-xs)',color:'var(--text3)',fontWeight:'var(--font-semibold)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:'var(--space-2)',paddingBottom:'var(--space-1)',borderBottom:'1px solid var(--border)'}}>
                        {group.label}
                      </p>
                      {group.links.map(l=>(
                        <NavLink key={l.to} to={l.to} onClick={()=>setMoreOpen(false)}
                          style={({isActive})=>({
                            display:'flex', alignItems:'center', gap:'var(--space-2)',
                            padding:'var(--space-2) var(--space-2)', borderRadius:'var(--radius-sm)',
                            fontSize:'var(--text-sm)', fontWeight:'var(--font-medium)',
                            textDecoration:'none', marginBottom:2,
                            color: isActive?'var(--indigo)':'var(--text)',
                            background: isActive?'var(--indigo-dim)':'transparent',
                            transition:'background var(--transition)',
                          })}
                          onMouseOver={e=>{if(!e.currentTarget.style.background.includes('indigo-dim')) e.currentTarget.style.background='var(--bg3)';}}
                          onMouseOut={e=>{if(!e.currentTarget.style.background.includes('indigo-dim')) e.currentTarget.style.background='transparent';}}>
                          <span style={{fontSize:15}}>{l.icon}</span>
                          <span>{l.label}</span>
                        </NavLink>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </nav>

          {/* Ações direita */}
          <div style={{display:'flex',alignItems:'center',gap:'var(--space-2)',marginLeft:'auto',flexShrink:0}}>
            <NotificationBell/>
            <button onClick={toggleTheme} title={isDark?'Modo claro':'Modo escuro'}
              style={{width:32,height:32,borderRadius:'var(--radius-sm)',border:'1px solid var(--border)',background:'var(--bg3)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:15}}>
              {isDark?'☀️':'🌙'}
            </button>
            <button onClick={handleLogout} className="nb-hide"
              style={{fontSize:'var(--text-xs)',color:'var(--text3)',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:'4px 10px',cursor:'pointer',fontFamily:'var(--font)',transition:'color var(--transition)'}}
              onMouseOver={e=>e.currentTarget.style.color='var(--red)'}
              onMouseOut={e=>e.currentTarget.style.color='var(--text3)'}>
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* ── BOTTOM NAV mobile ─────────────────────────────────────────────── */}
      <nav className="bottom-nav" style={{
        position:'fixed', bottom:0, left:0, right:0, zIndex:40,
        background:'var(--bg2)', borderTop:'1px solid var(--border)',
        padding:`var(--space-1) var(--space-1) calc(var(--space-1) + env(safe-area-inset-bottom))`,
        justifyContent:'space-around', alignItems:'center',
      }}>
        {BOTTOM_TABS.map(l=>(
          <NavLink key={l.to} to={l.to} end={l.end} style={({isActive})=>({
            display:'flex', flexDirection:'column', alignItems:'center', gap:2,
            textDecoration:'none', padding:'4px 12px', borderRadius:'var(--radius-md)',
            color: isActive?'var(--indigo)':'var(--text3)',
            background: isActive?'var(--indigo-dim)':'transparent',
            minWidth:56, transition:'all var(--transition)',
          })}>
            <span style={{fontSize:20}}>{l.icon}</span>
            <span style={{fontSize:10,fontWeight:'var(--font-medium)'}}>{l.label}</span>
          </NavLink>
        ))}

        {/* Botão Mais mobile */}
        <button onClick={()=>setSheetOpen(true)} style={{
          display:'flex', flexDirection:'column', alignItems:'center', gap:2,
          background:'transparent', border:'none', cursor:'pointer', fontFamily:'var(--font)',
          padding:'4px 12px', borderRadius:'var(--radius-md)', minWidth:56,
          color: secondaryActive?'var(--indigo)':'var(--text3)',
        }}>
          <span style={{fontSize:20}}>☰</span>
          <span style={{fontSize:10,fontWeight:'var(--font-medium)'}}>Mais</span>
        </button>
      </nav>

      {/* ── Bottom Sheet mobile ───────────────────────────────────────────── */}
      {sheetOpen && (
        <div style={{position:'fixed',inset:0,zIndex:50,background:'rgba(0,0,0,0.5)',backdropFilter:'blur(3px)'}} onClick={()=>setSheetOpen(false)}>
          <div style={{position:'absolute',bottom:0,left:0,right:0,background:'var(--bg2)',borderRadius:'var(--radius-xl) var(--radius-xl) 0 0',padding:`var(--space-2) var(--space-4) calc(var(--space-8) + env(safe-area-inset-bottom))`,boxShadow:'var(--shadow)',maxHeight:'85vh',overflowY:'auto'}} onClick={e=>e.stopPropagation()}>
            <div style={{width:36,height:4,borderRadius:2,background:'var(--bg3)',margin:'var(--space-2) auto var(--space-4)'}}/>

            {/* User info */}
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'var(--space-4)',padding:`0 var(--space-1)`}}>
              <img src="/logo.png" alt="Ei!" style={{height:28,width:'auto'}}/>
              <div style={{display:'flex',gap:'var(--space-2)',alignItems:'center'}}>
                <span style={{fontSize:'var(--text-xs)',color:'var(--text3)',maxWidth:150,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                  {user?.user_metadata?.name||user?.email}
                </span>
                <button onClick={handleLogout} style={{fontSize:'var(--text-xs)',color:'var(--red)',background:'var(--red-dim)',border:'none',borderRadius:'var(--radius-sm)',padding:'5px 12px',cursor:'pointer',fontFamily:'var(--font)'}}>Sair</button>
              </div>
            </div>

            {/* Links por grupo */}
            {SECONDARY_GROUPS.map(group=>(
              <div key={group.label} style={{marginBottom:'var(--space-4)'}}>
                <p style={{fontSize:'var(--text-xs)',color:'var(--text3)',fontWeight:'var(--font-semibold)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:'var(--space-2)'}}>{group.label}</p>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'var(--space-2)'}}>
                  {group.links.map(l=>(
                    <NavLink key={l.to} to={l.to} onClick={()=>setSheetOpen(false)}
                      style={({isActive})=>({
                        display:'flex', alignItems:'center', gap:'var(--space-2)',
                        padding:'var(--space-3) var(--space-3)', borderRadius:'var(--radius-md)',
                        textDecoration:'none',
                        color: isActive?'var(--indigo)':'var(--text)',
                        background: isActive?'var(--indigo-dim)':'var(--bg3)',
                        border:`1px solid ${isActive?'rgba(124,127,247,0.3)':'var(--border)'}`,
                        fontSize:'var(--text-sm)', fontWeight:'var(--font-medium)',
                      })}>
                      <span style={{fontSize:17}}>{l.icon}</span>
                      {l.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}

            {/* Primary links que não aparecem no bottom tab */}
            <div style={{marginBottom:'var(--space-4)'}}>
              <p style={{fontSize:'var(--text-xs)',color:'var(--text3)',fontWeight:'var(--font-semibold)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:'var(--space-2)'}}>📌 Principal</p>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'var(--space-2)'}}>
                {PRIMARY.slice(1).filter(l=>!BOTTOM_TABS.find(b=>b.to===l.to)).map(l=>(
                  <NavLink key={l.to} to={l.to} onClick={()=>setSheetOpen(false)}
                    style={({isActive})=>({
                      display:'flex', alignItems:'center', gap:'var(--space-2)',
                      padding:'var(--space-3) var(--space-3)', borderRadius:'var(--radius-md)',
                      textDecoration:'none',
                      color: isActive?'var(--indigo)':'var(--text)',
                      background: isActive?'var(--indigo-dim)':'var(--bg3)',
                      border:`1px solid ${isActive?'rgba(124,127,247,0.3)':'var(--border)'}`,
                      fontSize:'var(--text-sm)', fontWeight:'var(--font-medium)',
                    })}>
                    <span style={{fontSize:17}}>{l.icon}</span>
                    {l.label}
                  </NavLink>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media(max-width:820px){
          main,.page-main{ padding-bottom:calc(80px + env(safe-area-inset-bottom)) !important; }
        }
      `}</style>
    </>
  );
}
