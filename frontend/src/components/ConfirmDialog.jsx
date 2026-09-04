// ConfirmDialog — substitui o window.confirm() nativo
// Uso via hook: const { confirm, ConfirmDialog } = useConfirm()
// <ConfirmDialog/> deve ser renderizado na página
// await confirm({ title, message, confirmLabel, variant }) → true/false

import { useState, useCallback } from 'react';

export function useConfirm() {
  const [state, setState] = useState(null); // { title, message, confirmLabel, variant, resolve }

  const confirm = useCallback((opts) => {
    return new Promise(resolve => {
      setState({ ...opts, resolve });
    });
  }, []);

  function handleConfirm() { state?.resolve(true);  setState(null); }
  function handleCancel()  { state?.resolve(false); setState(null); }

  const VARIANTS = {
    danger:  { color:'var(--red)',    bg:'var(--red-dim)',    label:'Excluir'    },
    warning: { color:'var(--amber)',  bg:'var(--amber-dim)',  label:'Confirmar'  },
    info:    { color:'var(--indigo)', bg:'var(--indigo-dim)', label:'Confirmar'  },
  };

  function Dialog() {
    if (!state) return null;
    const v = VARIANTS[state.variant||'danger'];

    return (
      <>
        <style>{`
          @keyframes confirm-in {
            from{opacity:0;transform:scale(0.92) translateY(8px);}
            to{opacity:1;transform:scale(1) translateY(0);}
          }
        `}</style>
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100,padding:'var(--space-4)'}}>
          <div style={{background:'var(--bg2)',border:'1px solid var(--border-md)',borderRadius:'var(--radius-xl)',width:'100%',maxWidth:380,padding:'var(--space-6)',boxShadow:'0 20px 60px rgba(0,0,0,0.3)',animation:'confirm-in 0.2s ease forwards'}}>

            {/* Ícone */}
            <div style={{width:48,height:48,borderRadius:'var(--radius-lg)',background:v.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,marginBottom:'var(--space-4)'}}>
              {state.icon || (state.variant==='danger'?'🗑️':state.variant==='warning'?'⚠️':'ℹ️')}
            </div>

            {/* Texto */}
            <h3 style={{fontSize:'var(--text-lg)',fontWeight:'var(--font-semibold)',color:'var(--text)',marginBottom:'var(--space-2)'}}>{state.title||'Confirmar ação'}</h3>
            <p style={{fontSize:'var(--text-sm)',color:'var(--text3)',lineHeight:1.6,marginBottom:'var(--space-5)'}}>{state.message||'Tem certeza que deseja continuar? Esta ação não pode ser desfeita.'}</p>

            {/* Botões */}
            <div style={{display:'flex',gap:'var(--space-2)'}}>
              <button onClick={handleCancel}
                style={{flex:1,padding:'11px',borderRadius:'var(--radius-md)',border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text2)',fontSize:'var(--text-sm)',fontWeight:'var(--font-medium)',cursor:'pointer',fontFamily:'var(--font)',transition:'all var(--transition)'}}
                onMouseOver={e=>e.currentTarget.style.background='var(--border)'}
                onMouseOut={e=>e.currentTarget.style.background='var(--bg3)'}>
                {state.cancelLabel||'Cancelar'}
              </button>
              <button onClick={handleConfirm}
                style={{flex:1,padding:'11px',borderRadius:'var(--radius-md)',border:'none',background:v.color,color:'#fff',fontSize:'var(--text-sm)',fontWeight:'var(--font-semibold)',cursor:'pointer',fontFamily:'var(--font)',transition:'filter var(--transition)'}}
                onMouseOver={e=>e.currentTarget.style.filter='brightness(1.1)'}
                onMouseOut={e=>e.currentTarget.style.filter='none'}>
                {state.confirmLabel||v.label}
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return { confirm, ConfirmDialog: Dialog };
}
