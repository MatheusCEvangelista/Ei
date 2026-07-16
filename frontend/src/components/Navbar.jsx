import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useNavigate, NavLink } from 'react-router-dom';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  async function handleLogout() { await logout(); navigate('/login'); }

  const links = [
    { to:'/',            label:'Dashboard',    end:true },
    { to:'/investments', label:'Investimentos' },
    { to:'/goals',       label:'Metas'         },
    { to:'/recurring',   label:'Recorrentes'   },
    { to:'/accounts',    label:'Contas'        },
    { to:'/categories',  label:'Categorias'    },
    { to:'/calculators', label:'Calculadoras'  },
    { to:'/budgets',     label:'Tetos'         },
  ];

  const isDark = theme === 'dark';

  return (
    <>
      <style>{`
        .nb-links{display:flex}.nb-user{display:flex}.nb-ham{display:none}
        @media(max-width:820px){.nb-links{display:none}.nb-user{display:none}.nb-ham{display:flex}}
      `}</style>
      <header style={{background:'var(--bg2)',borderBottom:'1px solid var(--border)',position:'sticky',top:0,zIndex:40}}>
        <div style={{maxWidth:1080,margin:'0 auto',padding:'0 16px',height:56,display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>

          {/* Logo */}
          <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
            <div style={{width:30,height:30,borderRadius:8,background:'linear-gradient(135deg,var(--indigo),#a78bfa)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14}}>💰</div>
            <span style={{fontWeight:700,fontSize:15,color:'var(--text)',letterSpacing:'-0.02em'}}>FinanceApp</span>
          </div>

          {/* Links desktop */}
          <nav className="nb-links" style={{alignItems:'center',gap:2,flex:1,justifyContent:'center',overflowX:'auto',scrollbarWidth:'none'}}>
            {links.map(l=>(
              <NavLink key={l.to} to={l.to} end={l.end} style={({isActive})=>({
                padding:'6px 10px',borderRadius:8,fontSize:13,fontWeight:500,
                whiteSpace:'nowrap',textDecoration:'none',transition:'all 0.15s',
                color:isActive?'var(--indigo)':'var(--text)',
                background:isActive?'var(--indigo-dim)':'transparent',
                opacity:isActive?1:0.85,
              })}>{l.label}</NavLink>
            ))}
          </nav>

          {/* Usuário + toggle tema */}
          <div className="nb-user" style={{alignItems:'center',gap:10,flexShrink:0}}>
            <span style={{fontSize:12,color:'var(--text3)',maxWidth:130,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
              {user?.user_metadata?.name||user?.email}
            </span>

            {/* Botão de tema */}
            <button onClick={toggleTheme} title={isDark?'Modo claro':'Modo escuro'}
              style={{width:34,height:34,borderRadius:8,border:'1px solid var(--border)',background:'var(--bg3)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,transition:'all 0.2s',flexShrink:0}}>
              {isDark ? '☀️' : '🌙'}
            </button>

            <button onClick={handleLogout}
              style={{fontSize:13,color:'var(--text2)',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:7,padding:'4px 10px',cursor:'pointer',fontFamily:'var(--font)',transition:'color 0.15s'}}
              onMouseOver={e=>e.currentTarget.style.color='var(--red)'}
              onMouseOut={e=>e.currentTarget.style.color='var(--text2)'}>Sair</button>
          </div>

          {/* Hambúrguer mobile */}
          <button onClick={()=>setOpen(v=>!v)} className="nb-ham"
            style={{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:8,width:36,height:36,flexDirection:'column',alignItems:'center',justifyContent:'center',gap:4,cursor:'pointer'}}>
            <span style={{display:'block',width:16,height:2,background:'var(--text)',borderRadius:2,transition:'all .2s',transform:open?'rotate(45deg) translate(4px,4px)':'none'}}/>
            <span style={{display:'block',width:16,height:2,background:'var(--text)',borderRadius:2,transition:'opacity .2s',opacity:open?0:1}}/>
            <span style={{display:'block',width:16,height:2,background:'var(--text)',borderRadius:2,transition:'all .2s',transform:open?'rotate(-45deg) translate(4px,-4px)':'none'}}/>
          </button>
        </div>

        {/* Menu mobile */}
        {open&&(
          <div style={{background:'var(--bg2)',borderTop:'1px solid var(--border)',padding:'10px 14px 16px'}} className="fade-up">
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:12}}>
              {links.map(l=>(
                <NavLink key={l.to} to={l.to} end={l.end} onClick={()=>setOpen(false)}
                  style={({isActive})=>({
                    padding:'10px 12px',borderRadius:9,fontSize:13,fontWeight:500,textDecoration:'none',transition:'all 0.15s',
                    color:isActive?'var(--indigo)':'var(--text)',
                    background:isActive?'var(--indigo-dim)':'var(--bg3)',
                    border:`1px solid ${isActive?'rgba(124,127,247,.3)':'var(--border)'}`,
                  })}>{l.label}</NavLink>
              ))}
            </div>
            <div style={{borderTop:'1px solid var(--border)',paddingTop:10,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontSize:12,color:'var(--text3)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'60%'}}>
                {user?.user_metadata?.name||user?.email}
              </span>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <button onClick={toggleTheme} title={isDark?'Modo claro':'Modo escuro'}
                  style={{width:32,height:32,borderRadius:7,border:'1px solid var(--border)',background:'var(--bg3)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:15}}>
                  {isDark ? '☀️' : '🌙'}
                </button>
                <button onClick={handleLogout} style={{fontSize:13,color:'var(--red)',background:'none',border:'none',cursor:'pointer',fontFamily:'var(--font)'}}>Sair</button>
              </div>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
