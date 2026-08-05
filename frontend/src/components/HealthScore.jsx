import { useState, useEffect } from 'react';
import api from '../lib/api';

function ScoreArc({ score }) {
  const r      = 54;
  const circ   = 2 * Math.PI * r;
  const pct    = Math.min(100, Math.max(0, score)) / 100;
  const offset = circ * (1 - pct * 0.75); // arco de 270°

  const color = score >= 80 ? '#2dd4a0'
              : score >= 60 ? '#7c7ff7'
              : score >= 40 ? '#f5a623'
              : '#f05e6e';

  const label = score >= 80 ? 'Excelente' : score >= 60 ? 'Bom' : score >= 40 ? 'Regular' : 'Atenção';

  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
      <svg width={130} height={100} style={{overflow:'visible'}}>
        {/* Trilha de fundo */}
        <circle cx={65} cy={80} r={r} fill="none" stroke="var(--bg3)" strokeWidth={10}
          strokeDasharray={circ} strokeDashoffset={circ*0.25}
          strokeLinecap="round" transform="rotate(-225 65 80)"/>
        {/* Arco do score */}
        <circle cx={65} cy={80} r={r} fill="none" stroke={color} strokeWidth={10}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round" transform="rotate(-225 65 80)"
          style={{transition:'stroke-dashoffset 0.8s ease, stroke 0.4s'}}/>
        {/* Score central */}
        <text x={65} y={76} textAnchor="middle" fill="var(--text)" fontSize={26} fontWeight={700} fontFamily="var(--mono)">{score}</text>
        <text x={65} y={93} textAnchor="middle" fill={color} fontSize={11} fontWeight={600}>{label}</text>
      </svg>
    </div>
  );
}

export default function HealthScore() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [open,    setOpen]    = useState(false);

  useEffect(()=>{
    api.get('/api/insights/score').then(r=>{ setData(r.data); setLoading(false); }).catch(()=>setLoading(false));
  },[]);

  if (loading) return <div className="skeleton" style={{height:130,borderRadius:14}}/>;
  if (!data)   return null;

  return (
    <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:'16px 18px'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
        <p style={{fontSize:11,color:'var(--text3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.07em'}}>Score de saúde</p>
        <button onClick={()=>setOpen(v=>!v)} style={{fontSize:11,color:'var(--indigo)',background:'none',border:'none',cursor:'pointer',fontFamily:'var(--font)'}}>
          {open?'▲ ocultar':'▼ detalhes'}
        </button>
      </div>

      <div style={{display:'flex',alignItems:'center',gap:16}}>
        <ScoreArc score={data.score}/>
        <div style={{flex:1}}>
          {data.breakdown.slice(0,3).map(item=>(
            <div key={item.label} style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
              <span style={{fontSize:11,color:'var(--text2)'}}>{item.label}</span>
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <div style={{width:60,height:4,background:'var(--bg3)',borderRadius:99,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${item.pct}%`,background:item.color,borderRadius:99,transition:'width 0.5s'}}/>
                </div>
                <span style={{fontSize:11,fontFamily:'var(--mono)',color:item.color,fontWeight:600,minWidth:24}}>{item.pts}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {open&&(
        <div style={{borderTop:'1px solid var(--border)',marginTop:12,paddingTop:12}} className="fade-up">
          {data.breakdown.map(item=>(
            <div key={item.label} style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8,padding:'8px 10px',background:'var(--bg3)',borderRadius:8}}>
              <div>
                <p style={{fontSize:12,fontWeight:500,color:'var(--text)'}}>{item.label}</p>
                <p style={{fontSize:11,color:'var(--text3)',marginTop:2}}>{item.tip}</p>
              </div>
              <span style={{fontFamily:'var(--mono)',fontSize:14,fontWeight:700,color:item.color,flexShrink:0,marginLeft:10}}>{item.pts}<span style={{fontSize:10,color:'var(--text3)'}}>/20</span></span>
            </div>
          ))}
          <p style={{fontSize:11,color:'var(--text3)',textAlign:'center',marginTop:8}}>Score calculado com base nos dados do mês atual</p>
        </div>
      )}
    </div>
  );
}
