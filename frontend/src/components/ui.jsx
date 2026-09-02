// ── Modal base ────────────────────────────────────────────────────────────
// Wrapper de modal com overlay, animação, ESC e click-fora para fechar
import { useEffect } from 'react';

export function Modal({ children, onClose, maxWidth=480, position='center', style={} }) {
  // Fecha com ESC
  useEffect(() => {
    function handle(e) { if (e.key === 'Escape') onClose?.(); }
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [onClose]);

  const isBottom = position === 'bottom';

  return (
    <div
      style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',backdropFilter:'blur(4px)',display:'flex',alignItems:isBottom?'flex-end':'center',justifyContent:'center',zIndex:50,padding:'var(--space-4)'}}
      onClick={onClose}>
      <div
        style={{
          background:'var(--bg2)', border:'1px solid var(--border-md)',
          borderRadius: isBottom ? 'var(--radius-xl) var(--radius-xl) 0 0' : 'var(--radius-xl)',
          width:'100%', maxWidth,
          padding: isBottom ? '8px 22px 32px' : 'var(--space-5)',
          maxHeight:'90vh', overflowY:'auto',
          boxShadow:'var(--shadow)',
          animation:'fadeUp 0.25s ease forwards',
          ...style,
        }}
        onClick={e=>e.stopPropagation()}>
        {isBottom && <div style={{width:36,height:4,borderRadius:2,background:'var(--bg3)',margin:'10px auto 20px'}}/>}
        {children}
      </div>
    </div>
  );
}

// ── ModalHeader ───────────────────────────────────────────────────────────
export function ModalHeader({ title, subtitle, onClose }) {
  return (
    <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'var(--space-4)'}}>
      <div>
        <h2 style={{fontSize:'var(--text-lg)',fontWeight:'var(--font-semibold)',color:'var(--text)'}}>{title}</h2>
        {subtitle && <p style={{fontSize:'var(--text-xs)',color:'var(--text3)',marginTop:'var(--space-1)'}}>{subtitle}</p>}
      </div>
      {onClose && (
        <button onClick={onClose} style={{width:28,height:28,borderRadius:'var(--radius-sm)',border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text2)',cursor:'pointer',fontSize:16,flexShrink:0}}>×</button>
      )}
    </div>
  );
}

// ── Componentes Adicionados para Resolver o Build ─────────────────────────

export function Button({ children, variant = 'primary', style = {}, ...props }) {
  const isPrimary = variant === 'primary';
  return (
    <button
      style={{
        padding: '10px 16px',
        borderRadius: 'var(--radius-md, 8px)',
        border: isPrimary ? 'none' : '1px solid var(--border)',
        background: isPrimary ? 'var(--accent, #6366f1)' : 'var(--bg3)',
        color: isPrimary ? '#fff' : 'var(--text)',
        fontWeight: 500,
        fontSize: 13,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  );
}

export function InfoBox({ children, style = {} }) {
  return (
    <div
      style={{
        padding: '10px 12px',
        borderRadius: 'var(--radius-md, 8px)',
        background: 'var(--bg3)',
        border: '1px solid var(--border)',
        fontSize: 12,
        color: 'var(--text2)',
        lineHeight: 1.4,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function SectionLabel({ children, style = {} }) {
  return (
    <label
      style={{
        display: 'block',
        fontSize: 12,
        fontWeight: 600,
        color: 'var(--text3)',
        marginBottom: 6,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        ...style,
      }}
    >
      {children}
    </label>
  );
}