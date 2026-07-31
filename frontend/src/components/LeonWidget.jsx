import { useState, useEffect, useRef } from 'react';
import api from '../lib/api';

// Estados do Leon — mapeiam para quadrantes da imagem 2x2
// Top-left: verde/óculos (happy) | Top-right: amarelo (curious)
// Bottom-left: vermelho (stressed) | Bottom-right: cinza/lupa (analyzing)
const LEON_STATES = {
  happy:     { pos:'0% 0%',     tip:'Finanças em dia! 😎',   pulse:'var(--green)'  },
  curious:   { pos:'100% 0%',   tip:'Aqui pra te ajudar! 🦎', pulse:'var(--amber)'  },
  stressed:  { pos:'0% 100%',   tip:'Preciso te contar algo...', pulse:'var(--red)' },
  analyzing: { pos:'100% 100%', tip:'Analisando seus dados...', pulse:'var(--indigo)'},
};

const GREETING = {
  happy:    'Oi! Suas finanças estão indo bem 😎 O que quer saber?',
  curious:  'Olá! Sou o Leon, seu guia financeiro 🦎 Como posso ajudar?',
  stressed: 'Ei! Vi algumas coisas que merecem atenção ⚠️ Veja o que encontrei:',
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
    // Carrega estado e perguntas disponíveis
    api.get('/api/leon/state').then(r => setState(r.data.state)).catch(()=>{});
    api.get('/api/leon/questions').then(r => setQuestions(r.data)).catch(()=>{});
  }, []);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{ from:'leon', text: GREETING[state] || GREETING.curious }]);
    }
  }, [open]);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  async function handleQuestion(q) {
    if (loading) return;
    setAsked(q.id);
    setMessages(prev => [...prev, { from:'user', text: q.label }]);
    setLoading(true);
    // Leon "digitando"
    setMessages(prev => [...prev, { from:'leon', text:'...', typing:true }]);
    try {
      const { data } = await api.post('/api/leon/ask', { question_id: q.id });
      setMessages(prev => [...prev.filter(m=>!m.typing), { from:'leon', text: data.answer }]);
    } catch {
      setMessages(prev => [...prev.filter(m=>!m.typing), { from:'leon', text:'Ops, tive um problema técnico! Tenta de novo? 🦎' }]);
    }
    setLoading(false);
    setAsked(null);
  }

  function resetChat() {
    setMessages([{ from:'leon', text: GREETING[state] || GREETING.curious }]);
    setAsked(null);
  }

  const leonState = LEON_STATES[state] || LEON_STATES.curious;

  return (
    <>
      <style>{`
        @keyframes leon-pulse {
          0%,100% { box-shadow: 0 0 0 0 ${leonState.pulse}44; }
          50%      { box-shadow: 0 0 0 8px ${leonState.pulse}00; }
        }
        @keyframes leon-bounce {
          0%,100% { transform: translateY(0); }
          50%      { transform: translateY(-4px); }
        }
        @keyframes typing-dot {
          0%,80%,100% { transform:scale(0); opacity:0.3; }
          40%          { transform:scale(1); opacity:1; }
        }
        .leon-btn { animation: leon-bounce 2.5s ease-in-out infinite, leon-pulse 2s ease-in-out infinite; }
        .leon-btn:hover { animation: none; transform: scale(1.08); }
      `}</style>

      {/* Balão de fala quando fechado */}
      {!open && (
        <div style={{
          position:'fixed', bottom:100, right:24, zIndex:49,
          background:'var(--bg2)', border:'1px solid var(--border-md)',
          borderRadius:'12px 12px 2px 12px', padding:'8px 14px',
          fontSize:12, color:'var(--text)', boxShadow:'var(--shadow)',
          maxWidth:180, lineHeight:1.4, pointerEvents:'none',
          animation:'fadeUp 0.3s ease forwards',
        }}>
          {leonState.tip}
          <div style={{position:'absolute',bottom:-8,right:10,width:0,height:0,borderLeft:'8px solid transparent',borderTop:`8px solid var(--border-md)`}}/>
        </div>
      )}

      {/* Botão do Leon */}
      <button
        className="leon-btn"
        onClick={() => setOpen(v => !v)}
        title="Falar com Leon"
        style={{
          position:'fixed', bottom:24, right:24, zIndex:50,
          width:68, height:68, borderRadius:'50%', border:'3px solid var(--bg2)',
          cursor:'pointer', padding:0, overflow:'hidden',
          backgroundImage:'url(/leon.png)',
          backgroundSize:'200% 200%',
          backgroundPosition: leonState.pos,
          backgroundRepeat:'no-repeat',
          transition:'transform 0.2s, background-position 0.4s',
        }}
      />

      {/* Chat panel */}
      {open && (
        <div style={{
          position:'fixed', bottom:104, right:24, zIndex:50,
          width:320, maxHeight:480,
          background:'var(--bg2)', border:'1px solid var(--border-md)',
          borderRadius:18, boxShadow:'0 8px 40px rgba(0,0,0,0.35)',
          display:'flex', flexDirection:'column', overflow:'hidden',
        }} className="fade-up">

          {/* Header */}
          <div style={{display:'flex',alignItems:'center',gap:10,padding:'14px 16px',borderBottom:'1px solid var(--border)',background:'var(--bg3)'}}>
            <div style={{
              width:40, height:40, borderRadius:'50%', flexShrink:0,
              backgroundImage:'url(/leon.png)', backgroundSize:'200% 200%',
              backgroundPosition: leonState.pos, border:'2px solid var(--border-md)',
            }}/>
            <div>
              <p style={{fontSize:14,fontWeight:700,color:'var(--text)'}}>Leon</p>
              <p style={{fontSize:11,color:'var(--text3)'}}>Seu guia financeiro 🦎</p>
            </div>
            <div style={{marginLeft:'auto',display:'flex',gap:6}}>
              <button onClick={resetChat} title="Reiniciar conversa"
                style={{width:28,height:28,borderRadius:7,border:'1px solid var(--border)',background:'transparent',color:'var(--text3)',cursor:'pointer',fontSize:14}}>
                ↺
              </button>
              <button onClick={()=>setOpen(false)}
                style={{width:28,height:28,borderRadius:7,border:'1px solid var(--border)',background:'transparent',color:'var(--text3)',cursor:'pointer',fontSize:16}}>
                ×
              </button>
            </div>
          </div>

          {/* Mensagens */}
          <div ref={chatRef} style={{flex:1,overflowY:'auto',padding:'14px 14px 8px',display:'flex',flexDirection:'column',gap:10}}>
            {messages.map((msg, i) => (
              <div key={i} style={{display:'flex',justifyContent:msg.from==='user'?'flex-end':'flex-start',gap:8,alignItems:'flex-end'}}>
                {msg.from==='leon' && (
                  <div style={{width:28,height:28,borderRadius:'50%',flexShrink:0,backgroundImage:'url(/leon.png)',backgroundSize:'200% 200%',backgroundPosition:leonState.pos}}/>
                )}
                <div style={{
                  maxWidth:'75%', padding:'9px 12px', borderRadius:msg.from==='user'?'14px 14px 2px 14px':'14px 14px 14px 2px',
                  background:msg.from==='user'?'var(--indigo)':'var(--bg3)',
                  color:msg.from==='user'?'#fff':'var(--text)',
                  fontSize:13, lineHeight:1.5,
                }}>
                  {msg.typing ? (
                    <div style={{display:'flex',gap:4,padding:'2px 0'}}>
                      {[0,1,2].map(j=>(
                        <span key={j} style={{width:6,height:6,borderRadius:'50%',background:'var(--text3)',display:'inline-block',animation:`typing-dot 1.2s ${j*0.2}s infinite`}}/>
                      ))}
                    </div>
                  ) : msg.text}
                </div>
              </div>
            ))}
          </div>

          {/* Perguntas pré-definidas */}
          <div style={{padding:'8px 14px 14px',borderTop:'1px solid var(--border)',display:'flex',flexDirection:'column',gap:6}}>
            <p style={{fontSize:10,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:2}}>Pergunte ao Leon:</p>
            <div style={{display:'flex',flexDirection:'column',gap:5,maxHeight:180,overflowY:'auto'}}>
              {questions.map(q => (
                <button key={q.id} onClick={()=>handleQuestion(q)} disabled={loading}
                  style={{
                    padding:'8px 12px', borderRadius:9, textAlign:'left',
                    border:`1px solid ${asked===q.id?'var(--indigo)':'var(--border)'}`,
                    background:asked===q.id?'var(--indigo-dim)':'var(--bg3)',
                    color:asked===q.id?'var(--indigo)':'var(--text)',
                    fontSize:12, fontFamily:'var(--font)', cursor:loading?'wait':'pointer',
                    transition:'all 0.15s', opacity:loading&&asked!==q.id?0.5:1,
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
