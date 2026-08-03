import { useState, useEffect, useRef } from 'react';
import api from '../lib/api';

const LEON_STATES = {
  happy:     { pos:'0% 0%',     tip:'Finanças em dia! 😎',         pulse:'#2dd4a0' },
  curious:   { pos:'100% 0%',   tip:'Aqui pra te ajudar! 🦎',      pulse:'#f5a623' },
  stressed:  { pos:'0% 100%',   tip:'Preciso te contar algo...',    pulse:'#f05e6e' },
  analyzing: { pos:'100% 100%', tip:'Analisando seus dados...',     pulse:'#7c7ff7' },
};

const GREETING = {
  happy:    'Oi! Suas finanças estão indo bem 😎 O que quer saber?',
  curious:  'Olá! Sou o Leon, seu guia financeiro 🦎 Como posso ajudar?',
  stressed: 'Ei! Vi algumas coisas que merecem atenção ⚠️ O que quer conferir?',
  analyzing:'Deixa eu dar uma olhada nos seus dados... 🔍',
};

export default function LeonWidget() {
  const [open,      setOpen]      = useState(false);
  const [state,     setState]     = useState('curious');
  const [questions, setQuestions] = useState([]);
  const [messages,  setMessages]  = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [asked,     setAsked]     = useState(null);
  const chatRef = useRef();

  useEffect(() => {
    api.get('/api/leon/state').then(r => setState(r.data.state)).catch(()=>{});
    api.get('/api/leon/questions').then(r => setQuestions(r.data)).catch(()=>{});
  }, []);

  useEffect(() => {
    if (open && messages.length === 0)
      setMessages([{ from:'leon', text: GREETING[state] || GREETING.curious }]);
  }, [open]);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  async function handleQuestion(q) {
    if (loading) return;
    setAsked(q.id);
    setMessages(prev => [...prev, { from:'user', text: q.label }]);
    setLoading(true);
    setMessages(prev => [...prev, { from:'leon', text:'...', typing:true }]);
    try {
      const { data } = await api.post('/api/leon/ask', { question_id: q.id });
      setMessages(prev => [...prev.filter(m=>!m.typing), { from:'leon', text: data.answer }]);
    } catch {
      setMessages(prev => [...prev.filter(m=>!m.typing), { from:'leon', text:'Ops, tive um problema! Tenta de novo? 🦎' }]);
    }
    setLoading(false);
    setAsked(null);
  }

  function resetChat() {
    setMessages([{ from:'leon', text: GREETING[state] || GREETING.curious }]);
    setAsked(null);
  }

  const ls = LEON_STATES[state] || LEON_STATES.curious;

  return (
    <>
      <style>{`
        @keyframes leon-pulse {
          0%,100% { box-shadow: 0 0 0 0 ${ls.pulse}55; }
          50%      { box-shadow: 0 0 0 10px ${ls.pulse}00; }
        }
        @keyframes leon-bounce {
          0%,100% { transform: translateY(0); }
          50%      { transform: translateY(-5px); }
        }
        @keyframes tdot {
          0%,80%,100% { transform:scale(0.4); opacity:0.3; }
          40%          { transform:scale(1);   opacity:1; }
        }
        /* Desktop: acima do canto inferior direito */
        .leon-fab { bottom: 28px; right: 24px; }
        .leon-chat-panel { bottom: 108px; right: 24px; width: 320px; }
        .leon-bubble { bottom: 104px; right: 98px; }

        /* Mobile: acima da bottom nav (≈64px) */
        @media (max-width: 820px) {
          .leon-fab { bottom: calc(72px + env(safe-area-inset-bottom)); right: 16px; }
          .leon-chat-panel { bottom: calc(150px + env(safe-area-inset-bottom)); right: 8px; left: 8px; width: auto; max-width: 100%; }
          .leon-bubble { display: none; }
        }
      `}</style>

      {/* Balão de fala (só desktop) */}
      {!open && (
        <div className="leon-bubble" style={{
          position:'fixed', zIndex:48,
          background:'var(--bg2)', border:'1px solid var(--border-md)',
          borderRadius:'12px 12px 2px 12px', padding:'8px 14px',
          fontSize:12, color:'var(--text)', boxShadow:'var(--shadow)',
          maxWidth:180, lineHeight:1.4, pointerEvents:'none',
        }}>
          {ls.tip}
          <div style={{position:'absolute',bottom:-7,right:12,width:0,height:0,borderLeft:'7px solid transparent',borderTop:`7px solid var(--border-md)`}}/>
        </div>
      )}

      {/* Botão do Leon */}
      <button
        className="leon-fab"
        onClick={() => setOpen(v => !v)}
        title="Falar com Leon"
        style={{
          position:'fixed', zIndex:49,
          width:62, height:62, borderRadius:'50%',
          border:'3px solid var(--bg2)',
          cursor:'pointer', padding:0, overflow:'hidden',
          backgroundImage:'url(/leon.png)',
          backgroundSize:'200% 200%',
          backgroundPosition: ls.pos,
          backgroundRepeat:'no-repeat',
          animation: open ? 'none' : 'leon-bounce 2.5s ease-in-out infinite, leon-pulse 2s ease-in-out infinite',
          transition:'transform 0.2s, background-position 0.4s',
          transform: open ? 'scale(1.08)' : 'scale(1)',
        }}
      />

      {/* Painel de chat */}
      {open && (
        <div className="leon-chat-panel fade-up" style={{
          position:'fixed', zIndex:49,
          maxHeight:'60vh',
          background:'var(--bg2)', border:'1px solid var(--border-md)',
          borderRadius:18, boxShadow:'0 8px 40px rgba(0,0,0,0.3)',
          display:'flex', flexDirection:'column', overflow:'hidden',
        }}>

          {/* Header */}
          <div style={{display:'flex',alignItems:'center',gap:10,padding:'12px 14px',borderBottom:'1px solid var(--border)',background:'var(--bg3)',flexShrink:0}}>
            <div style={{width:36,height:36,borderRadius:'50%',flexShrink:0,backgroundImage:'url(/leon.png)',backgroundSize:'200% 200%',backgroundPosition:ls.pos,border:'2px solid var(--border)'}}/>
            <div style={{flex:1,minWidth:0}}>
              <p style={{fontSize:14,fontWeight:700,color:'var(--text)'}}>Leon</p>
              <p style={{fontSize:11,color:'var(--text3)'}}>Guia financeiro 🦎</p>
            </div>
            <button onClick={resetChat} title="Reiniciar" style={{width:28,height:28,borderRadius:7,border:'1px solid var(--border)',background:'transparent',color:'var(--text3)',cursor:'pointer',fontSize:14,flexShrink:0}}>↺</button>
            <button onClick={()=>setOpen(false)} style={{width:28,height:28,borderRadius:7,border:'1px solid var(--border)',background:'transparent',color:'var(--text3)',cursor:'pointer',fontSize:16,flexShrink:0}}>×</button>
          </div>

          {/* Mensagens */}
          <div ref={chatRef} style={{flex:1,overflowY:'auto',padding:'12px 12px 6px',display:'flex',flexDirection:'column',gap:8}}>
            {messages.map((msg,i) => (
              <div key={i} style={{display:'flex',justifyContent:msg.from==='user'?'flex-end':'flex-start',gap:6,alignItems:'flex-end'}}>
                {msg.from==='leon' && (
                  <div style={{width:24,height:24,borderRadius:'50%',flexShrink:0,backgroundImage:'url(/leon.png)',backgroundSize:'200% 200%',backgroundPosition:ls.pos}}/>
                )}
                <div style={{
                  maxWidth:'78%',padding:'8px 11px',
                  borderRadius:msg.from==='user'?'13px 13px 2px 13px':'13px 13px 13px 2px',
                  background:msg.from==='user'?'var(--indigo)':'var(--bg3)',
                  color:msg.from==='user'?'#fff':'var(--text)',
                  fontSize:12,lineHeight:1.5,whiteSpace:'pre-line',
                }}>
                  {msg.typing ? (
                    <div style={{display:'flex',gap:3,padding:'2px 0'}}>
                      {[0,1,2].map(j=><span key={j} style={{width:5,height:5,borderRadius:'50%',background:'var(--text3)',display:'inline-block',animation:`tdot 1.2s ${j*0.2}s infinite`}}/>)}
                    </div>
                  ) : msg.text}
                </div>
              </div>
            ))}
          </div>

          {/* Perguntas */}
          <div style={{padding:'8px 12px 12px',borderTop:'1px solid var(--border)',flexShrink:0}}>
            <p style={{fontSize:10,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:6}}>Pergunte ao Leon:</p>
            <div style={{display:'flex',flexDirection:'column',gap:4,maxHeight:160,overflowY:'auto'}}>
              {questions.map(q => (
                <button key={q.id} onClick={()=>handleQuestion(q)} disabled={loading}
                  style={{
                    padding:'7px 11px',borderRadius:8,textAlign:'left',
                    border:`1px solid ${asked===q.id?'var(--indigo)':'var(--border)'}`,
                    background:asked===q.id?'var(--indigo-dim)':'var(--bg3)',
                    color:asked===q.id?'var(--indigo)':'var(--text)',
                    fontSize:12,fontFamily:'var(--font)',cursor:loading?'wait':'pointer',
                    transition:'all 0.15s',opacity:loading&&asked!==q.id?0.5:1,
                  }}>
                  {q.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
