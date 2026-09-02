import { useRef, useState } from 'react';

export default function SwipeableRow({ children, onEdit, onDelete, disabled = false }) {
  const [offset,   setOffset]   = useState(0);
  const [swiping,  setSwiping]  = useState(false);
  const [revealed, setRevealed] = useState(false);
  const startX  = useRef(0);
  const startY  = useRef(0);
  const isDrag  = useRef(false);

  const ACTION_W  = onEdit && onDelete ? 140 : 72;
  const THRESHOLD = 60;

  function onTouchStart(e) {
    if (disabled) return;
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    isDrag.current = false;
    setSwiping(true);
  }

  function onTouchMove(e) {
    if (disabled || !swiping) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;
    if (!isDrag.current && Math.abs(dy) > Math.abs(dx)) { setSwiping(false); return; }
    isDrag.current = true;
    e.preventDefault();
    const base    = revealed ? -ACTION_W : 0;
    const clamped = Math.max(-ACTION_W - 10, Math.min(8, base + dx));
    setOffset(clamped);
  }

  function onTouchEnd() {
    if (!swiping) return;
    setSwiping(false);
    if (offset < -THRESHOLD) { setOffset(-ACTION_W); setRevealed(true); }
    else                      { setOffset(0);         setRevealed(false); }
  }

  function close() { setOffset(0); setRevealed(false); }

  return (
    <div style={{position:'relative',overflow:'hidden',borderRadius:'var(--radius-md)'}}>
      {/* Botões de ação */}
      <div style={{position:'absolute',right:0,top:0,bottom:0,width:ACTION_W,display:'flex',alignItems:'stretch'}}>
        {onEdit && (
          <button onPointerUp={()=>{close();onEdit();}} style={{flex:1,border:'none',cursor:'pointer',background:'var(--indigo)',color:'#fff',fontSize:'var(--text-xs)',fontWeight:'var(--font-semibold)',fontFamily:'var(--font)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:3}}>
            <span style={{fontSize:16}}>✏️</span><span>Editar</span>
          </button>
        )}
        {onDelete && (
          <button onPointerUp={()=>{close();onDelete();}} style={{flex:1,border:'none',cursor:'pointer',background:'var(--red)',color:'#fff',fontSize:'var(--text-xs)',fontWeight:'var(--font-semibold)',fontFamily:'var(--font)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:3}}>
            <span style={{fontSize:16}}>🗑️</span><span>Excluir</span>
          </button>
        )}
      </div>

      {/* Conteúdo deslizante */}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={revealed ? close : undefined}
        style={{transform:`translateX(${offset}px)`,transition:swiping?'none':'transform 0.28s cubic-bezier(0.25,0.46,0.45,0.94)',position:'relative',zIndex:1,background:'var(--bg2)',userSelect:'none',WebkitUserSelect:'none'}}>
        {children}
      </div>
    </div>
  );
}
