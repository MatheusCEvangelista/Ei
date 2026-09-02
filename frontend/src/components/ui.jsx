
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
