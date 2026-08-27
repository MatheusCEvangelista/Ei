// ═══════════════════════════════════════════════════════════════
// ui.jsx — Componentes base do Ei! Design System
// Importe o que precisar: import { Card, StatCard, ... } from '../components/ui'
// ═══════════════════════════════════════════════════════════════

import { useNavigate } from 'react-router-dom';

// ── PageHeader ───────────────────────────────────────────────────────────────
// Cabeçalho padrão de todas as páginas
export function PageHeader({ title, subtitle, action }) {
  return (
    <div style={{
      display:'flex', alignItems:'flex-start',
      justifyContent:'space-between', marginBottom:'var(--space-6)',
      flexWrap:'wrap', gap:'var(--space-3)',
    }}>
      <div>
        <h1 style={{
          fontSize:'var(--text-xl)', fontWeight:'var(--font-semibold)',
          letterSpacing:'-0.03em', color:'var(--text)',
        }}>{title}</h1>
        {subtitle && (
          <p style={{fontSize:'var(--text-sm)',color:'var(--text3)',marginTop:'var(--space-1)'}}>
            {subtitle}
          </p>
        )}
      </div>
      {action && <div style={{flexShrink:0}}>{action}</div>}
    </div>
  );
}

// ── Card ─────────────────────────────────────────────────────────────────────
// Container padrão com borda e fundo
export function Card({ children, style={}, onClick, hover=false }) {
  return (
    <div
      onClick={onClick}
      style={{
        background:'var(--bg2)',
        border:'1px solid var(--border)',
        borderRadius:'var(--radius-lg)',
        overflow:'hidden',
        cursor: onClick||hover ? 'pointer' : 'default',
        transition: hover ? 'filter var(--transition)' : 'none',
        ...style,
      }}
      onMouseOver={e=>{ if(hover||onClick) e.currentTarget.style.filter='brightness(0.97)'; }}
      onMouseOut={e=>{ e.currentTarget.style.filter='none'; }}
    >
      {children}
    </div>
  );
}

// ── CardBody ──────────────────────────────────────────────────────────────────
export function CardBody({ children, style={} }) {
  return (
    <div style={{ padding:'var(--space-5)', ...style }}>
      {children}
    </div>
  );
}

// ── StatCard ─────────────────────────────────────────────────────────────────
// Card de métrica (receitas, despesas, saldo, etc.)
export function StatCard({ label, value, color='var(--text)', icon, borderColor }) {
  return (
    <div style={{
      background:'var(--bg2)',
      border:`1px solid ${borderColor||'var(--border)'}`,
      borderRadius:'var(--radius-lg)',
      padding:'var(--space-4) var(--space-4)',
      display:'flex', alignItems:'center', gap:'var(--space-3)',
    }}>
      {icon && (
        <div style={{
          width:38, height:38, borderRadius:'var(--radius-sm)',
          background:`${color}18`,
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:17, flexShrink:0,
        }}>
          {icon}
        </div>
      )}
      <div style={{minWidth:0}}>
        <p style={{
          fontSize:'var(--text-xs)', color:'var(--text3)',
          textTransform:'uppercase', letterSpacing:'0.06em',
          marginBottom:'var(--space-1)', fontWeight:'var(--font-medium)',
        }}>
          {label}
        </p>
        <p style={{
          fontFamily:'var(--mono)', fontSize:'var(--text-lg)',
          fontWeight:'var(--font-bold)', color,
          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
        }}>
          {value}
        </p>
      </div>
    </div>
  );
}

// ── EmptyState ────────────────────────────────────────────────────────────────
// Estado vazio padronizado para todas as páginas
export function EmptyState({ icon='📭', title, subtitle, action }) {
  return (
    <div style={{
      textAlign:'center',
      padding:'var(--space-10) var(--space-4)',
      display:'flex', flexDirection:'column', alignItems:'center', gap:'var(--space-2)',
    }}>
      <div style={{fontSize:44, marginBottom:'var(--space-2)', lineHeight:1}}>{icon}</div>
      <p style={{fontSize:'var(--text-md)',fontWeight:'var(--font-medium)',color:'var(--text)'}}>{title}</p>
      {subtitle && <p style={{fontSize:'var(--text-sm)',color:'var(--text3)',maxWidth:320}}>{subtitle}</p>}
      {action && <div style={{marginTop:'var(--space-3)'}}>{action}</div>}
    </div>
  );
}

