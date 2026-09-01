import { useState, useEffect, useCallback, useRef } from 'react';
import { ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ReferenceLine, ResponsiveContainer } from 'recharts';
import { PageShell, PageHeader, Card, Button, Input, SectionLabel, InfoBox, Badge } from '../components/ui';
import api from '../lib/api';

// ── Utilitários ───────────────────────────────────────────────────────────
const fmt      = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);
const MONTHS   = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

// ── Configuração do Leon — troque apenas o LEON_CONFIG para mudar visual ──
const LEON_CONFIG = {
  images: {
    happy:     '/leon/happy.png',
    neutral:   '/leon/neutral.png',
    stressed:  '/leon/stressed.png',
    analyzing: '/leon/analyzing.png',
    asking:    '/leon/asking.png',
  },
  // Estados mapeados por contexto
  stateFor: (balance, analyzing) => {
    if (analyzing) return 'analyzing';
    if (balance > 500)  return 'happy';
    if (balance < 0)    return 'stressed';
    return 'neutral';
  },
};

// ── Leon animado ──────────────────────────────────────────────────────────
function LeonCharacter({ balance, analyzing, message, onAnalyze, leonMode, onLeonMode }) {
  const state = LEON_CONFIG.stateFor(balance, analyzing);
  const img   = LEON_CONFIG.images[state];

  const animations = {
    happy:     'leon-bounce',
    neutral:   'leon-float',
    stressed:  'leon-shake',
    analyzing: 'leon-pulse-anim',
    asking:    'leon-float',
  };

  return (
    <>
      <style>{`
        @keyframes leon-bounce {
          0%,100%{transform:translateY(0) rotate(0deg);}
          30%{transform:translateY(-12px) rotate(-3deg);}
          60%{transform:translateY(-6px) rotate(2deg);}
        }
        @keyframes leon-float {
          0%,100%{transform:translateY(0);}
          50%{transform:translateY(-8px);}
        }
        @keyframes leon-shake {
          0%,100%{transform:translateX(0) rotate(0);}
          20%{transform:translateX(-4px) rotate(-2deg);}
          40%{transform:translateX(4px) rotate(2deg);}
          60%{transform:translateX(-3px) rotate(-1deg);}
          80%{transform:translateX(3px) rotate(1deg);}
        }
        @keyframes leon-pulse-anim {
          0%,100%{transform:scale(1);}
          50%{transform:scale(1.06);}
        }
        @keyframes leon-glow {
          0%,100%{box-shadow:0 0 0 0 rgba(124,127,247,0);}
          50%{box-shadow:0 0 24px 8px rgba(124,127,247,0.35);}
        }
        @keyframes bubble-in {
          from{opacity:0;transform:translateY(8px) scale(0.95);}
          to{opacity:1;transform:translateY(0) scale(1);}
        }
        @keyframes dots {
          0%,80%,100%{opacity:0.2;transform:scale(0.7);}
          40%{opacity:1;transform:scale(1);}
        }
        .leon-img {
          animation: ${animations[state]||'leon-float'} 2.5s ease-in-out infinite;
          transition: opacity 0.4s ease, filter 0.4s ease;
          filter: ${state==='stressed'?'drop-shadow(0 0 8px rgba(240,94,110,0.4))':state==='happy'?'drop-shadow(0 0 10px rgba(45,212,160,0.35))':state==='analyzing'?'drop-shadow(0 0 10px rgba(124,127,247,0.4))':'none'};
        }
        .leon-container {
          animation: ${state==='analyzing'?'leon-glow 2s ease-in-out infinite':'none'};
          border-radius: 50%;
        }
        .dot-typing span {
          display:inline-block;
          width:6px;height:6px;border-radius:50%;
          background:var(--indigo);margin:0 2px;
          animation:dots 1.2s infinite;
        }
        .dot-typing span:nth-child(2){animation-delay:0.2s;}
        .dot-typing span:nth-child(3){animation-delay:0.4s;}
      `}</style>

      <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'var(--space-4)'}}>
        {/* Imagem do Leon */}
        <div className="leon-container" style={{position:'relative',width:140,height:140,flexShrink:0}}>
          <img
            src={img}
            alt="Leon"
            className="leon-img"
            style={{width:'100%',height:'100%',objectFit:'contain'}}
          />
        </div>

        {/* Balão de fala */}
        {message && (
          <div style={{
            background:'var(--bg2)', border:'1px solid var(--border-md)',
            borderRadius:'var(--radius-lg)',
            padding:'var(--space-3) var(--space-4)',
            maxWidth:260, textAlign:'center',
            animation:'bubble-in 0.3s ease forwards',
            boxShadow:'var(--shadow)',
            position:'relative',
          }}>
            <div style={{position:'absolute',top:-8,left:'50%',transform:'translateX(-50%)',
              width:0,height:0,borderLeft:'8px solid transparent',borderRight:'8px solid transparent',
              borderBottom:`8px solid var(--border-md)`}}/>
            <div style={{position:'absolute',top:-6,left:'50%',transform:'translateX(-50%)',
              width:0,height:0,borderLeft:'7px solid transparent',borderRight:'7px solid transparent',
              borderBottom:`7px solid var(--bg2)`}}/>
            {analyzing ? (
              <div className="dot-typing" style={{display:'flex',justifyContent:'center',padding:'var(--space-1) 0'}}>
                <span/><span/><span/>
              </div>
            ) : (
              <p style={{fontSize:'var(--text-sm)',color:'var(--text)',lineHeight:1.5}}>{message}</p>
            )}
          </div>
        )}

        {/* Botões de ação */}
        <div style={{display:'flex',flexDirection:'column',gap:'var(--space-2)',width:'100%',maxWidth:220}}>
          <Button onClick={onAnalyze} disabled={analyzing} size="sm" style={{width:'100%'}}>
            {analyzing?'Analisando...':'🔍 Analisar planejamento'}
          </Button>
          <button onClick={onLeonMode}
            style={{fontSize:'var(--text-xs)',color:leonMode?'var(--indigo)':'var(--text3)',background:leonMode?'var(--indigo-dim)':'transparent',border:`1px solid ${leonMode?'var(--indigo)':'var(--border)'}`,borderRadius:'var(--radius-sm)',padding:'5px 10px',cursor:'pointer',fontFamily:'var(--font)',transition:'all var(--transition)',textAlign:'center'}}>
            {leonMode?'🦎 Leon ativado':'Usar IA do Leon'}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Gráfico Cascata ────────────────────────────────────────────────────────
