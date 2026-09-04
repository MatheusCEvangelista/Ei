import { useState, useEffect } from 'react';
import { PageShell, PageHeader, Card, SkeletonList, SectionLabel, InfoBox, Badge } from '../components/ui';
import api from '../lib/api';

const fmt = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);

function ScoreGauge({ score }) {
  const color = score >= 70 ? 'var(--green)' : score >= 50 ? 'var(--amber)' : 'var(--red)';
  const label = score >= 80 ? 'Excelente 🏆' : score >= 70 ? 'Ótimo 😎' : score >= 50 ? 'Regular 🦎' : score >= 30 ? 'Atenção ⚠️' : 'Crítico 🔴';
  const pct   = score; // 0-100

  return (
    <div style={{textAlign:'center',padding:'var(--space-5) var(--space-4)'}}>
      <div style={{position:'relative',width:160,height:80,margin:'0 auto var(--space-3)'}}>
        <svg viewBox="0 0 160 80" style={{width:'100%',overflow:'visible'}}>
          {/* Track */}
          <path d="M 10 80 A 70 70 0 0 1 150 80" fill="none" stroke="var(--bg3)" strokeWidth="14" strokeLinecap="round"/>
          {/* Fill */}
          <path d="M 10 80 A 70 70 0 0 1 150 80" fill="none" stroke={color} strokeWidth="14" strokeLinecap="round"
            strokeDasharray={`${pct * 2.2} 220`} style={{transition:'stroke-dasharray 1s ease'}}/>
        </svg>
        <div style={{position:'absolute',bottom:0,left:'50%',transform:'translateX(-50%)',textAlign:'center'}}>
          <p style={{fontFamily:'var(--mono)',fontSize:36,fontWeight:'var(--font-bold)',color,lineHeight:1}}>{score}</p>
          <p style={{fontSize:'var(--text-xs)',color:'var(--text3)'}}>de 100</p>
        </div>
      </div>
      <p style={{fontSize:'var(--text-md)',fontWeight:'var(--font-semibold)',color}}>{label}</p>
    </div>
  );
}

function CriteriaBar({ label, pts, maxPts, color, tip }) {
  const pct = maxPts > 0 ? Math.round(pts / maxPts * 100) : 0;
  return (
    <div style={{marginBottom:'var(--space-4)'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'var(--space-1)'}}>
        <div>
          <span style={{fontSize:'var(--text-sm)',fontWeight:'var(--font-medium)',color:'var(--text)'}}>{label}</span>
          {tip && <p style={{fontSize:'var(--text-xs)',color:'var(--text3)',marginTop:2}}>{tip}</p>}
        </div>
        <span style={{fontFamily:'var(--mono)',fontSize:'var(--text-sm)',fontWeight:'var(--font-bold)',color,marginLeft:'var(--space-3)',flexShrink:0}}>
          {pts}/{maxPts}
        </span>
      </div>
      <div style={{height:8,background:'var(--bg3)',borderRadius:'var(--radius-full)',overflow:'hidden'}}>
        <div style={{height:'100%',width:`${pct}%`,background:color,borderRadius:'var(--radius-full)',transition:'width 0.8s ease'}}/>
      </div>
    </div>
  );
}

export default function HealthScorePage() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    api.get('/api/insights/score')
      .then(r=>setData(r.data))
      .catch(()=>{})
      .finally(()=>setLoading(false));
  },[]);

  const COLOR_MAP = {
    green: 'var(--green)', red: 'var(--red)',
    amber: 'var(--amber)', indigo: 'var(--indigo)', blue: 'var(--blue)',
  };

  const TIPS = {
    'Taxa de poupança':     'Ideal: guardar pelo menos 20% da renda mensal.',
    'Controle de tetos':    'Tetos respeitados = gastos planejados.',
    'Regularidade':         'Meses com movimentação mostram hábito financeiro.',
    'Saldo positivo':       'Mais receitas que despesas no mês atual.',
    'Metas ativas':         'Ter metas ativas demonstra planejamento de longo prazo.',
  };

  return (
    <PageShell maxWidth={640}>
      <PageHeader title="Score de saúde financeira" subtitle="Análise dos seus hábitos financeiros — atualizada todo mês"/>

      {loading ? <SkeletonList n={4} h={80}/> :
       !data ? (
        <InfoBox variant="warning">Dados insuficientes para calcular o score. Registre transações por pelo menos 1 mês.</InfoBox>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:'var(--space-4)'}}>

          {/* Gauge principal */}
          <Card>
            <ScoreGauge score={data.score}/>
            <div style={{borderTop:'1px solid var(--border)',padding:'var(--space-4)',textAlign:'center'}}>
              <p style={{fontSize:'var(--text-xs)',color:'var(--text3)',lineHeight:1.6}}>
                Score calculado com base em 5 critérios: poupança, controle de tetos, regularidade, saldo positivo e metas.
              </p>
            </div>
          </Card>

          {/* Critérios detalhados */}
          <Card>
            <div style={{padding:'var(--space-5)'}}>
              <SectionLabel style={{marginBottom:'var(--space-4)'}}>Critérios avaliados</SectionLabel>
              {(data.breakdown||[]).map((item,i)=>(
                <CriteriaBar
                  key={i}
                  label={item.label}
                  pts={item.pts}
                  maxPts={item.max||20}
                  color={COLOR_MAP[item.colorKey]||'var(--indigo)'}
                  tip={TIPS[item.label]}
                />
              ))}
            </div>
          </Card>

          {/* Sugestões para melhorar */}
          {data.suggestions?.length > 0 && (
            <Card>
              <div style={{padding:'var(--space-5)'}}>
                <SectionLabel style={{marginBottom:'var(--space-3)'}}>Como melhorar seu score</SectionLabel>
                <div style={{display:'flex',flexDirection:'column',gap:'var(--space-2)'}}>
                  {data.suggestions.map((s,i)=>(
                    <InfoBox key={i} variant="info">
                      <strong>{s.label}:</strong> {s.tip}
                    </InfoBox>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* Histórico de scores se disponível */}
          {data.history?.length > 1 && (
            <Card>
              <div style={{padding:'var(--space-5)'}}>
                <SectionLabel style={{marginBottom:'var(--space-3)'}}>Evolução do score</SectionLabel>
                <div style={{display:'flex',gap:'var(--space-2)',alignItems:'flex-end',height:60}}>
                  {data.history.map((h,i)=>{
                    const barH = Math.max(4, h.score * 0.6);
                    const c    = h.score>=70?'var(--green)':h.score>=50?'var(--amber)':'var(--red)';
                    return (
                      <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
                        <span style={{fontSize:9,color:'var(--text3)',fontFamily:'var(--mono)'}}>{h.score}</span>
                        <div style={{width:'100%',height:barH,background:c,borderRadius:'var(--radius-sm) var(--radius-sm) 0 0',transition:'height 0.5s'}}/>
                        <span style={{fontSize:9,color:'var(--text3)'}}>{h.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          )}
        </div>
      )}
    </PageShell>
  );
}
