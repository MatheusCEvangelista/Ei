import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../lib/api';
import Navbar from '../components/Navbar';

const fmt  = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);
const fmtK = v => Math.abs(v)>=1000?`R$${(v/1000).toFixed(1)}k`:fmt(v);

const TYPE_LABEL = { stocks:'Ações', fiis:'FIIs', crypto:'Cripto', fixed_income:'Renda Fixa', treasury:'Tesouro' };

function Section({ title, total, color, items, renderItem }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:14,overflow:'hidden',marginBottom:12}}>
      <button onClick={()=>setOpen(v=>!v)} style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 18px',background:'transparent',border:'none',cursor:'pointer',fontFamily:'var(--font)'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{width:10,height:10,borderRadius:'50%',background:color,display:'inline-block'}}/>
          <span style={{fontSize:13,fontWeight:600,color:'var(--text)'}}>{title}</span>
          <span style={{fontSize:11,color:'var(--text3)'}}>{items.length} item{items.length!==1?'s':''}</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontFamily:'var(--mono)',fontSize:14,fontWeight:700,color}}>{fmt(total)}</span>
          <span style={{fontSize:11,color:'var(--text3)'}}>{open?'▲':'▼'}</span>
        </div>
      </button>
      {open && items.length>0 && (
        <div style={{borderTop:'1px solid var(--border)'}}>
          {items.map((item,i)=>renderItem(item,i))}
        </div>
      )}
      {open && items.length===0 && (
        <p style={{fontSize:13,color:'var(--text3)',textAlign:'center',padding:'16px 0',borderTop:'1px solid var(--border)'}}>Nenhum item cadastrado.</p>
      )}
    </div>
  );
}

const CustomTooltip = ({active,payload,label}) => {
  if(!active||!payload?.length) return null;
  return(
    <div style={{background:'var(--bg2)',border:'1px solid var(--border-md)',borderRadius:10,padding:'10px 14px',boxShadow:'var(--shadow)'}}>
      <p style={{fontSize:11,color:'var(--text3)',marginBottom:6}}>{label}</p>
      {payload.map(p=>(
        <p key={p.name} style={{fontSize:12,color:p.color,marginBottom:2}}>
          {p.name}: <span style={{fontFamily:'var(--mono)',fontWeight:600}}>{fmt(p.value)}</span>
        </p>
      ))}
    </div>
  );
};

