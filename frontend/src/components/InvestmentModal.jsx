import { useState, useEffect } from 'react';
import api from '../lib/api';

const TYPES=[
  {value:'stocks',       label:'Ações',     icon:'📈'},
  {value:'fiis',         label:'FIIs',       icon:'🏢'},
  {value:'crypto',       label:'Cripto',     icon:'₿' },
  {value:'fixed_income', label:'Renda Fixa', icon:'🏦'},
  {value:'treasury',     label:'Tesouro',    icon:'🏛' },
];
const inp={width:'100%',padding:'11px 14px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:8,color:'var(--text)'};
const lbl={display:'block',fontSize:12,color:'var(--text2)',fontWeight:500,marginBottom:6,letterSpacing:'0.02em'};
const fmt=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v);

function calcProjection(initial,rate,period,months){
  if(!rate||!initial||!months) return null;
  const mr=period==='yearly'?rate/12:rate;
  return Number(initial)*Math.pow(1+mr/100,Number(months));
}

export default function InvestmentModal({investment,onClose,onSave}){
  const [form,setForm]=useState({name:'',ticker:'',type:'stocks',initial_amount:'',rate:'',rate_period:'yearly',maturity_date:''});
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const isFixed=['fixed_income','treasury'].includes(form.type);
  const needsTicker=['stocks','fiis','crypto'].includes(form.type);

  useEffect(()=>{
    if(investment) setForm({name:investment.name,ticker:investment.ticker||'',type:investment.type,initial_amount:investment.initial_amount||'',rate:investment.rate||'',rate_period:investment.rate_period||'yearly',maturity_date:investment.maturity_date||''});
  },[investment]);

  async function handleSubmit(e){
    e.preventDefault(); setError(''); setLoading(true);
    try{
      if(investment) await api.put(`/api/investments/${investment.id}`,form);
      else           await api.post('/api/investments',form);
      onSave();
    }catch(err){setError(err.response?.data?.error||'Erro ao salvar');}
    finally{setLoading(false);}
  }

  const mths=form.maturity_date?Math.max(1,Math.round((new Date(form.maturity_date)-new Date())/(1000*60*60*24*30.44))):12;
  const proj=isFixed?calcProjection(form.initial_amount,form.rate,form.rate_period,mths):null;

  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.65)',backdropFilter:'blur(4px)',display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:50}} onClick={onClose}>
      <div style={{background:'var(--bg2)',border:'1px solid var(--border-md)',borderRadius:'18px 18px 0 0',width:'100%',maxWidth:480,padding:'8px 24px 32px',maxHeight:'92vh',overflowY:'auto',boxShadow:'var(--shadow)'}} className="fade-up" onClick={e=>e.stopPropagation()}>
        <div style={{width:36,height:4,borderRadius:2,background:'var(--bg3)',margin:'10px auto 20px'}}/>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:22}}>
          <h2 style={{fontSize:16,fontWeight:600}}>{investment?'Editar':'Novo'} investimento</h2>
          <button onClick={onClose} style={{width:28,height:28,borderRadius:7,border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text2)',cursor:'pointer',fontSize:16}}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            <div>
              <label style={lbl}>TIPO</label>
              <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:8}}>
                {TYPES.map(t=>(
                  <button key={t.value} type="button" onClick={()=>setForm({...form,type:t.value})} style={{padding:'10px 4px',borderRadius:10,cursor:'pointer',textAlign:'center',border:`1.5px solid ${form.type===t.value?'var(--indigo)':'var(--border)'}`,background:form.type===t.value?'var(--indigo-dim)':'var(--bg3)',fontFamily:'var(--font)',transition:'all 0.15s'}}>
                    <div style={{fontSize:18,marginBottom:4}}>{t.icon}</div>
                    <div style={{fontSize:10,color:form.type===t.value?'var(--indigo)':'var(--text3)'}}>{t.label}</div>
                  </button>
                ))}
              </div>
            </div>
            <div><label style={lbl}>NOME</label>
              <input type="text" required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder={isFixed?'Ex: CDB Nubank 13% a.a.':'Ex: Petrobras, Bitcoin...'} style={inp}/>
            </div>
            {needsTicker&&(
              <div><label style={lbl}>TICKER {form.type==='crypto'?'(BTC, ETH...)':'(PETR4, MXRF11...)'}</label>
                <input type="text" value={form.ticker} onChange={e=>setForm({...form,ticker:e.target.value.toUpperCase()})} placeholder={form.type==='crypto'?'BTC':'PETR4'} style={{...inp,fontFamily:'var(--mono)'}}/>
                <p style={{fontSize:11,color:'var(--text3)',marginTop:4}}>{form.type==='crypto'?'Cotação via CoinGecko':'Cotação via brapi.dev'} (gratuito)</p>
              </div>
            )}
            {isFixed&&(<>
              <div><label style={lbl}>VALOR INVESTIDO (R$)</label>
                <input type="number" step="0.01" min="0" required value={form.initial_amount} onChange={e=>setForm({...form,initial_amount:e.target.value})} placeholder="10000,00" style={{...inp,fontFamily:'var(--mono)',color:'var(--green)'}}/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div><label style={lbl}>TAXA (%)</label>
                  <input type="number" step="0.01" min="0" required value={form.rate} onChange={e=>setForm({...form,rate:e.target.value})} placeholder="13.5" style={{...inp,fontFamily:'var(--mono)',color:'var(--indigo)'}}/>
                </div>
                <div><label style={lbl}>PERÍODO</label>
                  <select value={form.rate_period} onChange={e=>setForm({...form,rate_period:e.target.value})} style={inp}>
                    <option value="yearly">ao ano (a.a.)</option>
                    <option value="monthly">ao mês (a.m.)</option>
                  </select>
                </div>
              </div>
              <div><label style={lbl}>VENCIMENTO (OPCIONAL)</label>
                <input type="date" value={form.maturity_date} onChange={e=>setForm({...form,maturity_date:e.target.value})} style={inp}/>
              </div>
              {proj&&form.initial_amount&&form.rate&&(
                <div style={{background:'var(--green-dim)',border:'1px solid rgba(45,212,160,0.2)',borderRadius:10,padding:'14px 16px'}}>
                  <p style={{fontSize:12,color:'var(--text3)',marginBottom:10}}>📊 Projeção até {form.maturity_date?new Date(form.maturity_date+'T00:00:00').toLocaleDateString('pt-BR'):`${mths} meses`}</p>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div><p style={{fontSize:11,color:'var(--text3)'}}>Investido</p><p style={{fontFamily:'var(--mono)',fontSize:14,color:'var(--text)'}}>{fmt(form.initial_amount)}</p></div>
                    <span style={{color:'var(--text3)',fontSize:18}}>→</span>
                    <div style={{textAlign:'right'}}><p style={{fontSize:11,color:'var(--text3)'}}>Projetado</p><p style={{fontFamily:'var(--mono)',fontSize:18,fontWeight:700,color:'var(--green)'}}>{fmt(proj)}</p></div>
                  </div>
                  <p style={{fontSize:11,color:'var(--green)',marginTop:10}}>+{fmt(proj-form.initial_amount)} ({((proj/form.initial_amount-1)*100).toFixed(2)}%)</p>
                </div>
              )}
            </>)}
            {error&&<p style={{fontSize:13,color:'var(--red)',background:'var(--red-dim)',borderRadius:8,padding:'10px 12px'}}>{error}</p>}
            <div style={{display:'flex',gap:10}}>
              <button type="button" onClick={onClose} style={{flex:1,padding:'13px 0',borderRadius:10,fontSize:14,fontWeight:500,border:'1px solid var(--border)',background:'transparent',color:'var(--text2)',cursor:'pointer',fontFamily:'var(--font)'}}>Cancelar</button>
              <button type="submit" disabled={loading} style={{flex:2,padding:'13px 0',borderRadius:10,fontSize:14,fontWeight:600,border:'none',cursor:'pointer',fontFamily:'var(--font)',background:loading?'var(--bg3)':'linear-gradient(135deg,var(--indigo),#a78bfa)',color:loading?'var(--text3)':'#fff'}}>{loading?'Salvando...':'Salvar'}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