function WaterfallChart({ items }) {
  const income  = items.filter(i=>i.type==='income').reduce((s,i)=>s+Number(i.amount),0);
  const expense = items.filter(i=>i.type==='expense').reduce((s,i)=>s+Number(i.amount),0);
  const balance = income - expense;

  if (!items.length) return (
    <div style={{height:260,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text3)',fontSize:'var(--text-sm)'}}>
      Adicione receitas e despesas para ver o gráfico
    </div>
  );

  // Monta os dados para o gráfico cascata
  // Cada barra tem: base (invisível) + valor
  let running = 0;
  const data = [];

  // Barra de receita total
  data.push({ name:'Receitas', base:0, value:income, type:'income' });
  running = income;

  // Cada despesa como barra descendente
  items.filter(i=>i.type==='expense').forEach(item => {
    running -= Number(item.amount);
    data.push({
      name: item.description.slice(0,12)+(item.description.length>12?'…':''),
      base: Math.max(0,running),
      value: Number(item.amount),
      type:'expense',
    });
  });

  // Saldo final
  data.push({ name:'Saldo', base:0, value:balance, type: balance>=0?'balance':'deficit' });

  const COLORS = {
    income:  'var(--green)',
    expense: 'var(--red)',
    balance: 'var(--indigo)',
    deficit: 'var(--red)',
  };

  const CustomTooltip = ({active,payload,label}) => {
    if(!active||!payload?.length) return null;
    const item = payload[0];
    const val  = item.name==='base'?null:item.value;
    if (!val) return null;
    return (
      <div style={{background:'var(--bg2)',border:'1px solid var(--border-md)',borderRadius:'var(--radius-md)',padding:'var(--space-2) var(--space-3)',boxShadow:'var(--shadow)'}}>
        <p style={{fontSize:'var(--text-xs)',color:'var(--text3)',marginBottom:2}}>{label}</p>
        <p style={{fontFamily:'var(--mono)',fontSize:'var(--text-sm)',fontWeight:'var(--font-bold)',color:COLORS[data.find(d=>d.name===label)?.type]||'var(--text)'}}>{fmt(val)}</p>
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{top:10,right:10,left:10,bottom:40}}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
        <XAxis dataKey="name" tick={{fill:'var(--text3)',fontSize:10}} axisLine={false} tickLine={false} angle={-35} textAnchor="end"/>
        <YAxis tickFormatter={v=>v>=1000?`${(v/1000).toFixed(0)}k`:v} tick={{fill:'var(--text3)',fontSize:10}} axisLine={false} tickLine={false} width={44}/>
        <Tooltip content={<CustomTooltip/>}/>
        {/* Barra invisível como base */}
        <Bar dataKey="base" stackId="a" fill="transparent" radius={0}/>
        {/* Barra real */}
        <Bar dataKey="value" stackId="a" radius={[5,5,0,0]} maxBarSize={52}>
          {data.map((entry,i)=>(
            <Cell key={i} fill={COLORS[entry.type]||'var(--indigo)'}/>
          ))}
        </Bar>
        {balance===0 && <ReferenceLine y={0} stroke="var(--border-md)" strokeDasharray="4 4"/>}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ── Item de planejamento ──────────────────────────────────────────────────
function PlanItem({ item, onRemove }) {
  return (
    <div style={{display:'flex',alignItems:'center',gap:'var(--space-2)',padding:'var(--space-2) var(--space-3)',background:'var(--bg3)',borderRadius:'var(--radius-md)',border:'1px solid var(--border)',transition:'all var(--transition)',animation:'bubble-in 0.25s ease forwards'}}>
      <span style={{fontSize:13,fontWeight:'var(--font-semibold)',color:item.type==='income'?'var(--green)':'var(--red)',flexShrink:0,width:14,textAlign:'center'}}>
        {item.type==='income'?'↑':'↓'}
      </span>
      <span style={{flex:1,fontSize:'var(--text-sm)',color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.description}</span>
      {item.from_real && <Badge color="var(--amber)" bg="var(--amber-dim)" style={{flexShrink:0}}>real</Badge>}
      <span style={{fontFamily:'var(--mono)',fontSize:'var(--text-sm)',fontWeight:'var(--font-semibold)',color:item.type==='income'?'var(--green)':'var(--red)',flexShrink:0}}>{fmt(item.amount)}</span>
      <button onClick={()=>onRemove(item.id)} style={{width:22,height:22,borderRadius:'var(--radius-sm)',border:'none',background:'var(--red-dim)',color:'var(--red)',cursor:'pointer',fontSize:12,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>×</button>
    </div>
  );
}

// ── Formulário rápido para adicionar item ─────────────────────────────────
function AddItemForm({ type, onAdd }) {
  const [desc,   setDesc]   = useState('');
  const [amount, setAmount] = useState('');

  function handle(e) {
    e.preventDefault();
    if (!desc.trim() || !amount) return;
    onAdd({ id: Date.now().toString(), type, description: desc.trim(), amount: parseFloat(amount) });
    setDesc(''); setAmount('');
  }

  return (
    <form onSubmit={handle} style={{display:'flex',gap:'var(--space-2)',marginTop:'var(--space-2)'}}>
      <input value={desc} onChange={e=>setDesc(e.target.value)} placeholder={type==='income'?'Ex: Salário':'Ex: Aluguel'}
        style={{flex:2,padding:'8px 12px',borderRadius:'var(--radius-sm)',border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text)',fontSize:'var(--text-sm)',fontFamily:'var(--font)',outline:'none'}}
        onFocus={e=>e.target.style.borderColor=type==='income'?'var(--green)':'var(--red)'}
        onBlur={e=>e.target.style.borderColor='var(--border)'}/>
      <input value={amount} onChange={e=>setAmount(e.target.value)} placeholder="R$" type="number" step="0.01" inputMode="decimal"
        style={{flex:1,padding:'8px 12px',borderRadius:'var(--radius-sm)',border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text)',fontSize:'var(--text-sm)',fontFamily:'var(--font)',outline:'none'}}
        onFocus={e=>e.target.style.borderColor=type==='income'?'var(--green)':'var(--red)'}
        onBlur={e=>e.target.style.borderColor='var(--border)'}/>
      <button type="submit"
        style={{padding:'8px 14px',borderRadius:'var(--radius-sm)',border:'none',background:type==='income'?'var(--green)':'var(--red)',color:'#fff',fontSize:'var(--text-sm)',fontWeight:'var(--font-semibold)',cursor:'pointer',fontFamily:'var(--font)',flexShrink:0,transition:'filter var(--transition)'}}
        onMouseOver={e=>e.currentTarget.style.filter='brightness(1.1)'}
        onMouseOut={e=>e.currentTarget.style.filter='none'}>
        + Adicionar
      </button>
    </form>
  );
}

// ── Página principal ──────────────────────────────────────────────────────
export default function PlanningPage() {
  const today    = new Date();
  const [month,  setMonth]  = useState(today.getMonth()+1);
  const [year,   setYear]   = useState(today.getFullYear());
  const [items,  setItems]  = useState([]);
  const [analysis,   setAnalysis]   = useState(null);
  const [leonText,   setLeonText]   = useState('Olá! Vamos planejar seu mês. Adicione suas receitas e despesas previstas. 💰');
  const [analyzing,  setAnalyzing]  = useState(false);
  const [leonMode,   setLeonMode]   = useState(false);
  const [useReal,    setUseReal]    = useState(false);
  const [saving,     setSaving]     = useState(false);
  const saveTimer = useRef();

  const income  = items.filter(i=>i.type==='income').reduce((s,i)=>s+i.amount,0);
  const expense = items.filter(i=>i.type==='expense').reduce((s,i)=>s+i.amount,0);
  const balance = income - expense;

  // Carrega sessão ao trocar mês
  useEffect(() => {
    api.get(`/api/planning?month=${month}&year=${year}`)
      .then(r => { setItems(r.data?.items||[]); setAnalysis(null); setLeonText('Olá! Vamos planejar seu mês. Adicione suas receitas e despesas previstas. 💰'); })
      .catch(()=>{});
  }, [month, year]);

  // Salva automaticamente após 1.5s de inatividade
  function scheduleSave(newItems) {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try { await api.post('/api/planning',{ month,year,items:newItems }); } catch{}
      setSaving(false);
    }, 1500);
  }

  function addItem(item) {
    const next = [...items, item];
    setItems(next);
    scheduleSave(next);
    if (next.filter(i=>i.type==='income').length>0 && next.filter(i=>i.type==='expense').length>0) {
      setLeonText('Ótimo! Continue adicionando itens — o gráfico vai atualizando em tempo real. 📊');
    }
  }

  function removeItem(id) {
    const next = items.filter(i=>i.id!==id);
    setItems(next);
    scheduleSave(next);
  }

  async function loadRealTransactions() {
    try {
      const { data } = await api.get(`/api/planning/real-transactions?month=${month}&year=${year}`);
      const existingIds = new Set(items.filter(i=>i.from_real).map(i=>i.description+i.amount));
      const newItems = data.filter(i=>!existingIds.has(i.description+i.amount));
      const next = [...items.filter(i=>!i.from_real), ...newItems];
      setItems(next);
      scheduleSave(next);
      setLeonText(`Importei ${newItems.length} lançamentos reais do mês. Você pode editá-los à vontade! 🦎`);
    } catch{}
  }

  async function handleAnalyze() {
    setAnalyzing(true); setLeonText('');
    try {
      if (leonMode) {
        const { data } = await api.post('/api/planning/analyze-leon',{ items,month,year });
        setAnalysis({ type:'leon', text:data.text });
        setLeonText(data.text.slice(0,120)+'...');
      } else {
        const { data } = await api.post('/api/planning/analyze',{ items,month,year });
        setAnalysis({ type:'rules', ...data });
        setLeonText(data.daily_budget>0
          ? `Você pode gastar ${fmt(data.daily_budget)} por dia pelos próximos ${data.days_left} dias! 🎯`
          : 'Suas despesas superam as receitas. Vamos revisar? 😬');
      }
    } catch{}
    setAnalyzing(false);
  }

  return (
    <PageShell maxWidth={1000}>
      <PageHeader
        title="Planejamento financeiro"
        subtitle={`${MONTHS[month-1]} ${year} ${saving?'• salvando...':'• salvo'}`}
        action={
          <div style={{display:'flex',gap:'var(--space-2)',alignItems:'center',flexWrap:'wrap'}}>
            {/* Seletor mês */}
            <select value={month} onChange={e=>setMonth(Number(e.target.value))}
              style={{padding:'6px 10px',borderRadius:'var(--radius-sm)',border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text)',fontSize:'var(--text-sm)',cursor:'pointer'}}>
              {MONTHS.map((m,i)=><option key={i} value={i+1}>{m}</option>)}
            </select>
            <select value={year} onChange={e=>setYear(Number(e.target.value))}
              style={{padding:'6px 10px',borderRadius:'var(--radius-sm)',border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text)',fontSize:'var(--text-sm)',cursor:'pointer'}}>
              {[today.getFullYear()-1,today.getFullYear(),today.getFullYear()+1].map(y=><option key={y} value={y}>{y}</option>)}
            </select>
            {/* Toggle lançamentos reais */}
            <button onClick={()=>{setUseReal(v=>{if(!v)loadRealTransactions();return!v;})}}
              style={{display:'flex',alignItems:'center',gap:'var(--space-1)',padding:'6px 12px',borderRadius:'var(--radius-sm)',border:`1px solid ${useReal?'var(--indigo)':'var(--border)'}`,background:useReal?'var(--indigo-dim)':'var(--bg3)',color:useReal?'var(--indigo)':'var(--text3)',fontSize:'var(--text-xs)',fontWeight:'var(--font-medium)',cursor:'pointer',fontFamily:'var(--font)',transition:'all var(--transition)'}}>
              {useReal?'📋 Reais ativos':'📋 Usar lançamentos reais'}
            </button>
          </div>
        }
      />

      {/* ── Layout principal ── */}
      <div style={{display:'grid',gridTemplateColumns:'220px 1fr',gap:'var(--space-5)',alignItems:'start'}}>

        {/* Leon */}
        <div style={{position:'sticky',top:70}}>
          <LeonCharacter
            balance={balance}
            analyzing={analyzing}
            message={leonText}
            onAnalyze={handleAnalyze}
            leonMode={leonMode}
            onLeonMode={()=>setLeonMode(v=>!v)}
          />
        </div>

        {/* Conteúdo */}
        <div style={{display:'flex',flexDirection:'column',gap:'var(--space-4)'}}>

          {/* Gráfico cascata */}
          <Card>
            <div style={{padding:'var(--space-4) var(--space-4) 0'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'var(--space-2)'}}>
                <SectionLabel style={{margin:0}}>Fluxo de caixa previsto</SectionLabel>
                <div style={{display:'flex',gap:'var(--space-4)'}}>
                  <span style={{fontSize:'var(--text-xs)',color:'var(--green)',fontFamily:'var(--mono)',fontWeight:'var(--font-semibold)'}}>↑ {fmt(income)}</span>
                  <span style={{fontSize:'var(--text-xs)',color:'var(--red)',fontFamily:'var(--mono)',fontWeight:'var(--font-semibold)'}}>↓ {fmt(expense)}</span>
                  <span style={{fontSize:'var(--text-xs)',color:balance>=0?'var(--indigo)':'var(--red)',fontFamily:'var(--mono)',fontWeight:'var(--font-bold)'}}>{balance>=0?'=':'!'} {fmt(balance)}</span>
                </div>
              </div>
            </div>
            <WaterfallChart items={items}/>
          </Card>

          {/* Receitas e Despesas */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'var(--space-4)'}}>

            {/* Receitas */}
            <Card>
              <div style={{padding:'var(--space-4)'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'var(--space-3)'}}>
                  <SectionLabel style={{margin:0,color:'var(--green)'}}>↑ Receitas</SectionLabel>
                  <span style={{fontFamily:'var(--mono)',fontSize:'var(--text-sm)',fontWeight:'var(--font-bold)',color:'var(--green)'}}>{fmt(income)}</span>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:'var(--space-1)',marginBottom:'var(--space-2)'}}>
                  {items.filter(i=>i.type==='income').map(item=>(
                    <PlanItem key={item.id} item={item} onRemove={removeItem}/>
                  ))}
                  {items.filter(i=>i.type==='income').length===0 && (
                    <p style={{fontSize:'var(--text-xs)',color:'var(--text3)',textAlign:'center',padding:'var(--space-3) 0'}}>Nenhuma receita ainda</p>
                  )}
                </div>
                <AddItemForm type="income" onAdd={addItem}/>
              </div>
            </Card>

            {/* Despesas */}
            <Card>
              <div style={{padding:'var(--space-4)'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'var(--space-3)'}}>
                  <SectionLabel style={{margin:0,color:'var(--red)'}}>↓ Despesas</SectionLabel>
                  <span style={{fontFamily:'var(--mono)',fontSize:'var(--text-sm)',fontWeight:'var(--font-bold)',color:'var(--red)'}}>{fmt(expense)}</span>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:'var(--space-1)',marginBottom:'var(--space-2)'}}>
                  {items.filter(i=>i.type==='expense').map(item=>(
                    <PlanItem key={item.id} item={item} onRemove={removeItem}/>
                  ))}
                  {items.filter(i=>i.type==='expense').length===0 && (
                    <p style={{fontSize:'var(--text-xs)',color:'var(--text3)',textAlign:'center',padding:'var(--space-3) 0'}}>Nenhuma despesa ainda</p>
                  )}
                </div>
                <AddItemForm type="expense" onAdd={addItem}/>
              </div>
            </Card>
          </div>

          {/* Análise */}
          {analysis && (
            <Card style={{border:'1px solid rgba(124,127,247,0.25)',animation:'bubble-in 0.3s ease forwards'}}>
              <div style={{padding:'var(--space-4)'}}>
                <SectionLabel style={{marginBottom:'var(--space-3)'}}>
                  {analysis.type==='leon'?'🦎 Análise do Leon':'💡 Análise automática'}
                </SectionLabel>

                {analysis.type==='rules' ? (
                  <div style={{display:'flex',flexDirection:'column',gap:'var(--space-3)'}}>
                    {/* Resumo numérico */}
                    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'var(--space-2)'}}>
                      {[
                        {label:'Saldo previsto', value:fmt(analysis.balance), color:analysis.balance>=0?'var(--indigo)':'var(--red)'},
                        {label:'Taxa poupança', value:`${analysis.saving_rate}%`, color:analysis.saving_rate>=20?'var(--green)':analysis.saving_rate>=0?'var(--amber)':'var(--red)'},
                        {label:'Gastar/dia', value:fmt(analysis.daily_budget), color:'var(--indigo)'},
                      ].map(c=>(
                        <div key={c.label} style={{background:'var(--bg3)',borderRadius:'var(--radius-md)',padding:'var(--space-3)',textAlign:'center'}}>
                          <p style={{fontSize:'var(--text-xs)',color:'var(--text3)',marginBottom:'var(--space-1)'}}>{c.label}</p>
                          <p style={{fontFamily:'var(--mono)',fontSize:'var(--text-md)',fontWeight:'var(--font-bold)',color:c.color}}>{c.value}</p>
                        </div>
                      ))}
                    </div>
                    {/* Sugestões */}
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

      {/* Layout mobile */}
      <style>{`
        @media(max-width:720px){
          .planning-grid { grid-template-columns:1fr !important; }
          .planning-items { grid-template-columns:1fr !important; }
        }
      `}</style>
    </PageShell>
  );
}