export default function NetWorthPage() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    api.get('/api/networth').then(r=>{setData(r.data);setLoading(false);}).catch(()=>setLoading(false));
  },[]);

  if (loading) return (
    <div style={{minHeight:'100vh',background:'var(--bg)'}}><Navbar/>
      <main style={{maxWidth:800,margin:'0 auto',padding:'24px 16px'}}>
        {[1,2,3].map(i=><div key={i} className="skeleton" style={{height:100,borderRadius:14,marginBottom:12}}/>)}
      </main>
    </div>
  );

  if (!data) return null;

  const networthColor = data.net_worth >= 0 ? 'var(--green)' : 'var(--red)';
  const liabPct = data.total_assets > 0 ? Math.round(data.total_liabilities / data.total_assets * 100) : 0;

  return (
    <div style={{minHeight:'100vh',background:'var(--bg)'}}>
      <Navbar/>
      <main className="page-main" style={{maxWidth:800,margin:'0 auto',padding:'24px 16px 80px'}}>

        {/* Header */}
        <div style={{marginBottom:24}}>
          <h1 style={{fontSize:20,fontWeight:600,letterSpacing:'-0.03em'}}>Patrimônio líquido</h1>
          <p style={{color:'var(--text3)',fontSize:13,marginTop:4}}>Ativos − Passivos = seu patrimônio real</p>
        </div>

        {/* Card principal */}
        <div style={{background:'var(--bg2)',border:`1px solid ${networthColor}44`,borderRadius:16,padding:'24px',marginBottom:16,backgroundImage:`radial-gradient(ellipse at 80% 0%, ${networthColor}0a 0%, transparent 60%)`}}>
          <p style={{fontSize:12,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:8}}>Patrimônio líquido atual</p>
          <p style={{fontFamily:'var(--mono)',fontSize:36,fontWeight:700,color:networthColor,letterSpacing:'-0.02em'}}>
            {fmt(data.net_worth)}
          </p>
          <div style={{display:'flex',gap:24,marginTop:16,flexWrap:'wrap'}}>
            <div>
              <p style={{fontSize:11,color:'var(--text3)',marginBottom:3}}>Total de ativos</p>
              <p style={{fontFamily:'var(--mono)',fontSize:16,fontWeight:600,color:'var(--green)'}}>{fmt(data.total_assets)}</p>
            </div>
            <div style={{width:1,background:'var(--border)',alignSelf:'stretch'}}/>
            <div>
              <p style={{fontSize:11,color:'var(--text3)',marginBottom:3}}>Total de passivos</p>
              <p style={{fontFamily:'var(--mono)',fontSize:16,fontWeight:600,color:'var(--red)'}}>{fmt(data.total_liabilities)}</p>
            </div>
            <div style={{width:1,background:'var(--border)',alignSelf:'stretch'}}/>
            <div>
              <p style={{fontSize:11,color:'var(--text3)',marginBottom:3}}>Endividamento</p>
              <p style={{fontFamily:'var(--mono)',fontSize:16,fontWeight:600,color:liabPct>30?'var(--red)':'var(--text)'}}>{liabPct}%</p>
            </div>
          </div>

          {/* Barra ativos vs passivos */}
          <div style={{marginTop:16}}>
            <div style={{height:8,borderRadius:99,background:'var(--bg3)',overflow:'hidden',display:'flex'}}>
              <div style={{height:'100%',width:`${Math.min(100,100-liabPct)}%`,background:'var(--green)',transition:'width 0.5s'}}/>
              <div style={{height:'100%',flex:1,background:'var(--red)',opacity:0.7}}/>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',marginTop:4}}>
              <span style={{fontSize:10,color:'var(--green)'}}>Ativos {100-liabPct}%</span>
              <span style={{fontSize:10,color:'var(--red)'}}>Passivos {liabPct}%</span>
            </div>
          </div>
        </div>

        {/* Gráfico de evolução */}
        {data.evolution?.length>0 && (
          <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:14,padding:'18px',marginBottom:16}}>
            <p style={{fontSize:11,color:'var(--text3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:14}}>
              Evolução do saldo acumulado
            </p>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={data.evolution}>
                <defs>
                  <linearGradient id="gwGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--green)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--green)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
                <XAxis dataKey="label" tick={{fill:'var(--text3)',fontSize:10}} axisLine={false} tickLine={false}/>
                <YAxis tickFormatter={fmtK} tick={{fill:'var(--text3)',fontSize:10}} axisLine={false} tickLine={false} width={52}/>
                <Tooltip content={<CustomTooltip/>}/>
                <Area dataKey="balance" name="Saldo acumulado" stroke="var(--green)" strokeWidth={2} fill="url(#gwGrad)"/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ATIVOS */}
        <p style={{fontSize:12,fontWeight:700,color:'var(--text)',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:10}}>🟢 Ativos — {fmt(data.total_assets)}</p>

        <Section title="Contas bancárias" total={data.assets.totals.accounts} color="var(--green)"
          items={data.assets.accounts.filter(a=>a.balance>0)}
          renderItem={(item,i)=>(
            <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 18px',borderBottom:'1px solid var(--border)'}}>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <span style={{fontSize:18}}>{item.icon}</span>
                <span style={{fontSize:13,color:'var(--text)'}}>{item.name}</span>
              </div>
              <span style={{fontFamily:'var(--mono)',fontSize:13,fontWeight:600,color:'var(--green)'}}>{fmt(item.balance)}</span>
            </div>
          )}
        />

        <Section title="Investimentos" total={data.assets.totals.investments} color="var(--indigo)"
          items={data.assets.investments}
          renderItem={(item,i)=>(
            <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 18px',borderBottom:'1px solid var(--border)'}}>
              <div>
                <p style={{fontSize:13,color:'var(--text)'}}>{item.name}</p>
                <p style={{fontSize:11,color:'var(--text3)',marginTop:2}}>{TYPE_LABEL[item.type]||item.type}</p>
              </div>
              <span style={{fontFamily:'var(--mono)',fontSize:13,fontWeight:600,color:'var(--indigo)'}}>{fmt(item.value)}</span>
            </div>
          )}
        />

        {/* PASSIVOS */}
        <p style={{fontSize:12,fontWeight:700,color:'var(--text)',textTransform:'uppercase',letterSpacing:'0.07em',margin:'20px 0 10px'}}>🔴 Passivos — {fmt(data.total_liabilities)}</p>

        <Section title="Dívidas e parcelamentos" total={data.liabilities.totals.debts} color="var(--red)"
          items={data.liabilities.debts}
          renderItem={(item,i)=>(
            <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 18px',borderBottom:'1px solid var(--border)'}}>
              <span style={{fontSize:13,color:'var(--text)'}}>{item.name}</span>
              <span style={{fontFamily:'var(--mono)',fontSize:13,fontWeight:600,color:'var(--red)'}}>-{fmt(item.remaining)}</span>
            </div>
          )}
        />

        <Section title="Faturas de cartão (mês atual)" total={data.liabilities.totals.cards} color="var(--amber)"
          items={data.liabilities.cards}
          renderItem={(item,i)=>(
            <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 18px',borderBottom:'1px solid var(--border)'}}>
              <span style={{fontSize:13,color:'var(--text)'}}>💳 {item.name}</span>
              <span style={{fontFamily:'var(--mono)',fontSize:13,fontWeight:600,color:'var(--amber)'}}>-{fmt(item.invoice)}</span>
            </div>
          )}
        />

      </main>
    </div>
  );
}