// ── SkeletonList ──────────────────────────────────────────────────────────────
// Loading padrão — n cards de altura h
export function SkeletonList({ n=3, h=72, gap=10 }) {
  return (
    <div style={{display:'flex',flexDirection:'column',gap}}>
      {Array.from({length:n}).map((_,i)=>(
        <div key={i} className="skeleton" style={{height:h,borderRadius:'var(--radius-lg)'}}/>
      ))}
    </div>
  );
}

// ── SectionLabel ──────────────────────────────────────────────────────────────
// Label de seção — uppercase com tracking
export function SectionLabel({ children, style={} }) {
  return (
    <p style={{
      fontSize:'var(--text-xs)', color:'var(--text3)',
      fontWeight:'var(--font-semibold)',
      textTransform:'uppercase', letterSpacing:'0.07em',
      marginBottom:'var(--space-2)',
      ...style,
    }}>
      {children}
    </p>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────
export function Badge({ children, color='var(--indigo)', bg='var(--indigo-dim)' }) {
  return (
    <span style={{
      display:'inline-block',
      fontSize:'var(--text-xs)', fontWeight:'var(--font-semibold)',
      color, background:bg,
      borderRadius:'var(--radius-full)',
      padding:'2px 8px', whiteSpace:'nowrap',
    }}>
      {children}
    </span>
  );
}

// ── Button ────────────────────────────────────────────────────────────────────
export function Button({ children, onClick, variant='primary', size='md', disabled=false, style={} }) {
  const variants = {
    primary:   { background:'linear-gradient(135deg,#7c3aed,#a78bfa)', color:'#fff', border:'none' },
    secondary: { background:'var(--bg3)', color:'var(--text2)', border:'1px solid var(--border)' },
    danger:    { background:'var(--red-dim)', color:'var(--red)', border:'1px solid rgba(240,94,110,0.2)' },
    ghost:     { background:'transparent', color:'var(--text3)', border:'1px solid var(--border)' },
  };
  const sizes = {
    sm: { padding:'6px 12px', fontSize:'var(--text-sm)',  borderRadius:'var(--radius-sm)' },
    md: { padding:'10px 18px',fontSize:'var(--text-base)',borderRadius:'var(--radius-md)' },
    lg: { padding:'13px 24px',fontSize:'var(--text-md)',  borderRadius:'var(--radius-lg)' },
  };
  const v = variants[variant] || variants.primary;
  const s = sizes[size]      || sizes.md;

  return (
    <button onClick={onClick} disabled={disabled} style={{
      ...v, ...s,
      fontFamily:'var(--font)', fontWeight:'var(--font-semibold)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      transition:'all var(--transition)',
      whiteSpace:'nowrap',
      ...style,
    }}
    onMouseOver={e=>{ if(!disabled) e.currentTarget.style.filter='brightness(1.08)'; }}
    onMouseOut={e=>{ e.currentTarget.style.filter='none'; }}>
      {children}
    </button>
  );
}

// ── Input ─────────────────────────────────────────────────────────────────────
export function Input({ label, type='text', value, onChange, placeholder, required=false, inputMode, style={}, ...props }) {
  return (
    <div>
      {label && (
        <label style={{
          display:'block', fontSize:'var(--text-sm)',
          color:'var(--text2)', fontWeight:'var(--font-medium)',
          marginBottom:'var(--space-1)',
        }}>
          {label}{required && <span style={{color:'var(--red)',marginLeft:2}}>*</span>}
        </label>
      )}
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        inputMode={inputMode || (type==='number' ? 'decimal' : undefined)}
        style={{
          width:'100%', padding:'11px 14px',
          background:'var(--bg3)', border:'1px solid var(--border)',
          borderRadius:'var(--radius-sm)', color:'var(--text)',
          fontSize:'var(--text-base)', outline:'none',
          transition:'border-color var(--transition)',
          ...style,
        }}
        onFocus={e=>e.target.style.borderColor='var(--indigo)'}
        onBlur={e=>e.target.style.borderColor='var(--border)'}
        {...props}
      />
    </div>
  );
}

// ── Select ────────────────────────────────────────────────────────────────────
export function Select({ label, value, onChange, children, required=false, style={} }) {
  return (
    <div>
      {label && (
        <label style={{
          display:'block', fontSize:'var(--text-sm)',
          color:'var(--text2)', fontWeight:'var(--font-medium)',
          marginBottom:'var(--space-1)',
        }}>
          {label}{required && <span style={{color:'var(--red)',marginLeft:2}}>*</span>}
        </label>
      )}
      <select value={value} onChange={onChange} required={required} style={{
        width:'100%', padding:'11px 14px',
        background:'var(--bg3)', border:'1px solid var(--border)',
        borderRadius:'var(--radius-sm)', color:'var(--text)',
        fontSize:'var(--text-base)', outline:'none', cursor:'pointer',
        ...style,
      }}>
        {children}
      </select>
    </div>
  );
}

// ── Toggle ────────────────────────────────────────────────────────────────────
export function Toggle({ checked, onChange, label, description }) {
  return (
    <label style={{
      display:'flex', alignItems:'center', justifyContent:'space-between',
      padding:'var(--space-3) var(--space-4)',
      background:'var(--bg3)', borderRadius:'var(--radius-md)',
      border:'1px solid var(--border)', cursor:'pointer',
      gap:'var(--space-4)',
    }}>
      <div>
        {label && <p style={{fontSize:'var(--text-base)',fontWeight:'var(--font-medium)',color:'var(--text)',marginBottom:description?2:0}}>{label}</p>}
        {description && <p style={{fontSize:'var(--text-xs)',color:'var(--text3)'}}>{description}</p>}
      </div>
      <div style={{position:'relative',width:40,height:22,flexShrink:0}} onClick={e=>{e.preventDefault();onChange(!checked);}}>
        <div style={{width:40,height:22,borderRadius:11,background:checked?'var(--indigo)':'var(--bg)',border:'1px solid var(--border)',transition:'background var(--transition)'}}/>
        <div style={{position:'absolute',top:2,left:checked?20:2,width:18,height:18,borderRadius:'50%',background:'#fff',transition:'left var(--transition)',boxShadow:'0 1px 3px rgba(0,0,0,0.25)'}}/>
      </div>
    </label>
  );
}

// ── Divider ───────────────────────────────────────────────────────────────────
export function Divider({ style={} }) {
  return <div style={{height:1,background:'var(--border)',margin:'var(--space-4) 0',...style}}/>;
}

// ── InfoBox ───────────────────────────────────────────────────────────────────
export function InfoBox({ children, variant='info', style={} }) {
  const variants = {
    info:    { bg:'var(--indigo-dim)', border:'rgba(124,127,247,0.2)', color:'var(--indigo)' },
    success: { bg:'var(--green-dim)',  border:'rgba(45,212,160,0.2)',  color:'var(--green)'  },
    warning: { bg:'var(--amber-dim)',  border:'rgba(245,166,35,0.2)',  color:'var(--amber)'  },
    danger:  { bg:'var(--red-dim)',    border:'rgba(240,94,110,0.2)',  color:'var(--red)'    },
  };
  const v = variants[variant] || variants.info;
  return (
    <div style={{
      background:v.bg, border:`1px solid ${v.border}`,
      borderRadius:'var(--radius-md)', padding:'var(--space-3) var(--space-4)',
      fontSize:'var(--text-sm)', color:'var(--text2)', lineHeight:1.6,
      ...style,
    }}>
      {children}
    </div>
  );
}

// ── PageShell ─────────────────────────────────────────────────────────────────
// Wrapper de página completo com Navbar
import Navbar from './Navbar';
export function PageShell({ children, maxWidth=800 }) {
  return (
    <div style={{minHeight:'100vh',background:'var(--bg)'}}>
      <Navbar/>
      <main className="page-main" style={{maxWidth,margin:'0 auto',padding:'var(--space-6) var(--space-4) 80px'}}>
        {children}
      </main>
    </div>
  );
}
