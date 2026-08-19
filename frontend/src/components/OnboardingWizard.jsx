import { useState } from 'react';
import api from '../lib/api';

const STEPS = [
  { id:'welcome',  title:'Bem-vindo ao Ei! 🦎',       sub:'Vamos configurar sua conta em 3 passos rápidos' },
  { id:'account',  title:'Crie sua primeira conta',    sub:'Uma conta corrente, poupança ou carteira' },
  { id:'income',   title:'Qual é sua renda mensal?',   sub:'Isso ajuda o Leon a dar conselhos mais precisos' },
  { id:'budget',   title:'Defina um teto de gastos',   sub:'Opcional — você pode criar mais depois' },
];

const ACCOUNT_TYPES = [
  { value:'checking',   label:'Conta Corrente', icon:'🏦' },
  { value:'savings',    label:'Poupança',        icon:'💰' },
  { value:'cash',       label:'Carteira',        icon:'👛' },
  { value:'investment', label:'Investimentos',   icon:'📈' },
];

const inp = {
  width:'100%', padding:'12px 14px',
  background:'var(--bg3)', border:'1px solid var(--border)',
  borderRadius:9, color:'var(--text)', fontSize:14,
};

export default function OnboardingWizard({ onComplete }) {
  const [step,    setStep]    = useState(0);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const [account, setAccount] = useState({ name:'', type:'checking', balance:'' });
  const [income,  setIncome]  = useState({ amount:'', description:'Salário' });
  const [budget,  setBudget]  = useState({ category_id:'', amount:'' });
  const [categories, setCategories] = useState([]);

  async function goNext() {
    setError(''); setLoading(true);
    try {
      if (step === 1) {
        // Cria conta
        if (!account.name) { setError('Informe o nome da conta.'); setLoading(false); return; }
        await api.post('/api/accounts', {
          name:    account.name,
          type:    account.type,
          balance: parseFloat(account.balance) || 0,
          color:   '#7c3aed',
          icon:    ACCOUNT_TYPES.find(t=>t.value===account.type)?.icon || '🏦',
        });
      }

      if (step === 2) {
        // Lança receita inicial se informada
        if (income.amount && parseFloat(income.amount) > 0) {
          const today = new Date().toISOString().split('T')[0];
          await api.post('/api/transactions', {
            type:        'income',
            amount:      parseFloat(income.amount),
            description: income.description || 'Salário',
            date:        today,
          });
        }
        // Carrega categorias para o step de teto
        const { data } = await api.get('/api/categories');
        setCategories(data);
      }

      if (step === 3) {
        // Cria teto se preenchido
        if (budget.category_id && parseFloat(budget.amount) > 0) {
          await api.post('/api/budgets', {
            category_id: budget.category_id,
            amount:      parseFloat(budget.amount),
          });
        }
        // Marca onboarding concluído
        localStorage.setItem('ei_onboarding_done', '1');
        onComplete();
        return;
      }

      setStep(s => s + 1);
    } catch(err) {
      setError(err.response?.data?.error || 'Ocorreu um erro. Tente novamente.');
    }
    setLoading(false);
  }

  function skip() {
    if (step === 3) {
      localStorage.setItem('ei_onboarding_done', '1');
      onComplete();
    } else {
      setStep(s => s + 1);
    }
  }

  const progress = Math.round((step / (STEPS.length - 1)) * 100);

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:100,
      background:'rgba(0,0,0,0.7)', backdropFilter:'blur(6px)',
      display:'flex', alignItems:'center', justifyContent:'center', padding:16,
    }}>
      <div style={{
        background:'var(--bg2)', border:'1px solid var(--border-md)',
        borderRadius:20, width:'100%', maxWidth:440,
        padding:'32px 28px', boxShadow:'0 20px 60px rgba(0,0,0,0.4)',
      }} className="fade-up">

        {/* Progress bar */}
        <div style={{marginBottom:28}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
            {STEPS.map((s,i)=>(
              <div key={s.id} style={{display:'flex',alignItems:'center',gap:4}}>
                <div style={{
                  width:28, height:28, borderRadius:'50%',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:12, fontWeight:700,
                  background: i<=step ? 'var(--indigo)' : 'var(--bg3)',
                  color:      i<=step ? '#fff' : 'var(--text3)',
                  border:     `2px solid ${i<=step?'var(--indigo)':'var(--border)'}`,
                  transition: 'all 0.3s',
                }}>
                  {i < step ? '✓' : i+1}
                </div>
                {i < STEPS.length-1 && (
                  <div style={{width:50,height:2,background:i<step?'var(--indigo)':'var(--border)',transition:'background 0.3s',borderRadius:99}}/>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Header */}
        <div style={{marginBottom:24}}>
          <h2 style={{fontSize:20,fontWeight:700,letterSpacing:'-0.03em',color:'var(--text)'}}>{STEPS[step].title}</h2>
          <p style={{fontSize:13,color:'var(--text3)',marginTop:6}}>{STEPS[step].sub}</p>
        </div>

        {/* ── Step 0: Welcome ── */}
        {step === 0 && (
          <div style={{textAlign:'center',padding:'8px 0'}}>
            <div style={{
              width:90, height:90, borderRadius:'50%', margin:'0 auto 20px',
              backgroundImage:'url(/leon.png)', backgroundSize:'200% 200%',
              backgroundPosition:'0% 0%', border:'3px solid var(--indigo)',
            }}/>
            <p style={{fontSize:14,color:'var(--text2)',lineHeight:1.7,marginBottom:16}}>
              Eu sou o <strong style={{color:'var(--indigo)'}}>Leon</strong>, seu camaleão financeiro 🦎<br/>
              Vou te ajudar a montar sua conta em menos de 2 minutos.
            </p>
            <div style={{display:'flex',flexDirection:'column',gap:8,textAlign:'left',background:'var(--bg3)',borderRadius:12,padding:'14px 16px'}}>
              {['Criar sua primeira conta bancária','Registrar sua renda mensal','Definir um limite de gastos'].map((item,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:10,fontSize:13,color:'var(--text2)'}}>
                  <span style={{width:20,height:20,borderRadius:'50%',background:'var(--indigo-dim)',color:'var(--indigo)',fontSize:11,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{i+1}</span>
                  {item}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 1: Conta ── */}
        {step === 1 && (
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div>
              <label style={{display:'block',fontSize:12,color:'var(--text3)',fontWeight:500,marginBottom:6,textTransform:'uppercase',letterSpacing:'0.05em'}}>Tipo de conta</label>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                {ACCOUNT_TYPES.map(t=>(
                  <button key={t.value} onClick={()=>setAccount({...account,type:t.value})}
                    style={{padding:'10px 12px',borderRadius:10,cursor:'pointer',fontFamily:'var(--font)',display:'flex',alignItems:'center',gap:8,border:`1.5px solid ${account.type===t.value?'var(--indigo)':'var(--border)'}`,background:account.type===t.value?'var(--indigo-dim)':'var(--bg3)',color:account.type===t.value?'var(--indigo)':'var(--text)',fontSize:13,fontWeight:500,transition:'all 0.15s'}}>
                    <span style={{fontSize:18}}>{t.icon}</span>{t.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{display:'block',fontSize:12,color:'var(--text3)',fontWeight:500,marginBottom:6,textTransform:'uppercase',letterSpacing:'0.05em'}}>Nome da conta</label>
              <input type="text" value={account.name} onChange={e=>setAccount({...account,name:e.target.value})}
                placeholder="Ex: Nubank, Inter, Carteira..." style={inp}/>
            </div>
            <div>
              <label style={{display:'block',fontSize:12,color:'var(--text3)',fontWeight:500,marginBottom:6,textTransform:'uppercase',letterSpacing:'0.05em'}}>Saldo inicial (R$) — opcional</label>
              <input type="number" value={account.balance} onChange={e=>setAccount({...account,balance:e.target.value})}
                placeholder="0,00" style={inp}/>
            </div>
          </div>
        )}

        {/* ── Step 2: Renda ── */}
        {step === 2 && (
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div>
              <label style={{display:'block',fontSize:12,color:'var(--text3)',fontWeight:500,marginBottom:6,textTransform:'uppercase',letterSpacing:'0.05em'}}>Descrição</label>
              <input type="text" value={income.description} onChange={e=>setIncome({...income,description:e.target.value})}
                placeholder="Salário, Freelance, etc." style={inp}/>
            </div>
            <div>
              <label style={{display:'block',fontSize:12,color:'var(--text3)',fontWeight:500,marginBottom:6,textTransform:'uppercase',letterSpacing:'0.05em'}}>Valor mensal (R$)</label>
              <input type="number" value={income.amount} onChange={e=>setIncome({...income,amount:e.target.value})}
                placeholder="Ex: 3500" style={inp}/>
            </div>
            <p style={{fontSize:12,color:'var(--text3)',background:'var(--bg3)',borderRadius:9,padding:'10px 14px',lineHeight:1.5}}>
              💡 Isso registra sua renda de hoje e ajuda o Leon a calcular sua taxa de poupança e dar conselhos mais precisos.
            </p>
          </div>
        )}

        {/* ── Step 3: Teto ── */}
        {step === 3 && (
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <p style={{fontSize:13,color:'var(--text2)',lineHeight:1.6}}>
              Tetos de gasto te avisam quando uma categoria está chegando no limite. Comece por uma e adicione mais depois.
            </p>
            <div>
              <label style={{display:'block',fontSize:12,color:'var(--text3)',fontWeight:500,marginBottom:6,textTransform:'uppercase',letterSpacing:'0.05em'}}>Categoria</label>
              <select value={budget.category_id} onChange={e=>setBudget({...budget,category_id:e.target.value})} style={inp}>
                <option value="">Selecione uma categoria</option>
                {categories.map(c=><option key={c.id} value={c.id}>{c.icon||''} {c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{display:'block',fontSize:12,color:'var(--text3)',fontWeight:500,marginBottom:6,textTransform:'uppercase',letterSpacing:'0.05em'}}>Limite mensal (R$)</label>
              <input type="number" value={budget.amount} onChange={e=>setBudget({...budget,amount:e.target.value})}
                placeholder="Ex: 800" style={inp}/>
            </div>
          </div>
        )}

        {error && (
          <p style={{fontSize:12,color:'var(--red)',background:'var(--red-dim)',borderRadius:8,padding:'10px 12px',marginTop:14}}>
            {error}
          </p>
        )}

        {/* Ações */}
        <div style={{display:'flex',gap:10,marginTop:24}}>
          {step > 0 && step < 3 && (
            <button onClick={skip} style={{flex:1,padding:'13px 0',borderRadius:10,border:'1px solid var(--border)',background:'transparent',color:'var(--text3)',fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:'var(--font)'}}>
              Pular
            </button>
          )}
          <button onClick={goNext} disabled={loading}
            style={{flex:2,padding:'13px 0',borderRadius:10,border:'none',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'var(--font)',background:loading?'var(--bg3)':'linear-gradient(135deg,#7c3aed,#a78bfa)',color:loading?'var(--text3)':'#fff',transition:'all 0.2s'}}>
            {loading ? 'Aguarde...' : step === 0 ? 'Vamos começar! 🚀' : step === 3 ? 'Concluir ✓' : 'Próximo →'}
          </button>
        </div>

        {step === 3 && (
          <button onClick={skip} style={{width:'100%',marginTop:8,padding:'10px',background:'none',border:'none',color:'var(--text3)',fontSize:12,cursor:'pointer',fontFamily:'var(--font)'}}>
            Pular e ir para o dashboard
          </button>
        )}
      </div>
    </div>
  );
}
