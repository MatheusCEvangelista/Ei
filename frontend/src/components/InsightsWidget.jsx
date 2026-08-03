import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

const TYPE_STYLE = {
  critical:  { border:'rgba(240,94,110,0.35)',  bg:'rgba(240,94,110,0.06)'  },
  warning:   { border:'rgba(245,166,35,0.35)',  bg:'rgba(245,166,35,0.06)'  },
  attention: { border:'rgba(124,127,247,0.35)', bg:'rgba(124,127,247,0.06)' },
  info:      { border:'rgba(139,144,164,0.2)',  bg:'transparent'             },
};

export default function InsightsWidget() {
  const [insights, setInsights] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/api/insights')
      .then(r => { setInsights(r.data); setLoading(false); })
      .catch(()  => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:'18px'}}>
      <div className="skeleton" style={{height:14,width:100,marginBottom:12,borderRadius:6}}/>
      {[1,2].map(i=><div key={i} className="skeleton" style={{height:56,borderRadius:10,marginBottom:8}}/>)}
    </div>
  );

  if (!insights.length) return (
    <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:'18px',textAlign:'center'}}>
      <p style={{fontSize:11,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:10}}>Insights</p>
      <div style={{fontSize:28,marginBottom:6}}>✅</div>
      <p style={{fontSize:13,color:'var(--text3)'}}>Tudo em ordem por aqui!</p>
    </div>
  );

  return (
    <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'var(--radius)',overflow:'hidden'}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 16px 10px'}}>
        <p style={{fontSize:11,color:'var(--text3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.07em'}}>
          Insights do dia
        </p>
        <span style={{fontSize:11,color:'var(--text3)'}}>
          {insights.length} de hoje
        </span>
      </div>

      {/* Cards */}
      <div style={{padding:'0 12px 12px',display:'flex',flexDirection:'column',gap:8}}>
        {insights.map((insight, i) => {
          const style = TYPE_STYLE[insight.type] || TYPE_STYLE.info;
          return (
            <div key={i}
              style={{
                background:style.bg, border:`1px solid ${style.border}`,
                borderRadius:10, padding:'12px',
                cursor:insight.action?'pointer':'default',
                transition:'filter 0.15s',
              }}
              onMouseOver={e=>{if(insight.action)e.currentTarget.style.filter='brightness(1.05)';}}
              onMouseOut={e=>e.currentTarget.style.filter='none'}
              onClick={()=>insight.action&&navigate(insight.action.url)}
            >
              {/* Linha 1: ícone + título */}
              <div style={{display:'flex',alignItems:'flex-start',gap:8,marginBottom:5}}>
                <span style={{fontSize:17,flexShrink:0,lineHeight:1.3}}>{insight.icon}</span>
                <p style={{fontSize:13,fontWeight:600,color:'var(--text)',lineHeight:1.3,flex:1,minWidth:0}}>
                  {insight.title}
                </p>
              </div>

              {/* Linha 2: corpo */}
              <p style={{fontSize:12,color:'var(--text3)',lineHeight:1.5,marginLeft:25,marginBottom:insight.action?8:0}}>
                {insight.body}
              </p>

              {/* Ação */}
              {insight.action && (
                <div style={{marginLeft:25}}>
                  <span style={{
                    fontSize:11,fontWeight:600,color:'var(--indigo)',
                    background:'var(--indigo-dim)',borderRadius:6,
                    padding:'3px 9px',whiteSpace:'nowrap',display:'inline-block',
                  }}>
                    {insight.action.label} →
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
