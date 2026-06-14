import { useState } from 'react';
import Navbar from '../components/Navbar';

const fmt = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v);
const inp = { width:'100%', padding:'11px 12px', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text)' };
const lbl = { display:'block', fontSize:12, color:'var(--text2)', fontWeight:500, marginBottom:5, letterSpacing:'0.02em' };
const box = { background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:12, padding:'16px', marginTop:18 };

function F({label,children}){ return <div><label style={lbl}>{label}</label>{children}</div>; }
function RR({label,value,color,big}){
  return(
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:big?'10px 0 0':'7px 0',borderBottom:big?'none':'1px solid var(--border)'}}>
      <span style={{fontSize:big?14:13,fontWeight:big?600:400,color:big?'var(--text)':'var(--text2)'}}>{label}</span>
      <span style={{fontFamily:'var(--mono)',fontSize:big?20:13,fontWeight:big?700:500,color:color||'var(--text)'}}>{value}</span>
    </div>
  );
}

function Compound(){
  const [f,setF]=useState({p:0,rate:0,period:'monthly',n:12,m:0});
  const mr=(f.period==='yearly'?f.rate/12:f.rate)/100;
  let total=Number(f.p)*Math.pow(1+mr,f.n);
  if(f.m>0&&mr>0) total+=Number(f.m)*(Math.pow(1+mr,f.n)-1)/mr;
  const invested=Number(f.p)+Number(f.m)*f.n;
  return(<div style={{display:'flex',flexDirection:'column',gap:14}}>
    <F label="CAPITAL INICIAL (R$)"><input type="number" style={inp} value={f.p} onChange={e=>setF({...f,p:e.target.value})} placeholder="1000"/></F>
    <F label="APORTE MENSAL (R$)"><input type="number" style={inp} value={f.m} onChange={e=>setF({...f,m:e.target.value})} placeholder="0"/></F>
    <F label="TAXA DE JUROS (%)"><div style={{display:'flex',gap:8}}>
      <input type="number" style={{...inp,flex:1}} value={f.rate} onChange={e=>setF({...f,rate:e.target.value})} placeholder="1"/>
      <select style={{...inp,width:110}} value={f.period} onChange={e=>setF({...f,period:e.target.value})}><option value="monthly">ao mês</option><option value="yearly">ao ano</option></select>
    </div></F>
    <F label="PERÍODO (MESES)"><input type="number" style={inp} value={f.n} onChange={e=>setF({...f,n:e.target.value})} placeholder="12"/></F>
    <div style={box}><RR label="Total investido" value={fmt(invested)}/><RR label="Rendimento" value={fmt(total-invested)} color="var(--green)"/><RR label="Montante final" value={fmt(total)} color="var(--indigo)" big/></div>
  </div>);
}

function Simple(){
  const [f,setF]=useState({p:0,rate:0,period:'monthly',n:12});
  const mr=f.period==='yearly'?f.rate/12:f.rate;
  const gain=Number(f.p)*(mr/100)*f.n;
  return(<div style={{display:'flex',flexDirection:'column',gap:14}}>
    <F label="CAPITAL (R$)"><input type="number" style={inp} value={f.p} onChange={e=>setF({...f,p:e.target.value})} placeholder="1000"/></F>
    <F label="TAXA (%)"><div style={{display:'flex',gap:8}}>
      <input type="number" style={{...inp,flex:1}} value={f.rate} onChange={e=>setF({...f,rate:e.target.value})} placeholder="1"/>
      <select style={{...inp,width:110}} value={f.period} onChange={e=>setF({...f,period:e.target.value})}><option value="monthly">ao mês</option><option value="yearly">ao ano</option></select>
    </div></F>
    <F label="PERÍODO (MESES)"><input type="number" style={inp} value={f.n} onChange={e=>setF({...f,n:e.target.value})} placeholder="12"/></F>
    <div style={box}><RR label="Juros" value={fmt(gain)} color="var(--green)"/><RR label="Total" value={fmt(Number(f.p)+gain)} color="var(--indigo)" big/></div>
  </div>);
}

