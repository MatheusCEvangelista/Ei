import { useState, useEffect, useCallback, useRef } from 'react';
import { ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer } from 'recharts';
import { PageShell, Card, Button, SectionLabel, InfoBox, Badge } from '../components/ui';
import api from '../lib/api';

const fmt    = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const LEON_CONFIG = {
  images: { happy:'/leon/happy.png', neutral:'/leon/neutral.png', stressed:'/leon/stressed.png', analyzing:'/leon/analyzing.png', asking:'/leon/asking.png' },
  stateFor: (balance, analyzing) => {
    if (analyzing)      return 'analyzing';
    if (balance > 500)  return 'happy';
    if (balance < 0)    return 'stressed';
    return 'neutral';
  },
};

// ── Leon ─────────────────────────────────────────────────────────────────
function LeonCharacter({ balance, analyzing, message, onAnalyze, leonMode, onLeonMode, isMobile }) {
  const state = LEON_CONFIG.stateFor(balance, analyzing);
  const img   = LEON_CONFIG.images[state];

  const anims = { happy:'leon-bounce', neutral:'leon-float', stressed:'leon-shake', analyzing:'leon-pulse-anim', asking:'leon-float' };
  const glows = { happy:'drop-shadow(0 0 10px rgba(45,212,160,0.4))', stressed:'drop-shadow(0 0 8px rgba(240,94,110,0.4))', analyzing:'drop-shadow(0 0 10px rgba(124,127,247,0.4))' };

  return (
    <>
      <style>{`
        @keyframes leon-bounce     { 0%,100%{transform:translateY(0) rotate(0)} 30%{transform:translateY(-12px) rotate(-3deg)} 60%{transform:translateY(-6px) rotate(2deg)} }
        @keyframes leon-float      { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes leon-shake      { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-4px) rotate(-2deg)} 40%{transform:translateX(4px) rotate(2deg)} 60%{transform:translateX(-3px)} 80%{transform:translateX(3px)} }
        @keyframes leon-pulse-anim { 0%,100%{transform:scale(1)} 50%{transform:scale(1.06)} }
        @keyframes bubble-in       { from{opacity:0;transform:translateY(8px) scale(0.95)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes dots            { 0%,80%,100%{opacity:0.2;transform:scale(0.7)} 40%{opacity:1;transform:scale(1)} }
        .leon-img { animation:${anims[state]||'leon-float'} 2.5s ease-in-out infinite; filter:${glows[state]||'none'}; transition:filter 0.4s; }
        .dot-typing span { display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--indigo);margin:0 2px;animation:dots 1.2s infinite; }
        .dot-typing span:nth-child(2){animation-delay:.2s}.dot-typing span:nth-child(3){animation-delay:.4s}
      `}</style>

      <div style={{display:'flex',flexDirection:isMobile?'row':'column',alignItems:'center',gap:'var(--space-3)',width:'100%'}}>
        <img src={img} alt="Leon" className="leon-img"
          style={{width:isMobile?72:130,height:isMobile?72:130,objectFit:'contain',flexShrink:0}}/>

        <div style={{flex:isMobile?1:'unset',width:isMobile?'auto':'100%'}}>
          {message && (
            <div style={{background:'var(--bg2)',border:'1px solid var(--border-md)',borderRadius:'var(--radius-lg)',padding:'var(--space-3) var(--space-4)',marginBottom:'var(--space-3)',animation:'bubble-in 0.3s ease forwards',boxShadow:'var(--shadow)'}}>
              {analyzing ? (
                <div className="dot-typing" style={{display:'flex',justifyContent:'center',padding:'var(--space-1) 0'}}>
                  <span/><span/><span/>
                </div>
              ) : (
                <p style={{fontSize:'var(--text-xs)',color:'var(--text)',lineHeight:1.5}}>{message}</p>
              )}
            </div>
          )}

          <div style={{display:'flex',flexDirection:'column',gap:'var(--space-2)'}}>
            <Button onClick={onAnalyze} disabled={analyzing} size="sm" style={{width:'100%'}}>
              {analyzing?'Analisando...':'🔍 Analisar'}
            </Button>
            <button onClick={onLeonMode}
              style={{fontSize:'var(--text-xs)',color:leonMode?'var(--indigo)':'var(--text3)',background:leonMode?'var(--indigo-dim)':'transparent',border:`1px solid ${leonMode?'var(--indigo)':'var(--border)'}`,borderRadius:'var(--radius-sm)',padding:'5px 10px',cursor:'pointer',fontFamily:'var(--font)',transition:'all var(--transition)',textAlign:'center'}}>
              {leonMode?'🦎 Leon IA ativado':'Usar IA do Leon'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Gráfico Cascata ───────────────────────────────────────────────────────
function WaterfallChart({ items }) {
  const income  = items.filter(i=>i.type==='income').reduce((s,i)=>s+Number(i.amount),0);
  const expense = items.filter(i=>i.type==='expense').reduce((s,i)=>s+Number(i.amount),0);
  const balance = income - expense;

  if (!items.length) return (
    <div style={{height:220,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text3)',fontSize:'var(--text-sm)'}}>
      Adicione receitas e despesas para ver o gráfico
    </div>
  );

  let running = income;
  const data  = [{ name:'Receitas', base:0, value:income, type:'income' }];
  items.filter(i=>i.type==='expense').forEach(item => {
    running -= Number(item.amount);
    data.push({ name:item.description.slice(0,10)+(item.description.length>10?'…':''), base:Math.max(0,running), value:Number(item.amount), type:'expense' });
  });
  data.push({ name:'Saldo', base:0, value:balance, type:balance>=0?'balance':'deficit' });

  const COLORS = { income:'var(--green)', expense:'var(--red)', balance:'var(--indigo)', deficit:'var(--red)' };

  const CustomTooltip = ({active,payload,label}) => {
    if(!active||!payload?.length) return null;
    const val = payload.find(p=>p.dataKey==='value')?.value;
    if (!val) return null;
    return (
      <div style={{background:'var(--bg2)',border:'1px solid var(--border-md)',borderRadius:'var(--radius-md)',padding:'var(--space-2) var(--space-3)',boxShadow:'var(--shadow)'}}>
        <p style={{fontSize:'var(--text-xs)',color:'var(--text3)',marginBottom:2}}>{label}</p>
        <p style={{fontFamily:'var(--mono)',fontSize:'var(--text-sm)',fontWeight:'var(--font-bold)',color:COLORS[data.find(d=>d.name===label)?.type]||'var(--text)'}}>{fmt(val)}</p>
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={data} margin={{top:10,right:10,left:0,bottom:36}}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
        <XAxis dataKey="name" tick={{fill:'var(--text3)',fontSize:9}} axisLine={false} tickLine={false} angle={-30} textAnchor="end"/>
        <YAxis tickFormatter={v=>v>=1000?`${(v/1000).toFixed(0)}k`:v} tick={{fill:'var(--text3)',fontSize:9}} axisLine={false} tickLine={false} width={38}/>
        <Tooltip content={<CustomTooltip/>}/>
        <Bar dataKey="base" stackId="a" fill="transparent" radius={0}/>
        <Bar dataKey="value" stackId="a" radius={[5,5,0,0]} maxBarSize={48}>
          {data.map((entry,i)=><Cell key={i} fill={COLORS[entry.type]||'var(--indigo)'}/>)}
        </Bar>
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ── Item de planejamento ──────────────────────────────────────────────────
function PlanItem({ item, onRemove }) {
  return (
    <div style={{display:'flex',alignItems:'center',gap:'var(--space-2)',padding:'var(--space-2) var(--space-3)',background:'var(--bg3)',borderRadius:'var(--radius-md)',border:'1px solid var(--border)'}}>
      <span style={{fontSize:12,fontWeight:'var(--font-bold)',color:item.type==='income'?'var(--green)':'var(--red)',flexShrink:0,width:14,textAlign:'center'}}>{item.type==='income'?'↑':'↓'}</span>
      <span style={{flex:1,fontSize:'var(--text-sm)',color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.description}</span>
      {item.from_real && <Badge color="var(--amber)" bg="var(--amber-dim)">real</Badge>}
      <span style={{fontFamily:'var(--mono)',fontSize:'var(--text-xs)',fontWeight:'var(--font-semibold)',color:item.type==='income'?'var(--green)':'var(--red)',flexShrink:0}}>{fmt(item.amount)}</span>
      <button onClick={()=>onRemove(item.id)} style={{width:20,height:20,borderRadius:'var(--radius-sm)',border:'none',background:'var(--red-dim)',color:'var(--red)',cursor:'pointer',fontSize:12,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>×</button>
    </div>
  );
}

// ── Formulário de adição ──────────────────────────────────────────────────
function AddItemForm({ type, onAdd }) {
  const [desc, setDesc]   = useState('');
  const [amount, setAmount] = useState('');

  function handle(e) {
    e.preventDefault();
    if (!desc.trim() || !amount) return;
    onAdd({ id:Date.now().toString(), type, description:desc.trim(), amount:parseFloat(amount) });
    setDesc(''); setAmount('');
  }

  const color = type==='income'?'var(--green)':'var(--red)';

  return (
    <form onSubmit={handle} style={{display:'flex',gap:'var(--space-1)',marginTop:'var(--space-2)'}}>
      <input value={desc} onChange={e=>setDesc(e.target.value)} placeholder={type==='income'?'Ex: Salário':'Ex: Aluguel'}
        style={{flex:2,padding:'8px 10px',borderRadius:'var(--radius-sm)',border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text)',fontSize:'var(--text-xs)',fontFamily:'var(--font)',outline:'none',minWidth:0}}
        onFocus={e=>e.target.style.borderColor=color} onBlur={e=>e.target.style.borderColor='var(--border)'}/>
      <input value={amount} onChange={e=>setAmount(e.target.value)} placeholder="R$" type="number" step="0.01" inputMode="decimal"
        style={{flex:1,padding:'8px 8px',borderRadius:'var(--radius-sm)',border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text)',fontSize:'var(--text-xs)',fontFamily:'var(--font)',outline:'none',minWidth:0}}
        onFocus={e=>e.target.style.borderColor=color} onBlur={e=>e.target.style.borderColor='var(--border)'}/>
      <button type="submit"
        style={{padding:'8px 10px',borderRadius:'var(--radius-sm)',border:'none',background:color,color:'#fff',fontSize:'var(--text-xs)',fontWeight:'var(--font-semibold)',cursor:'pointer',fontFamily:'var(--font)',flexShrink:0}}>
        +
      </button>
    </form>
  );
}

// ── Página principal ──────────────────────────────────────────────────────
export default function PlanningPage() {
  const today    = new Date();
  const [month,     setMonth]     = useState(today.getMonth()+1);
  const [year,      setYear]      = useState(today.getFullYear());
  const [items,     setItems]     = useState([]);
  const [analysis,  setAnalysis]  = useState(null);
  const [leonText,  setLeonText]  = useState('Vamos planejar seu mês! Adicione receitas e despesas previstas. 💰');
  const [analyzing, setAnalyzing] = useState(false);
  const [leonMode,  setLeonMode]  = useState(false);
  const [useReal,   setUseReal]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [isMobile,  setIsMobile]  = useState(window.innerWidth <= 820);
  const saveTimer = useRef();

  useEffect(() => {
    function onResize() { setIsMobile(window.innerWidth <= 820); }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    api.get(`/api/planning?month=${month}&year=${year}`)
      .then(r=>{ setItems(r.data?.items||[]); setAnalysis(null); setLeonText('Vamos planejar seu mês! Adicione receitas e despesas previstas. 💰'); })
      .catch(()=>{});
  }, [month, year]);

  function scheduleSave(newItems) {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try { await api.post('/api/planning',{ month,year,items:newItems }); } catch {}
      setSaving(false);
    }, 1500);
  }

  function addItem(item) {
    const next = [...items, item];
    setItems(next); scheduleSave(next);
    if (next.filter(i=>i.type==='income').length>0 && next.filter(i=>i.type==='expense').length>0)
      setLeonText('Ótimo! Continue adicionando — o gráfico atualiza em tempo real. 📊');
  }

  function removeItem(id) {
    const next = items.filter(i=>i.id!==id);
    setItems(next); scheduleSave(next);
  }

  async function loadReal() {
    try {
      const { data } = await api.get(`/api/planning/real-transactions?month=${month}&year=${year}`);
      const next = [...items.filter(i=>!i.from_real), ...data];
      setItems(next); scheduleSave(next);
      setLeonText(`Importei ${data.length} lançamentos reais! 🦎`);
    } catch {}
  }

  async function handleAnalyze() {
    setAnalyzing(true); setLeonText('');
    try {
      if (leonMode) {
        const { data } = await api.post('/api/planning/analyze-leon',{ items,month,year });
        setAnalysis({ type:'leon', text:data.text });
        setLeonText(data.text.slice(0,100)+'...');
      } else {
        const { data } = await api.post('/api/planning/analyze',{ items,month,year });
        setAnalysis({ type:'rules', ...data });
        setLeonText(data.daily_budget>0
          ? `Pode gastar ${fmt(data.daily_budget)}/dia pelos próximos ${data.days_left} dias! 🎯`
          : 'Suas despesas superam as receitas. Vamos revisar? 😬');
      }
    } catch {}
    setAnalyzing(false);
  }

  const income  = items.filter(i=>i.type==='income').reduce((s,i)=>s+i.amount,0);
  const expense = items.filter(i=>i.type==='expense').reduce((s,i)=>s+i.amount,0);
  const balance = income - expense;

  return (
    <PageShell maxWidth={1000}>
      {/* ── Header ── */}
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'var(--space-5)',flexWrap:'wrap',gap:'var(--space-3)'}}>
        <div>
          <h1 style={{fontSize:'var(--text-xl)',fontWeight:'var(--font-semibold)',letterSpacing:'-0.03em'}}>Planejamento financeiro</h1>
          <p style={{fontSize:'var(--text-xs)',color:'var(--text3)',marginTop:'var(--space-1)'}}>
            {MONTHS[month-1]} {year} {saving?'• salvando...':'• salvo'}
          </p>
        </div>
        <div style={{display:'flex',gap:'var(--space-2)',alignItems:'center',flexWrap:'wrap'}}>
          <select value={month} onChange={e=>setMonth(Number(e.target.value))}
            style={{padding:'6px 10px',borderRadius:'var(--radius-sm)',border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text)',fontSize:'var(--text-sm)',cursor:'pointer'}}>
            {MONTHS.map((m,i)=><option key={i} value={i+1}>{m}</option>)}
          </select>
          <select value={year} onChange={e=>setYear(Number(e.target.value))}
            style={{padding:'6px 10px',borderRadius:'var(--radius-sm)',border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text)',fontSize:'var(--text-sm)',cursor:'pointer'}}>
            {[today.getFullYear()-1,today.getFullYear(),today.getFullYear()+1].map(y=><option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={()=>setUseReal(v=>{if(!v)loadReal();return !v;})}
            style={{padding:'6px 12px',borderRadius:'var(--radius-sm)',border:`1px solid ${useReal?'var(--indigo)':'var(--border)'}`,background:useReal?'var(--indigo-dim)':'var(--bg3)',color:useReal?'var(--indigo)':'var(--text3)',fontSize:'var(--text-xs)',fontWeight:'var(--font-medium)',cursor:'pointer',fontFamily:'var(--font)',transition:'all var(--transition)',whiteSpace:'nowrap'}}>
            📋 {useReal?'Reais ativos':'Usar reais'}
          </button>
        </div>
      </div>

      {/* ── Layout principal: mobile = coluna, desktop = 220px + 1fr ── */}
      <div style={{
        display: isMobile ? 'flex' : 'grid',
        flexDirection: isMobile ? 'column' : undefined,
        gridTemplateColumns: isMobile ? undefined : '200px 1fr',
        gap: 'var(--space-4)',
        alignItems: 'flex-start',
      }}>

        {/* Leon */}
        <div style={{
          position: isMobile ? 'static' : 'sticky',
          top: 70,
          background: isMobile ? 'var(--bg2)' : 'transparent',
          border: isMobile ? '1px solid var(--border)' : 'none',
          borderRadius: isMobile ? 'var(--radius-lg)' : 0,
          padding: isMobile ? 'var(--space-4)' : 0,
        }}>
          <LeonCharacter
            balance={balance} analyzing={analyzing} message={leonText}
            onAnalyze={handleAnalyze} leonMode={leonMode}
            onLeonMode={()=>setLeonMode(v=>!v)} isMobile={isMobile}
          />
        </div>

        {/* Conteúdo */}
        <div style={{display:'flex',flexDirection:'column',gap:'var(--space-4)',minWidth:0}}>

          {/* Gráfico cascata */}
          <Card>
            <div style={{padding:'var(--space-4) var(--space-4) 0'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'var(--space-2)',flexWrap:'wrap',gap:'var(--space-2)'}}>
                <SectionLabel style={{margin:0}}>Fluxo de caixa previsto</SectionLabel>
                <div style={{display:'flex',gap:'var(--space-3)'}}>
                  <span style={{fontSize:'var(--text-xs)',color:'var(--green)',fontFamily:'var(--mono)',fontWeight:'var(--font-semibold)'}}>↑ {fmt(income)}</span>
                  <span style={{fontSize:'var(--text-xs)',color:'var(--red)',fontFamily:'var(--mono)',fontWeight:'var(--font-semibold)'}}>↓ {fmt(expense)}</span>
                  <span style={{fontSize:'var(--text-xs)',color:balance>=0?'var(--indigo)':'var(--red)',fontFamily:'var(--mono)',fontWeight:'var(--font-bold)'}}>{balance>=0?'=':'!'} {fmt(balance)}</span>
                </div>
              </div>
            </div>
            <WaterfallChart items={items}/>
          </Card>

          {/* Receitas e Despesas — empilha no mobile */}
          <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1fr',gap:'var(--space-4)'}}>
            {(['income','expense']).map(type => (
              <Card key={type}>
                <div style={{padding:'var(--space-4)'}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'var(--space-3)'}}>
                    <SectionLabel style={{margin:0,color:type==='income'?'var(--green)':'var(--red)'}}>
                      {type==='income'?'↑ Receitas':'↓ Despesas'}
                    </SectionLabel>
                    <span style={{fontFamily:'var(--mono)',fontSize:'var(--text-sm)',fontWeight:'var(--font-bold)',color:type==='income'?'var(--green)':'var(--red)'}}>
                      {fmt(type==='income'?income:expense)}
                    </span>
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:'var(--space-1)',marginBottom:'var(--space-2)'}}>
                    {items.filter(i=>i.type===type).map(item=>(
                      <PlanItem key={item.id} item={item} onRemove={removeItem}/>
                    ))}
                    {items.filter(i=>i.type===type).length===0 && (
                      <p style={{fontSize:'var(--text-xs)',color:'var(--text3)',textAlign:'center',padding:'var(--space-3) 0'}}>
                        Nenhum{type==='income'?' item':' item'} ainda
                      </p>
                    )}
                  </div>
                  <AddItemForm type={type} onAdd={addItem}/>
                </div>
              </Card>
            ))}
          </div>

          {/* Análise */}
          {analysis && (
            <Card style={{border:'1px solid rgba(124,127,247,0.25)'}}>
              <div style={{padding:'var(--space-4)'}}>
                <SectionLabel style={{marginBottom:'var(--space-3)'}}>
                  {analysis.type==='leon'?'🦎 Análise do Leon':'💡 Análise automática'}
                </SectionLabel>
                {analysis.type==='rules' ? (
                  <div style={{display:'flex',flexDirection:'column',gap:'var(--space-3)'}}>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'var(--space-2)'}}>
                      {[
                        {label:'Saldo previsto', value:fmt(analysis.balance), color:analysis.balance>=0?'var(--indigo)':'var(--red)'},
                        {label:'Taxa poupança', value:`${analysis.saving_rate}%`, color:analysis.saving_rate>=20?'var(--green)':analysis.saving_rate>=0?'var(--amber)':'var(--red)'},
                        {label:'Gastar/dia', value:fmt(analysis.daily_budget), color:'var(--indigo)'},
                      ].map(c=>(
                        <div key={c.label} style={{background:'var(--bg3)',borderRadius:'var(--radius-md)',padding:'var(--space-3)',textAlign:'center'}}>
                          <p style={{fontSize:10,color:'var(--text3)',marginBottom:'var(--space-1)'}}>{c.label}</p>
                          <p style={{fontFamily:'var(--mono)',fontSize:'var(--text-md)',fontWeight:'var(--font-bold)',color:c.color}}>{c.value}</p>
                        </div>
                      ))}
                    </div>
                    {analysis.suggestions?.map((s,i)=>(
                      <InfoBox key={i} variant={s.type==='success'?'success':s.type==='danger'?'danger':s.type==='warning'?'warning':'info'}>
                        {s.icon} {s.text}
                      </InfoBox>
                    ))}
                  </div>
                ) : (
                  <div style={{fontSize:'var(--text-sm)',color:'var(--text)',lineHeight:1.7,whiteSpace:'pre-line',background:'var(--bg3)',borderRadius:'var(--radius-md)',padding:'var(--space-4)'}}>
                    {analysis.text}
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </PageShell>
  );
}
