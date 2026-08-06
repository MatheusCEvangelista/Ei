import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import Navbar from '../components/Navbar';
import MonthSelector from '../components/MonthSelector';

const fmt = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);

const TYPE_CONFIG = {
  transaction:  { bg:'var(--bg)',    dot:'var(--text3)'    },
  debt:         { bg:'rgba(245,166,35,0.12)', dot:'var(--amber)'  },
  recurring:    { bg:'var(--indigo-dim)',      dot:'var(--indigo)' },
  card_closing: { bg:'var(--red-dim)',         dot:'var(--red)'    },
  card_due:     { bg:'var(--red-dim)',         dot:'var(--red)'    },
};

const WEEKDAYS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

export default function CalendarPage() {
  const today  = new Date();
  const [month,    setMonth]    = useState(today.getMonth()+1);
  const [year,     setYear]     = useState(today.getFullYear());
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState(null);
  const navigate = useNavigate();

  async function load() {
    setLoading(true);
    try {
      const { data: res } = await api.get(`/api/calendar?month=${month}&year=${year}`);
      setData(res);
    } catch(e){ console.error(e); }
    setLoading(false);
  }

  useEffect(()=>{ load(); setSelected(null); },[month,year]);

  if (loading || !data) return (
    <div style={{minHeight:'100vh',background:'var(--bg)'}}>
      <Navbar/>
      <main style={{maxWidth:900,margin:'0 auto',padding:'24px 16px'}}>
        <div className="skeleton" style={{height:400,borderRadius:14}}/>
      </main>
    </div>
  );

  // Primeiro dia do mês (0=Dom)
  const firstDow = new Date(year, month-1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells = Array(firstDow).fill(null).concat(Array.from({length:daysInMonth},(_,i)=>i+1));
  // Completa com nulls para grid 7 colunas
  while (cells.length % 7 !== 0) cells.push(null);

  const selectedEvents = selected ? data.days[selected] || [] : [];

  const TYPE_LABEL = {
    transaction:  'Transação',
    debt:         'Parcela',
    recurring:    'Recorrente',
    card_closing: '📅 Fechamento de cartão',
    card_due:     '💳 Vencimento de cartão',
  };

  return (
    <div style={{minHeight:'100vh',background:'var(--bg)'}}>
      <Navbar/>
      <main className="page-main" style={{maxWidth:900,margin:'0 auto',padding:'24px 16px 80px'}}>

        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:20,flexWrap:'wrap',gap:12}}>
          <div>
            <h1 style={{fontSize:20,fontWeight:600,letterSpacing:'-0.03em'}}>Calendário financeiro</h1>
            <p style={{color:'var(--text3)',fontSize:13,marginTop:4}}>Visão completa do mês</p>
          </div>
          <MonthSelector month={month} year={year} onChange={(m,y)=>{setMonth(m);setYear(y);}}/>
        </div>

        {/* Resumo do mês */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:18}} className="summary-grid">
          {[
            {label:'Receitas',     value:fmt(data.summary.income),  color:'var(--green)'},
            {label:'Despesas',     value:fmt(data.summary.expense), color:'var(--red)'},
            {label:'Parcelas',     value:data.summary.debtsDue,     color:'var(--amber)'},
            {label:'Recorrentes',  value:data.summary.recurringsDue,color:'var(--indigo)'},
          ].map(c=>(
            <div key={c.label} style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:12,padding:'12px 14px'}}>
              <p style={{fontSize:10,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:6}}>{c.label}</p>
              <p style={{fontFamily:'var(--mono)',fontSize:15,fontWeight:600,color:c.color}}>{c.value}</p>
            </div>
          ))}
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr',gap:14}} className="charts-grid" style={{display:'grid',gridTemplateColumns:selected?'1fr 1fr':'1fr',gap:14}}>

          {/* Calendário */}
          <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:14,overflow:'hidden'}}>
            {/* Header dias semana */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',borderBottom:'1px solid var(--border)'}}>
              {WEEKDAYS.map(d=>(
                <div key={d} style={{padding:'10px 0',textAlign:'center',fontSize:11,fontWeight:600,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.05em'}}>{d}</div>
              ))}
            </div>

            {/* Grid de dias */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)'}}>
              {cells.map((day,i) => {
                if (!day) return <div key={`e${i}`} style={{minHeight:70,borderRight:'1px solid var(--border)',borderBottom:'1px solid var(--border)',background:'var(--bg3)',opacity:0.4}}/>;
                const events = data.days[day] || [];
                const isToday = today.getDate()===day && today.getMonth()+1===month && today.getFullYear()===year;
                const isSelected = selected===day;
                const hasUrgent = events.some(e=>['card_due','debt','card_closing'].includes(e.type));

                return (
                  <div key={day} onClick={()=>setSelected(isSelected?null:day)}
                    style={{
                      minHeight:70, padding:'6px 4px',
                      borderRight:'1px solid var(--border)',
                      borderBottom:'1px solid var(--border)',
                      cursor:events.length?'pointer':'default',
                      background:isSelected?'var(--indigo-dim)':isToday?'rgba(124,127,247,0.06)':'var(--bg2)',
                      transition:'background 0.15s',
                      position:'relative',
                    }}
                    onMouseOver={e=>{if(!isSelected&&events.length)e.currentTarget.style.background='var(--bg3)';}}
                    onMouseOut={e=>{if(!isSelected)e.currentTarget.style.background=isToday?'rgba(124,127,247,0.06)':'var(--bg2)';}}>

                    {/* Número do dia */}
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4}}>
                      <span style={{
                        fontSize:12, fontWeight:isToday?700:500,
                        color:isToday?'var(--indigo)':'var(--text)',
                        width:22,height:22,borderRadius:'50%',
                        background:isToday?'var(--indigo-dim)':'transparent',
                        display:'flex',alignItems:'center',justifyContent:'center',
                      }}>{day}</span>
                      {hasUrgent && <span style={{width:6,height:6,borderRadius:'50%',background:'var(--red)',display:'inline-block',flexShrink:0}}/>}
                    </div>

                    {/* Mini eventos (máx 3) */}
                    <div style={{display:'flex',flexDirection:'column',gap:2}}>
                      {events.slice(0,3).map((ev,j)=>(
                        <div key={j} style={{
                          fontSize:9, color:ev.color||'var(--text3)',
                          background:(TYPE_CONFIG[ev.type]||TYPE_CONFIG.transaction).bg,
                          borderRadius:3, padding:'1px 4px',
                          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                          maxWidth:'100%',
                        }}>
                          {ev.label}
                        </div>
                      ))}
                      {events.length>3&&<div style={{fontSize:9,color:'var(--text3)',paddingLeft:4}}>+{events.length-3}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Painel lateral — eventos do dia selecionado */}
          {selected && (
            <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:14,overflow:'hidden',display:'flex',flexDirection:'column'}} className="fade-up">
              <div style={{padding:'16px 18px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div>
                  <p style={{fontSize:14,fontWeight:600,color:'var(--text)'}}>Dia {selected}</p>
                  <p style={{fontSize:11,color:'var(--text3)',marginTop:2}}>{selectedEvents.length} evento{selectedEvents.length!==1?'s':''}</p>
                </div>
                <button onClick={()=>setSelected(null)} style={{width:26,height:26,borderRadius:7,border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text3)',cursor:'pointer',fontSize:14}}>×</button>
              </div>

              <div style={{flex:1,overflowY:'auto',padding:'12px'}}>
                {selectedEvents.length===0 ? (
                  <p style={{fontSize:13,color:'var(--text3)',textAlign:'center',padding:'24px 0'}}>Nenhum evento neste dia.</p>
                ) : selectedEvents.map((ev,i)=>(
                  <div key={i} style={{
                    padding:'12px 14px', borderRadius:10, marginBottom:8,
                    background:(TYPE_CONFIG[ev.type]||TYPE_CONFIG.transaction).bg,
                    border:`1px solid ${ev.color||'var(--border)'}33`,
                  }}>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:ev.amount?4:0}}>
                      <span style={{width:8,height:8,borderRadius:'50%',background:ev.color||'var(--text3)',flexShrink:0}}/>
                      <p style={{fontSize:11,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.05em'}}>{TYPE_LABEL[ev.type]||ev.type}</p>
                    </div>
                    <p style={{fontSize:13,fontWeight:600,color:'var(--text)',marginLeft:16}}>{ev.label}</p>
                    {ev.installment && <p style={{fontSize:11,color:'var(--text3)',marginLeft:16,marginTop:2}}>Parcela {ev.installment}</p>}
                    {ev.category && <p style={{fontSize:11,color:'var(--text3)',marginLeft:16,marginTop:2}}>{ev.category}</p>}
                    {ev.amount>0 && (
                      <p style={{fontFamily:'var(--mono)',fontSize:14,fontWeight:700,color:ev.color||'var(--text)',marginLeft:16,marginTop:6}}>
                        {ev.kind==='income'||ev.type==='recurring'&&ev.kind==='income'?'+':'-'}{fmt(ev.amount)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Legenda */}
        <div style={{display:'flex',gap:16,marginTop:14,flexWrap:'wrap'}}>
          {[
            {color:'var(--green)', label:'Receitas'},
            {color:'var(--red)',   label:'Despesas / Vencimentos'},
            {color:'var(--amber)', label:'Parcelas de dívidas'},
            {color:'var(--indigo)',label:'Recorrentes previstas'},
          ].map(l=>(
            <div key={l.label} style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:'var(--text3)'}}>
              <span style={{width:8,height:8,borderRadius:'50%',background:l.color,display:'inline-block'}}/>
              {l.label}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
