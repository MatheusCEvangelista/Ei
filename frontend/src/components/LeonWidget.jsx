import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

const LEON_STATES = {
  happy:     { img:'/leon/happy.png',     tip:'Finanças em dia! 😎',         pulse:'#2dd4a0' },
  neutral:   { img:'/leon/neutral.png',   tip:'Aqui pra te ajudar! 🦎',      pulse:'#a78bfa' },
  stressed:  { img:'/leon/stressed.png',  tip:'Preciso te contar algo...',    pulse:'#f05e6e' },
  analyzing: { img:'/leon/analyzing.png', tip:'Analisando seus dados...',     pulse:'#7c7ff7' },
  asking:    { img:'/leon/asking.png',    tip:'Me pergunte qualquer coisa!',  pulse:'#f5a623' },
};

const GREETING = {
  happy:    'Oi! Suas finanças estão indo bem 😎 O que quer saber?',
  neutral:  'Olá! Sou o Leon, seu guia financeiro 🦎 Pode perguntar qualquer coisa!',
  stressed: 'Ei! Vi algumas coisas que merecem atenção ⚠️ O que quer conferir?',
  analyzing:'Processando seus dados... 🔍',
  asking:   'Oi! O que você quer saber sobre suas finanças? 🟡',
};

export default function LeonWidget() {
  const [open,       setOpen]       = useState(false);
  const [state,      setState]      = useState('neutral');
  const [questions,  setQuestions]  = useState([]);
  const [messages,   setMessages]   = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [input,      setInput]      = useState('');
  const [showPreDef, setShowPreDef] = useState(true);
  const chatRef  = useRef();
  const inputRef = useRef();
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/api/leon/state').then(r => setState(r.data.state)).catch(()=>{});
    api.get('/api/leon/questions').then(r => setQuestions(r.data)).catch(()=>{});
  }, []);

  useEffect(() => {
    if (open && messages.length === 0)
      setMessages([{ from:'leon', text: GREETING[state] || GREETING.neutral }]);
  }, [open]);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  // Muda para estado "asking" quando o chat abre
  function handleOpen() {
    setOpen(v => {
      if (!v) setState(s => s === 'happy' || s === 'neutral' ? 'asking' : s);
      else setState(s => s === 'asking' ? 'neutral' : s);
      return !v;
    });
  }

  async function sendMessage({ question_id, message, label }) {
    if (loading) return;
    const userText = label || message;
    setMessages(prev => [...prev, { from:'user', text:userText }]);
    setLoading(true); setInput(''); setShowPreDef(false);
    setState('analyzing'); // Muda para analisando enquanto processa

    const history = messages.filter(m => !m.typing);
    setMessages(prev => [...prev, { from:'leon', text:'...', typing:true }]);

    try {
      const { data } = await api.post('/api/leon/ask', {
        question_id: question_id || 'free',
        message:     message || undefined,
        history,
      });
      setMessages(prev => [
        ...prev.filter(m => !m.typing),
        { from:'leon', text:data.answer, actions:data.actions||[] },
      ]);
      // Volta para o estado base após responder
      setState(s => s === 'analyzing' ? 'asking' : s);
    } catch(err) {
      const errMsg = err.response?.data?.error || 'Ops, problema técnico! Tenta de novo? 🦎';
      setMessages(prev => [...prev.filter(m => !m.typing), { from:'leon', text:errMsg }]);
      setState('neutral');
    }
    setLoading(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  function handleSendFree() {
    const text = input.trim();
    if (!text || loading) return;
    sendMessage({ message:text });
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendFree(); }
  }

  function handleAction(action) {
    if (action.type === 'navigate') { navigate(action.url); setOpen(false); }
  }

  function resetChat() {
    setMessages([{ from:'leon', text: GREETING[state] || GREETING.neutral }]);
    setInput(''); setShowPreDef(true);
    setState('asking');
  }

  const ls = LEON_STATES[state] || LEON_STATES.neutral;

  return (
    <>
      <style>{`
        @keyframes leon-pulse {
          0%,100%{box-shadow:0 0 0 0 ${ls.pulse}55;}
          50%{box-shadow:0 0 0 10px ${ls.pulse}00;}
        }
        @keyframes leon-bounce {
          0%,100%{transform:translateY(0);}
          50%{transform:translateY(-6px);}
        }
        @keyframes tdot {
          0%,80%,100%{transform:scale(0.4);opacity:0.3;}
          40%{transform:scale(1);opacity:1;}
        }
        @keyframes action-in {
          from{opacity:0;transform:translateY(6px);}
          to{opacity:1;transform:translateY(0);}
        }
        .leon-fab{bottom:28px;right:24px;}
        .leon-panel{bottom:108px;right:24px;width:340px;}
        .leon-bubble{bottom:108px;right:104px;}
        @media(max-width:820px){
          .leon-fab{bottom:calc(72px + env(safe-area-inset-bottom));right:16px;}
          .leon-panel{bottom:calc(150px + env(safe-area-inset-bottom));right:8px;left:8px;width:auto;}
          .leon-bubble{display:none;}
        }
      `}</style>

      {/* Balão desktop */}
      {!open && (
        <div className="leon-bubble" style={{position:'fixed',zIndex:48,background:'var(--bg2)',border:'1px solid var(--border-md)',borderRadius:'12px 12px 2px 12px',padding:'8px 14px',fontSize:12,color:'var(--text)',boxShadow:'var(--shadow)',maxWidth:190,lineHeight:1.4,pointerEvents:'none'}}>
          {ls.tip}
          <div style={{position:'absolute',bottom:-7,right:12,width:0,height:0,borderLeft:'7px solid transparent',borderTop:`7px solid var(--border-md)`}}/>
        </div>
      )}

      {/* Botão Leon */}
      <button className="leon-fab" onClick={handleOpen} title="Falar com Leon"
        style={{
          position:'fixed', zIndex:49,
          width:68, height:68, borderRadius:'50%',
          border:'3px solid var(--bg2)', cursor:'pointer',
          padding:0, overflow:'hidden', background:'transparent',
          animation: open?'none':'leon-bounce 2.5s ease-in-out infinite, leon-pulse 2s ease-in-out infinite',
          transition:'transform 0.2s', transform:open?'scale(1.08)':'scale(1)',
        }}>
        <img src={ls.img} alt="Leon" style={{width:'100%',height:'100%',objectFit:'cover',transition:'opacity 0.3s'}}/>
      </button>

      {/* Painel */}
      {open && (
        <div className="leon-panel fade-up" style={{position:'fixed',zIndex:49,maxHeight:'74vh',background:'var(--bg2)',border:'1px solid var(--border-md)',borderRadius:18,boxShadow:'0 8px 40px rgba(0,0,0,0.3)',display:'flex',flexDirection:'column',overflow:'hidden'}}>

          {/* Header */}
          <div style={{display:'flex',alignItems:'center',gap:10,padding:'12px 14px',borderBottom:'1px solid var(--border)',background:'var(--bg3)',flexShrink:0}}>
            <img src={ls.img} alt="Leon" style={{width:40,height:40,borderRadius:'50%',objectFit:'cover',border:'2px solid var(--border)',flexShrink:0,transition:'opacity 0.3s'}}/>
            <div style={{flex:1,minWidth:0}}>
              <p style={{fontSize:14,fontWeight:700,color:'var(--text)'}}>Leon</p>
              <p style={{fontSize:11,color:'var(--text3)'}}>Sua IA Financeira 🦎</p>
            </div>
            <button onClick={resetChat} title="Nova conversa" style={{width:28,height:28,borderRadius:7,border:'1px solid var(--border)',background:'transparent',color:'var(--text3)',cursor:'pointer',fontSize:14,flexShrink:0}}>↺</button>
            <button onClick={()=>{setOpen(false);setState(s=>s==='asking'?'neutral':s);}} style={{width:28,height:28,borderRadius:7,border:'1px solid var(--border)',background:'transparent',color:'var(--text3)',cursor:'pointer',fontSize:16,flexShrink:0}}>×</button>
          </div>

          {/* Mensagens */}
          <div ref={chatRef} style={{flex:1,overflowY:'auto',padding:'12px 12px 6px',display:'flex',flexDirection:'column',gap:8}}>
            {messages.map((msg,i) => (
              <div key={i}>
                <div style={{display:'flex',justifyContent:msg.from==='user'?'flex-end':'flex-start',gap:6,alignItems:'flex-end'}}>
                  {msg.from==='leon' && (
                    <img src={ls.img} alt="Leon" style={{width:26,height:26,borderRadius:'50%',objectFit:'cover',flexShrink:0}}/>
                  )}
                  <div style={{maxWidth:'80%',padding:'8px 11px',borderRadius:msg.from==='user'?'13px 13px 2px 13px':'13px 13px 13px 2px',background:msg.from==='user'?'var(--indigo)':'var(--bg3)',color:msg.from==='user'?'#fff':'var(--text)',fontSize:12,lineHeight:1.5,whiteSpace:'pre-line'}}>
                    {msg.typing ? (
                      <div style={{display:'flex',gap:3,padding:'2px 0'}}>
                        {[0,1,2].map(j=><span key={j} style={{width:5,height:5,borderRadius:'50%',background:'var(--text3)',display:'inline-block',animation:`tdot 1.2s ${j*0.2}s infinite`}}/>)}
                      </div>
                    ) : msg.text}
                  </div>
                </div>

                {msg.from==='leon' && msg.actions?.length>0 && (
                  <div style={{marginLeft:32,marginTop:6,display:'flex',flexWrap:'wrap',gap:5,animation:'action-in 0.3s ease forwards'}}>
                    {msg.actions.map((action,j) => (
                      <button key={j} onClick={()=>handleAction(action)}
                        style={{padding:'5px 12px',borderRadius:20,fontSize:11,fontWeight:500,border:'1px solid var(--indigo)',background:'var(--indigo-dim)',color:'var(--indigo)',cursor:'pointer',fontFamily:'var(--font)',transition:'all 0.15s',whiteSpace:'nowrap'}}
                        onMouseOver={e=>{e.currentTarget.style.background='var(--indigo)';e.currentTarget.style.color='#fff';}}
                        onMouseOut={e=>{e.currentTarget.style.background='var(--indigo-dim)';e.currentTarget.style.color='var(--indigo)';}}>
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Perguntas rápidas */}
          <div style={{borderTop:'1px solid var(--border)',flexShrink:0}}>
            <button onClick={()=>setShowPreDef(v=>!v)}
              style={{width:'100%',padding:'7px 12px',background:'var(--bg3)',border:'none',cursor:'pointer',fontSize:11,color:'var(--text3)',fontFamily:'var(--font)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <span>💬 Perguntas rápidas</span>
              <span>{showPreDef?'▲':'▼'}</span>
            </button>
            {showPreDef && (
              <div style={{padding:'6px 10px 8px',display:'flex',flexDirection:'column',gap:4,maxHeight:150,overflowY:'auto',background:'var(--bg3)'}}>
                {questions.map(q=>(
                  <button key={q.id} onClick={()=>sendMessage({question_id:q.id,label:q.label})} disabled={loading}
                    style={{padding:'6px 10px',borderRadius:8,textAlign:'left',border:'1px solid var(--border)',background:'var(--bg2)',color:'var(--text)',fontSize:11,fontFamily:'var(--font)',cursor:loading?'wait':'pointer',transition:'all 0.15s',opacity:loading?0.5:1}}
                    onMouseOver={e=>{if(!loading){e.currentTarget.style.background='var(--indigo-dim)';e.currentTarget.style.color='var(--indigo)';e.currentTarget.style.borderColor='var(--indigo)';}}}
                    onMouseOut={e=>{e.currentTarget.style.background='var(--bg2)';e.currentTarget.style.color='var(--text)';e.currentTarget.style.borderColor='var(--border)';}}>
                    {q.label}
                  </button>
                ))}
              </div>
            )}

            {/* Campo livre */}
            <div style={{display:'flex',gap:6,padding:'8px 10px',background:'var(--bg2)'}}>
              <input ref={inputRef} type="text" value={input}
                onChange={e=>setInput(e.target.value)} onKeyDown={handleKeyDown} disabled={loading}
                placeholder="Ou pergunte qualquer coisa..."
                style={{flex:1,padding:'8px 12px',borderRadius:10,border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text)',fontSize:12,fontFamily:'var(--font)',outline:'none',opacity:loading?0.6:1}}
                onFocus={e=>e.target.style.borderColor='var(--indigo)'}
                onBlur={e=>e.target.style.borderColor='var(--border)'}/>
              <button onClick={handleSendFree} disabled={loading||!input.trim()}
                style={{width:36,height:36,borderRadius:10,border:'none',background:input.trim()&&!loading?'var(--indigo)':'var(--bg3)',color:input.trim()&&!loading?'#fff':'var(--text3)',cursor:input.trim()&&!loading?'pointer':'default',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.2s',flexShrink:0}}>
                {loading?'⏳':'↑'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
