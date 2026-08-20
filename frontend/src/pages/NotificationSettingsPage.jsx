import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import api from '../lib/api';

export default function NotificationSettingsPage() {
  const [sending,  setSending]  = useState(false);
  const [result,   setResult]   = useState(null); // { ok, msg }
  const [prefs,    setPrefs]    = useState({ budget_alert:true, goal_complete:true, monthly_report:true });
  const [loadPrefs,setLoadPrefs]= useState(true);

  useEffect(()=>{
    api.get('/api/notifications/preferences').then(r=>{
      if(r.data) setPrefs(p=>({...p,...r.data}));
    }).catch(()=>{}).finally(()=>setLoadPrefs(false));
  },[]);

  async function sendTestEmail() {
    setSending(true); setResult(null);
    try {
      const { data } = await api.post('/api/reports/send-monthly');
      setResult({ ok:true, msg:`✅ E-mail enviado para ${data.email}! Verifique sua caixa de entrada.` });
    } catch(err) {
      setResult({ ok:false, msg:`❌ ${err.response?.data?.error || 'Erro ao enviar e-mail.'}` });
    }
    setSending(false);
  }

  async function savePref(key, value) {
    setPrefs(p=>({...p,[key]:value}));
    try { await api.put('/api/notifications/preferences', { [key]:value }); } catch {}
  }

  const toggleS = { display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 16px',background:'var(--bg3)',borderRadius:10,border:'1px solid var(--border)',cursor:'pointer' };

  return (
    <div style={{minHeight:'100vh',background:'var(--bg)'}}>
      <Navbar/>
      <main className="page-main" style={{maxWidth:600,margin:'0 auto',padding:'24px 16px 80px'}}>

        <div style={{marginBottom:28}}>
          <h1 style={{fontSize:20,fontWeight:600,letterSpacing:'-0.03em'}}>Notificações</h1>
          <p style={{color:'var(--text3)',fontSize:13,marginTop:4}}>Gerencie alertas e relatórios automáticos</p>
        </div>

        {/* Alertas */}
        <p style={{fontSize:11,color:'var(--text3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:10}}>Alertas in-app</p>
        <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:24}}>
          {[
            { key:'budget_alert',   label:'Teto de gasto atingido',   desc:'Avisa quando uma categoria ultrapassa o limite' },
            { key:'goal_complete',  label:'Meta concluída',            desc:'Celebra quando você atinge uma meta de economia' },
          ].map(p=>(
            <label key={p.key} style={toggleS}>
              <div>
                <p style={{fontSize:13,fontWeight:500,color:'var(--text)',marginBottom:2}}>{p.label}</p>
                <p style={{fontSize:11,color:'var(--text3)'}}>{p.desc}</p>
              </div>
              <div style={{position:'relative',width:44,height:24,flexShrink:0}} onClick={()=>savePref(p.key,!prefs[p.key])}>
                <div style={{width:44,height:24,borderRadius:12,background:prefs[p.key]?'var(--indigo)':'var(--bg)',border:'1px solid var(--border)',transition:'background 0.2s'}}/>
                <div style={{position:'absolute',top:3,left:prefs[p.key]?22:3,width:18,height:18,borderRadius:'50%',background:'#fff',transition:'left 0.2s',boxShadow:'0 1px 3px rgba(0,0,0,0.3)'}}/>
              </div>
            </label>
          ))}
        </div>

        {/* Relatório mensal por e-mail */}
        <p style={{fontSize:11,color:'var(--text3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:10}}>Relatório mensal por e-mail</p>
        <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:14,padding:'20px',marginBottom:12}}>
          <div style={{display:'flex',alignItems:'flex-start',gap:14,marginBottom:16}}>
            <div style={{width:42,height:42,borderRadius:12,background:'var(--indigo-dim)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0}}>📧</div>
            <div>
              <p style={{fontSize:14,fontWeight:600,color:'var(--text)',marginBottom:4}}>Resumo mensal automático</p>
              <p style={{fontSize:12,color:'var(--text3)',lineHeight:1.5}}>
                Receba um e-mail no início de cada mês com um resumo completo: receitas, despesas, maiores gastos, status dos tetos e progresso das metas.
              </p>
            </div>
          </div>

          <div style={{background:'var(--bg3)',borderRadius:10,padding:'12px 14px',marginBottom:16,fontSize:12,color:'var(--text2)',lineHeight:1.6}}>
            <strong>🔧 Como configurar o envio automático (gratuito):</strong><br/>
            1. Crie uma conta no <a href="https://uptimerobot.com" target="_blank" style={{color:'var(--indigo)'}}>UptimeRobot</a><br/>
            2. Crie um monitor do tipo <strong>HTTP(s)</strong><br/>
            3. URL: <code style={{background:'var(--bg2)',padding:'1px 5px',borderRadius:4}}>{`${window.location.origin.replace('3000','3001')}/api/reports/send-monthly`}</code><br/>
            4. Método: <strong>POST</strong> | Intervalo: <strong>1 dia</strong><br/>
            5. O relatório será enviado todo dia 1 do mês quando o cron bater
          </div>

          <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
            <button onClick={sendTestEmail} disabled={sending}
              style={{flex:1,padding:'12px',borderRadius:10,border:'none',background:sending?'var(--bg3)':'linear-gradient(135deg,var(--indigo),#a78bfa)',color:sending?'var(--text3)':'#fff',fontSize:13,fontWeight:600,cursor:sending?'wait':'pointer',fontFamily:'var(--font)',transition:'all 0.2s'}}>
              {sending?'Enviando...':'📧 Enviar relatório agora (teste)'}
            </button>
            <a href="/api/reports/preview" target="_blank"
              style={{padding:'12px 16px',borderRadius:10,border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text2)',fontSize:13,fontWeight:500,textDecoration:'none',display:'flex',alignItems:'center',whiteSpace:'nowrap'}}>
              👁️ Preview
            </a>
          </div>

          {result && (
            <div style={{marginTop:12,padding:'12px 14px',borderRadius:9,background:result.ok?'var(--green-dim)':'var(--red-dim)',border:`1px solid ${result.ok?'rgba(34,197,94,0.2)':'rgba(239,68,68,0.2)'}`,fontSize:13,color:result.ok?'var(--green)':'var(--red)'}}>
              {result.msg}
            </div>
          )}
        </div>

        {/* Vars de ambiente necessárias */}
        <div style={{background:'rgba(245,158,11,0.08)',border:'1px solid rgba(245,158,11,0.25)',borderRadius:10,padding:'14px 16px',fontSize:12,color:'var(--text2)',lineHeight:1.6}}>
          <strong style={{color:'var(--amber)'}}>⚙️ Variáveis necessárias no Render:</strong><br/>
          <code style={{display:'block',marginTop:6,fontFamily:'monospace',fontSize:11,color:'var(--text)'}}>
            RESEND_API_KEY=re_xxxxxxxxxxxx<br/>
            RESEND_FROM=Leon &lt;noreply@seudominio.com&gt;
          </code>
          <p style={{marginTop:8,fontSize:11,color:'var(--text3)'}}>
            Sem domínio próprio? Use <code>onboarding@resend.dev</code> para testes (só envia para e-mails verificados no Resend).
          </p>
        </div>
      </main>
    </div>
  );
}
