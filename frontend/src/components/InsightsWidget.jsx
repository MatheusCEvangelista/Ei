import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

const TYPE_STYLE = {
  critical:  { border:'rgba(240,94,110,0.35)',  bg:'rgba(240,94,110,0.06)'  },
  warning:   { border:'rgba(245,166,35,0.35)',  bg:'rgba(245,166,35,0.06)'  },
  attention: { border:'rgba(124,127,247,0.35)', bg:'rgba(124,127,247,0.06)' },
  info:      { border:'rgba(139,144,164,0.25)', bg:'transparent'             },
};

const PRIORITY_COLOR = {
  critical:  'var(--red)',
  warning:   'var(--amber)',
  attention: 'var(--indigo)',
  info:      'var(--text3)',
};

export default function InsightsWidget() {
  const [insights, setInsights] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();

  useEffect(()=>{
    api.get('/api/insights')
      .then(r => { setInsights(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  },[]);

  const criticalCount = insights.filter(i=>i.type==='critical').length;
  const warningCount  = insights.filter(i=>i.type==='warning').length;
  const shown         = expanded ? insights : insights.slice(0,3);

  if (loading) return (
    <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:'20px 18px'}}>
      <div className="skeleton" style={{height:16,width:140,marginBottom:12}}/>
      {[1,2].map(i=><div key={i} className="skeleton" style={{height:52,marginBottom:8,borderRadius:10}}/>)}
    </div>
  );

  if (!insights.length) return (
    <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:'20px 18px',textAlign:'center'}}>
      <p style={{fontSize:11,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:10}}>Insights</p>
      <div style={{fontSize:28,marginBottom:8}}>✅</div>
      <p style={{fontSize:13,color:'var(--text3)'}}>Tudo em ordem por aqui!</p>
    </div>
  );

  return (
    <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'var(--radius)',overflow:'hidden'}}>

      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 18px 12px'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <p style={{fontSize:11,color:'var(--text3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.07em'}}>Insights</p>
          {criticalCount > 0 && (
            <span style={{fontSize:10,fontWeight:700,color:'var(--red)',background:'var(--red-dim)',borderRadius:5,padding:'2px 6px'}}>{criticalCount} urgente{criticalCount>1?'s':''}</span>
          )}
          {warningCount > 0 && (
            <span style={{fontSize:10,fontWeight:700,color:'var(--amber)',background:'rgba(245,166,35,0.12)',borderRadius:5,padding:'2px 6px'}}>{warningCount} alerta{warningCount>1?'s':''}</span>
          )}
        </div>
        <span style={{fontSize:11,color:'var(--text3)'}}>{insights.length} item{insights.length!==1?'s':''}</span>
      </div>

      {/* Lista */}
      <div style={{padding:'0 12px 12px',display:'flex',flexDirection:'column',gap:6}}>
        {shown.map((insight, i) => {
          const style = TYPE_STYLE[insight.type] || TYPE_STYLE.info;
          const color = PRIORITY_COLOR[insight.type] || 'var(--text3)';
          return (
            <div key={i} style={{background:style.bg,border:`1px solid ${style.border}`,borderRadius:10,padding:'11px 13px',display:'flex',alignItems:'flex-start',gap:10,cursor:insight.action?'pointer':'default',transition:'filter 0.15s'}}
              onMouseOver={e=>{if(insight.action)e.currentTarget.style.filter='brightness(1.05)';}}
              onMouseOut={e=>e.currentTarget.style.filter='none'}
              onClick={()=>insight.action&&navigate(insight.action.url)}>

              <span style={{fontSize:18,flexShrink:0,lineHeight:1.3}}>{insight.icon}</span>

              <div style={{flex:1,minWidth:0}}>
                <p style={{fontSize:13,fontWeight:600,color:'var(--text)',lineHeight:1.3,marginBottom:3}}>{insight.title}</p>
                <p style={{fontSize:12,color:'var(--text3)',lineHeight:1.5}}>{insight.body}</p>
              </div>

              {insight.action && (
                <div style={{flexShrink:0,marginLeft:4}}>
                  <span style={{fontSize:11,fontWeight:600,color,background:`${color}22`,borderRadius:6,padding:'3px 8px',whiteSpace:'nowrap'}}>
                    {insight.action.label} →
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Botão expandir */}
      {insights.length > 3 && (
        <button onClick={()=>setExpanded(v=>!v)}
          style={{width:'100%',padding:'10px 18px',background:'var(--bg3)',border:'none',borderTop:'1px solid var(--border)',cursor:'pointer',fontSize:12,color:'var(--text3)',fontFamily:'var(--font)',display:'flex',alignItems:'center',justifyContent:'center',gap:6,transition:'color 0.15s'}}
          onMouseOver={e=>e.currentTarget.style.color='var(--indigo)'}
          onMouseOut={e=>e.currentTarget.style.color='var(--text3)'}>
          {expanded
            ? '▲ Mostrar menos'
            : `▼ Ver mais ${insights.length - 3} insight${insights.length-3>1?'s':''}`}
        </button>
      )}
    </div>
  );
}
