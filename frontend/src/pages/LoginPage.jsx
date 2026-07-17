import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [isLogin,setIsLogin]=useState(true);
  const [form,setForm]=useState({email:'',password:'',name:''});
  const [showPassword,setShowPassword]=useState(false);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(false);
  const {login,register}=useAuth();
  const navigate=useNavigate();

  async function handleSubmit(e){
    e.preventDefault(); setError(''); setLoading(true);
    try{
      if(isLogin) await login(form.email,form.password);
      else        await register(form.email,form.password,form.name);
      navigate('/');
    }catch(err){ setError(err.response?.data?.error||'Ocorreu um erro. Tente novamente.'); }
    finally{ setLoading(false); }
  }

  const inp={width:'100%',padding:'12px 14px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',color:'var(--text)'};
  const lbl={display:'block',fontSize:13,color:'var(--text2)',marginBottom:6,fontWeight:500};

  return(
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'var(--bg)',padding:16,backgroundImage:'radial-gradient(ellipse at 60% 0%,rgba(124,127,247,0.08) 0%,transparent 60%)'}}>
      <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:20,width:'100%',maxWidth:400,padding:36,boxShadow:'var(--shadow)'}} className="fade-up">
        <div style={{textAlign:'center',marginBottom:32}}>
          <div style={{width:52,height:52,borderRadius:14,margin:'0 auto 14px',background:'linear-gradient(135deg,var(--indigo),#a78bfa)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>💰</div>
          <h1 style={{fontSize:22,fontWeight:600,letterSpacing:'-0.03em'}}>FinanceApp</h1>
          <p style={{color:'var(--text3)',fontSize:13,marginTop:4}}>Controle suas finanças com clareza</p>
        </div>
        <div style={{display:'flex',background:'var(--bg3)',borderRadius:10,padding:3,marginBottom:24,border:'1px solid var(--border)'}}>
          {['Entrar','Cadastrar'].map((label,i)=>{
            const active=isLogin===(i===0);
            return(
              <button key={label} onClick={()=>setIsLogin(i===0)} style={{flex:1,padding:'8px 0',borderRadius:8,fontSize:13,fontWeight:500,border:'none',cursor:'pointer',transition:'all 0.2s',background:active?'var(--bg2)':'transparent',color:active?'var(--indigo)':'var(--text3)',boxShadow:active?'0 1px 4px rgba(0,0,0,0.3)':'none',fontFamily:'var(--font)'}}>{label}</button>
            );
          })}
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            {!isLogin&&(
              <div><label style={lbl}>Nome</label>
                <input type="text" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Seu nome" style={inp}/>
              </div>
            )}
            <div><label style={lbl}>Email</label>
              <input type="email" required value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="seu@email.com" style={inp}/>
            </div>
            <div>
              <label style={lbl}>Senha</label>
              <div style={{position:'relative'}}>
                <input
                  type={showPassword?'text':'password'}
                  required value={form.password}
                  onChange={e=>setForm({...form,password:e.target.value})}
                  placeholder="••••••••"
                  style={{...inp,paddingRight:44}}
                />
                <button
                  type="button"
                  onClick={()=>setShowPassword(v=>!v)}
                  title={showPassword?'Ocultar senha':'Mostrar senha'}
                  style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',padding:4,color:'var(--text3)',fontSize:17,display:'flex',alignItems:'center',justifyContent:'center',lineHeight:1}}
                >
                  {showPassword ? (
                    /* olho fechado */
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    /* olho aberto */
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>
            {error&&<div style={{background:'var(--red-dim)',border:'1px solid rgba(240,94,110,0.2)',color:'var(--red)',fontSize:13,borderRadius:8,padding:'10px 14px'}}>{error}</div>}
            <button type="submit" disabled={loading} style={{padding:'13px 0',borderRadius:10,border:'none',cursor:'pointer',fontFamily:'var(--font)',fontSize:14,fontWeight:600,background:loading?'var(--bg3)':'linear-gradient(135deg,var(--indigo),#a78bfa)',color:loading?'var(--text3)':'#fff',marginTop:4}}>
              {loading?'Aguarde...':(isLogin?'Entrar':'Criar conta')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
