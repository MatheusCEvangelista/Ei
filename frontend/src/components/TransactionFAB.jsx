import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import TransactionModal from './TransactionModal';

const HIDDEN_ON = ['/login'];

export default function TransactionFAB() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState(null);
  const location = useLocation();
  if (HIDDEN_ON.includes(location.pathname)) return null;

  return (
    <>
      <style>{`
        @keyframes fab-bounce { 0%,100%{transform:scale(1);}50%{transform:scale(1.07);} }
        @keyframes fab-menu-in { from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);} }
        .ei-fab { position:fixed;bottom:28px;left:24px;z-index:47;width:52px;height:52px;border-radius:50%;border:none;cursor:pointer;background:linear-gradient(135deg,#7c3aed,#a78bfa);color:#fff;font-size:24px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(124,58,237,0.45);transition:transform 0.2s,box-shadow 0.2s;animation:fab-bounce 3s ease-in-out infinite; }
        .ei-fab:hover { transform:scale(1.1)!important;box-shadow:0 6px 28px rgba(124,58,237,0.55);animation:none; }
        .ei-fab.open { transform:rotate(45deg)!important;animation:none; }
        .ei-fab-menu { position:fixed;bottom:92px;left:24px;z-index:47;display:flex;flex-direction:column;gap:8px;animation:fab-menu-in 0.2s ease; }
        .ei-fab-opt { display:flex;align-items:center;gap:10px;padding:10px 16px;border-radius:12px;border:none;cursor:pointer;font-size:13px;font-weight:600;box-shadow:0 4px 16px rgba(0,0,0,0.15);white-space:nowrap;transition:transform 0.15s; }
        .ei-fab-opt:hover { transform:translateX(4px); }
        @media(max-width:820px){
          .ei-fab{bottom:calc(80px + env(safe-area-inset-bottom));left:16px;width:48px;height:48px;font-size:22px;}
          .ei-fab-menu{bottom:calc(140px + env(safe-area-inset-bottom));left:16px;}
        }
      `}</style>

      {open && !type && (
        <>
          <div style={{position:'fixed',inset:0,zIndex:46}} onClick={()=>setOpen(false)}/>
          <div className="ei-fab-menu">
            <button className="ei-fab-opt" onClick={()=>setType('income')} style={{background:'var(--green-dim)',color:'var(--green)',border:'1px solid rgba(45,212,160,0.25)'}}>
              <span style={{fontSize:18}}>↑</span> Nova receita
            </button>
            <button className="ei-fab-opt" onClick={()=>setType('expense')} style={{background:'var(--red-dim)',color:'var(--red)',border:'1px solid rgba(240,94,110,0.25)'}}>
              <span style={{fontSize:18}}>↓</span> Nova despesa
            </button>
          </div>
        </>
      )}

      <button className={`ei-fab${open?' open':''}`} onClick={()=>setOpen(v=>!v)} title="Nova transação">+</button>

      {open && type && (
        <TransactionModal
          defaultType={type}
          onSave={()=>{setOpen(false);setType(null);window.dispatchEvent(new CustomEvent('ei:transaction-saved'));}}
          onClose={()=>{setOpen(false);setType(null);}}
        />
      )}
    </>
  );
}