function Loan(){
  const [f,setF]=useState({v:0,rate:0,n:36});
  const mr=f.rate/100;
  const pmt=mr>0?Number(f.v)*mr*Math.pow(1+mr,f.n)/(Math.pow(1+mr,f.n)-1):Number(f.v)/Math.max(1,f.n);
  const total=pmt*f.n;
  return(<div style={{display:'flex',flexDirection:'column',gap:14}}>
    <F label="VALOR DO FINANCIAMENTO (R$)"><input type="number" style={inp} value={f.v} onChange={e=>setF({...f,v:e.target.value})} placeholder="100000"/></F>
    <F label="TAXA MENSAL (%)"><input type="number" style={inp} value={f.rate} onChange={e=>setF({...f,rate:e.target.value})} placeholder="1"/></F>
    <F label="PRAZO (MESES)"><input type="number" style={inp} value={f.n} onChange={e=>setF({...f,n:e.target.value})} placeholder="36"/></F>
    <div style={box}><RR label="Parcela mensal" value={fmt(pmt)} color="var(--indigo)"/><RR label="Total pago" value={fmt(total)}/><RR label="Total de juros" value={fmt(total-Number(f.v))} color="var(--red)" big/></div>
  </div>);
}

function Vacation(){
  const [f,setF]=useState({s:0,n:12,d:0});
  const gross=Number(f.s)/12*Number(f.n), third=gross/3;
  const disc=Number(f.d)>0?(Number(f.d)/30)*gross:0;
  const net=gross+third-disc, inss=net*0.075;
  return(<div style={{display:'flex',flexDirection:'column',gap:14}}>
    <F label="SALÁRIO BRUTO (R$)"><input type="number" style={inp} value={f.s} onChange={e=>setF({...f,s:e.target.value})} placeholder="3000"/></F>
    <F label="MESES TRABALHADOS"><input type="number" style={inp} min="1" max="12" value={f.n} onChange={e=>setF({...f,n:e.target.value})} placeholder="12"/></F>
    <F label="DIAS DE FALTA"><input type="number" style={inp} value={f.d} onChange={e=>setF({...f,d:e.target.value})} placeholder="0"/></F>
    <div style={box}><RR label="Férias brutas" value={fmt(gross)}/><RR label="⅓ constitucional" value={fmt(third)} color="var(--green)"/><RR label="INSS aprox." value={`-${fmt(inss)}`} color="var(--red)"/><RR label="Férias líquidas" value={fmt(net-inss)} color="var(--indigo)" big/></div>
  </div>);
}

function Bonus(){
  const [f,setF]=useState({s:0,n:12});
  const gross=Number(f.s)/12*Number(f.n), inss=gross*0.075, base=gross-inss;
  const irrf=base>4664?base*0.275:base>3751?base*0.225:base>2826?base*0.15:base>2259?base*0.075:0;
  return(<div style={{display:'flex',flexDirection:'column',gap:14}}>
    <F label="SALÁRIO BRUTO (R$)"><input type="number" style={inp} value={f.s} onChange={e=>setF({...f,s:e.target.value})} placeholder="3000"/></F>
    <F label="MESES TRABALHADOS"><input type="number" style={inp} min="1" max="12" value={f.n} onChange={e=>setF({...f,n:e.target.value})} placeholder="12"/></F>
    <div style={box}><RR label="13º bruto" value={fmt(gross)}/><RR label="INSS aprox." value={`-${fmt(inss)}`} color="var(--red)"/><RR label="IRRF aprox." value={`-${fmt(irrf)}`} color="var(--red)"/><RR label="13º líquido" value={fmt(gross-inss-irrf)} color="var(--indigo)" big/></div>
  </div>);
}

