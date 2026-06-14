import { useState, useEffect } from 'react';
import api from '../lib/api';

const fmt    = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v);
const fmtPct = v => `${v>=0?'+':''}${v}%`;
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

export default function MonthlyAnalysis({ month, year }) {
  const [data,    setData]    = useState(null);
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try { const { data: res } = await api.get(`/api/summary/analysis?month=${month}&year=${year}`); setData(res); }
    catch(e){ console.error(e); }
    setLoading(false);
  }

  useEffect(() => { if (open) load(); }, [open, month, year]);

  const expColor = v => v===null?'var(--text3)':v>0?'var(--red)':v<0?'var(--green)':'var(--text2)';
  const incColor = v => v===null?'var(--text3)':v>0?'var(--green)':v<0?'var(--red)':'var(--text2)';

  return (
    <>
      <button onClick={()=>setOpen(true)} style={{padding:'8px 14px',borderRadius:10,border:'1px solid rgba(45,212,160,0.3)',background:'var(--green-dim)',color:'var(--green)',fontFamily:'var(--font)',fontSize:13,fontWeight:500,cursor:'pointer'}}>
        📊 Análise
      </button>

      {open && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.65)',backdropFilter:'blur(4px)',display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:50}} onClick={()=>setOpen(false)}>
          <div style={{background:'var(--bg2)',border:'1px solid var(--border-md)',borderRadius:'18px 18px 0 0',width:'100%',maxWidth:560,padding:'8px 24px 36px',maxHeight:'90vh',overflowY:'auto',boxShadow:'var(--shadow)'}} className="fade-up" onClick={e=>e.stopPropagation()}>
            <div style={{width:36,height:4,borderRadius:2,background:'var(--bg3)',margin:'10px auto 20px'}}/>

            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:22}}>
              <div>
                <h2 style={{fontSize:16,fontWeight:600}}>Análise do mês</h2>
                <p style={{fontSize:12,color:'var(--text3)',marginTop:2}}>{MONTHS[month-1]} {year}</p>
              </div>
              <button onClick={()=>setOpen(false)} style={{width:28,height:28,borderRadius:7,border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text2)',cursor:'pointer',fontSize:16}}>×</button>
            </div>

            {loading ? (
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {[1,2,3,4,5].map(i=><div key={i} className="skeleton" style={{height:20,width:i%2===0?'65%':'100%'}}/>)}
              </div>
            ) : !data ? null : (
              <div style={{display:'flex',flexDirection:'column',gap:16}}>

                {/* Cards 2x2 */}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  {[
                    {label:'Receitas',   value:fmt(data.income),  color:'var(--green)'},
                    {label:'Despesas',   value:fmt(data.expense), color:'var(--red)'},
                    {label:'Saldo',      value:fmt(data.balance), color:data.balance>=0?'var(--indigo)':'var(--red)'},
                    {label:'Transações', value:`${data.txCount}`, color:'var(--text)'},
                  ].map(c=>(
                    <div key={c.label} style={{background:'var(--bg3)',borderRadius:10,padding:'12px 14px'}}>
                      <p style={{fontSize:11,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:6}}>{c.label}</p>
                      <p style={{fontFamily:'var(--mono)',fontSize:15,fontWeight:600,color:c.color}}>{c.value}</p>
                    </div>
                  ))}
                </div>

                {/* Taxa de poupança */}
                <div style={{background:'var(--bg3)',borderRadius:10,padding:'14px 16px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                    <span style={{fontSize:13,fontWeight:500}}>Taxa de poupança</span>
                    <span style={{fontFamily:'var(--mono)',fontSize:14,fontWeight:600,color:data.savingRate>=20?'var(--green)':data.savingRate>=0?'var(--amber)':'var(--red)'}}>{data.savingRate}%</span>
                  </div>
                  <div style={{height:6,background:'var(--bg2)',borderRadius:99,overflow:'hidden'}}>
                    <div style={{height:'100%',width:`${Math.max(0,Math.min(100,data.savingRate))}%`,background:data.savingRate>=20?'var(--green)':data.savingRate>=0?'var(--amber)':'var(--red)',borderRadius:99,transition:'width 0.4s'}}/>
                  </div>
                  <p style={{fontSize:11,color:'var(--text3)',marginTop:8}}>
                    {data.savingRate>=20?'✓ Ótimo! Você poupou mais de 20% da renda.':data.savingRate>=10?'⚡ Razoável. Tente chegar a 20%.':data.savingRate>=0?'⚠️ Abaixo do ideal. Tente reduzir gastos.':'🔴 Você gastou mais do que ganhou.'}
                  </p>
                </div>

                {/* Comparação mês anterior */}
                {(data.incomeVar!==null||data.expenseVar!==null) && (
                  <div style={{background:'var(--bg3)',borderRadius:10,padding:'14px 16px'}}>
                    <p style={{fontSize:12,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:12,fontWeight:600}}>vs. mês anterior</p>
                    <div style={{display:'flex',flexDirection:'column',gap:10}}>
                      {data.incomeVar!==null&&(
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                          <span style={{fontSize:13,color:'var(--text2)'}}>Receitas</span>
                          <div style={{display:'flex',alignItems:'center',gap:8}}>
                            <span style={{fontSize:11,color:'var(--text3)'}}>{fmt(data.prevIncome)} → {fmt(data.income)}</span>
                            <span style={{fontFamily:'var(--mono)',fontSize:13,fontWeight:600,color:incColor(data.incomeVar)}}>{fmtPct(data.incomeVar)}</span>
                          </div>
                        </div>
                      )}
                      {data.expenseVar!==null&&(
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                          <span style={{fontSize:13,color:'var(--text2)'}}>Despesas</span>
                          <div style={{display:'flex',alignItems:'center',gap:8}}>
                            <span style={{fontSize:11,color:'var(--text3)'}}>{fmt(data.prevExpense)} → {fmt(data.expense)}</span>
                            <span style={{fontFamily:'var(--mono)',fontSize:13,fontWeight:600,color:expColor(data.expenseVar)}}>{fmtPct(data.expenseVar)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Top categorias */}
                {data.topCategories?.length>0 && (
                  <div style={{background:'var(--bg3)',borderRadius:10,padding:'14px 16px'}}>
                    <p style={{fontSize:12,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:12,fontWeight:600}}>Maiores despesas</p>
                    <div style={{display:'flex',flexDirection:'column',gap:12}}>
                      {data.topCategories.map((cat,i)=>(
                        <div key={cat.name}>
                          <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
                            <span style={{fontSize:13,color:'var(--text)'}}>{i+1}. {cat.name}</span>
                            <div style={{display:'flex',gap:8,alignItems:'center'}}>
                              <span style={{fontSize:11,color:'var(--text3)'}}>{cat.pct}%</span>
                              <span style={{fontFamily:'var(--mono)',fontSize:13,fontWeight:500,color:'var(--red)'}}>{fmt(cat.value)}</span>
                            </div>
                          </div>
                          <div style={{height:5,background:'var(--bg2)',borderRadius:99,overflow:'hidden'}}>
                            <div style={{height:'100%',width:`${cat.pct}%`,background:`hsl(${220+i*30},65%,60%)`,borderRadius:99}}/>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Dica */}
                <div style={{background:'var(--indigo-dim)',border:'1px solid rgba(124,127,247,0.2)',borderRadius:10,padding:'14px 16px'}}>
                  <p style={{fontSize:13,color:'var(--indigo)',fontWeight:600,marginBottom:6}}>💡 Dica do mês</p>
                  <p style={{fontSize:13,color:'var(--text2)',lineHeight:1.6}}>
                    {data.savingRate<0
                      ?`Suas despesas superaram as receitas em ${fmt(Math.abs(data.balance))}. Revise os gastos variáveis e crie um orçamento para o próximo mês.`
                      :data.topCategories?.[0]
                        ?`Sua maior despesa foi em "${data.topCategories[0].name}" (${data.topCategories[0].pct}% do total). Avaliar se há espaço para redução pode gerar economia significativa.`
                        :'Continue monitorando seus gastos para identificar padrões e oportunidades de economia.'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
