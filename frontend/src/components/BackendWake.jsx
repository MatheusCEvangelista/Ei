// Pinga o backend ao abrir o app para acordar o Render free tier
// Mostra um aviso discreto enquanto aguarda
import { useState, useEffect } from 'react';
import api from '../lib/api';

export default function BackendWake() {
  const [status, setStatus] = useState('idle'); // idle | waking | ready

  useEffect(() => {
    const start = Date.now();
    setStatus('waking');

    api.get('/api/health')
      .then(() => {
        const elapsed = Date.now() - start;
        // Se respondeu rápido, já estava acordado — não mostra nada
        if (elapsed < 800) setStatus('idle');
        else setStatus('ready');
        setTimeout(() => setStatus('idle'), 2000);
      })
      .catch(() => {
        // Tenta de novo em 5s
        setTimeout(() => {
          api.get('/api/health')
            .then(() => { setStatus('ready'); setTimeout(() => setStatus('idle'), 2000); })
            .catch(() => setStatus('idle'));
        }, 5000);
      });
  }, []);

  if (status === 'idle') return null;

  return (
    <>
      <style>{`
        @keyframes wake-in {
          from{opacity:0;transform:translateY(8px);}
          to{opacity:1;transform:translateY(0);}
        }
        @keyframes wake-dot {
          0%,80%,100%{opacity:0.3;}50%{opacity:1;}
        }
      `}</style>
      <div style={{
        position:'fixed', bottom:90, left:'50%', transform:'translateX(-50%)',
        zIndex:45, background:'var(--bg2)', border:'1px solid var(--border-md)',
        borderRadius:'var(--radius-full)', padding:'8px 18px',
        boxShadow:'var(--shadow)', display:'flex', alignItems:'center', gap:10,
        fontSize:'var(--text-xs)', color:'var(--text3)',
        animation:'wake-in 0.3s ease forwards', whiteSpace:'nowrap',
      }}>
        {status === 'waking' ? (
          <>
            <span style={{display:'flex',gap:3}}>
              {[0,1,2].map(i => (
                <span key={i} style={{width:4,height:4,borderRadius:'50%',background:'var(--indigo)',display:'inline-block',animation:`wake-dot 1.2s ${i*0.2}s infinite`}}/>
              ))}
            </span>
            Acordando o servidor...
          </>
        ) : (
          <>
            <span style={{color:'var(--green)'}}>✓</span>
            Servidor pronto!
          </>
        )}
      </div>
    </>
  );
}