function Fgts(){
  const [f,setF]=useState({s:0,n:12,fired:false});
  const monthly=Number(f.s)*0.08, total=monthly*Number(f.n), fine=f.fired?total*0.4:0;
  return(<div style={{display:'flex',flexDirection:'column',gap:14}}>
    <F label="SALÁRIO BRUTO (R$)"><input type="number" style={inp} value={f.s} onChange={e=>setF({...f,s:e.target.value})} placeholder="3000"/></F>
    <F label="MESES TRABALHADOS"><input type="number" style={inp} value={f.n} onChange={e=>setF({...f,n:e.target.value})} placeholder="12"/></F>
    <F label="DEMISSÃO SEM JUSTA CAUSA?"><div style={{display:'flex',gap:8}}>
      {[['Sim',true],['Não',false]].map(([l,v])=>(
        <button key={l} type="button" onClick={()=>setF({...f,fired:v})} style={{flex:1,padding:'10px',borderRadius:8,border:`1.5px solid ${f.fired===v?'var(--indigo)':'var(--border)'}`,background:f.fired===v?'var(--indigo-dim)':'var(--bg3)',color:f.fired===v?'var(--indigo)':'var(--text2)',cursor:'pointer',fontFamily:'var(--font)',fontSize:13}}>{l}</button>
      ))}
    </div></F>
    <div style={box}><RR label="Depósito mensal (8%)" value={fmt(monthly)}/><RR label="Total acumulado" value={fmt(total)}/>{f.fired&&<RR label="Multa 40%" value={fmt(fine)} color="var(--green)"/>}<RR label="Total a receber" value={fmt(total+fine)} color="var(--indigo)" big/></div>
  </div>);
}

const CALCS=[
  {id:'compound',label:'Juros Compostos',icon:'📈',C:Compound},
  {id:'simple',  label:'Juros Simples',  icon:'📊',C:Simple},
  {id:'loan',    label:'Financiamento',  icon:'🏠',C:Loan},
  {id:'vacation',label:'Férias',         icon:'🏖',C:Vacation},
  {id:'bonus',   label:'13º Salário',    icon:'🎁',C:Bonus},
  {id:'fgts',    label:'FGTS',           icon:'🏦',C:Fgts},
];

export default function CalculatorsPage(){
  const [active,setActive]=useState('compound');
  const cur=CALCS.find(c=>c.id===active);
  return(
    <div style={{minHeight:'100vh',background:'var(--bg)'}}>
      <Navbar/>
      <main className="page-main" style={{maxWidth:640,margin:'0 auto',padding:'24px 16px 80px'}}>
        <div style={{marginBottom:24}}>
          <h1 style={{fontSize:20,fontWeight:600,letterSpacing:'-0.03em'}}>Calculadoras</h1>
          <p style={{color:'var(--text3)',fontSize:13,marginTop:4}}>Simuladores financeiros e trabalhistas</p>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:24}}>
          {CALCS.map(c=>(
            <button key={c.id} onClick={()=>setActive(c.id)} style={{padding:'12px 6px',borderRadius:12,cursor:'pointer',textAlign:'center',border:`1.5px solid ${active===c.id?'var(--indigo)':'var(--border)'}`,background:active===c.id?'var(--indigo-dim)':'var(--bg2)',fontFamily:'var(--font)',transition:'all 0.15s'}}>
              <div style={{fontSize:20,marginBottom:4}}>{c.icon}</div>
              <div style={{fontSize:12,fontWeight:500,color:active===c.id?'var(--indigo)':'var(--text)',lineHeight:1.2}}>{c.label}</div>
            </button>
          ))}
        </div>
        <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:16,padding:'22px 20px'}}>
          <h2 style={{fontSize:15,fontWeight:600,marginBottom:20}}>{cur.icon} {cur.label}</h2>
          <cur.C/>
        </div>
        <p style={{fontSize:11,color:'var(--text3)',textAlign:'center',marginTop:16,lineHeight:1.6}}>
          ⚠️ Valores aproximados. INSS e IRRF com alíquotas simplificadas. Consulte um contador para valores exatos.
        </p>
      </main>
    </div>
  );
}
