import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import Navbar from '../components/Navbar';

function Toggle({ checked, onChange, label, description }) {
  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 0',borderBottom:'1px solid var(--border)'}}>
      <div>
        <p style={{fontSize:14,fontWeight:500,color:'var(--text)'}}>{label}</p>
        {description&&<p style={{fontSize:12,color:'var(--text3)',marginTop:3}}>{description}</p>}
      </div>
      <button type="button" onClick={()=>onChange(!checked)} style={{width:44,height:24,borderRadius:99,border:'none',cursor:'pointer',background:checked?'var(--indigo)':'var(--bg3)',transition:'background 0.2s',position:'relative',flexShrink:0}}>
        <span style={{position:'absolute',top:3,width:18,height:18,borderRadius:'50%',background:'#fff',transition:'left 0.2s',left:checked?23:3,boxShadow:'0 1px 3px rgba(0,0,0,0.3)'}}/>
      </button>
    </div>
  );
}

export default function NotificationSettingsPage() {
  const navigate = useNavigate();
  const [prefs,   setPrefs]   = useState({ budget_exceeded:true, recurring_due:true, goal_completed:true, push_enabled:false });
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [pushStatus, setPushStatus] = useState('idle'); // 'idle'|'requesting'|'granted'|'denied'

  useEffect(()=>{
    api.get('/api/notifications/preferences')
      .then(r=>{ setPrefs(r.data); setLoading(false); })
      .catch(()=>setLoading(false));

    // Verifica permissão push atual
    if('Notification' in window) {
      if(Notification.permission==='granted') setPushStatus('granted');
      else if(Notification.permission==='denied') setPushStatus('denied');
    }
  },[]);

  async function save(newPrefs) {
    setSaving(true);
    try {
      await api.put('/api/notifications/preferences', newPrefs);
      setPrefs(newPrefs);
    } catch(_){}
    setSaving(false);
  }

  async function enablePush() {
    if(!('Notification' in window)||!('serviceWorker' in navigator)) {
      alert('Seu navegador não suporta notificações push.'); return;
    }
    setPushStatus('requesting');
    try {
      const permission = await Notification.requestPermission();
      if(permission!=='granted'){ setPushStatus('denied'); return; }

      const reg   = await navigator.serviceWorker.ready;
      const { data: vapidData } = await api.get('/api/notifications/vapid-public-key');
      if(!vapidData.key){ alert('Chave VAPID não configurada no servidor.'); return; }

      // Converte chave VAPID
      const raw    = atob(vapidData.key.replace(/-/g,'+').replace(/_/g,'/'));
      const bytes  = new Uint8Array(raw.length);
      for(let i=0;i<raw.length;i++) bytes[i]=raw.charCodeAt(i);

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: bytes,
      });

      await api.post('/api/notifications/subscribe', { subscription });
      setPushStatus('granted');
      await save({...prefs, push_enabled:true});
    } catch(err){
      console.error(err);
      setPushStatus('idle');
    }
  }

  async function disablePush() {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if(sub) await sub.unsubscribe();
      await api.delete('/api/notifications/subscribe');
    } catch(_){}
    await save({...prefs, push_enabled:false});
    setPushStatus('idle');
  }

  function update(key, val) {
    const next = {...prefs, [key]:val};
    save(next);
  }

  if(loading) return(
    <div style={{minHeight:'100vh',background:'var(--bg)'}}>
      <Navbar/>
      <main style={{maxWidth:600,margin:'0 auto',padding:'24px 16px'}}>
        {[1,2,3,4].map(i=><div key={i} className="skeleton" style={{height:60,borderRadius:12,marginBottom:10}}/>)}
      </main>
    </div>
  );

  return(
    <div style={{minHeight:'100vh',background:'var(--bg)'}}>
      <Navbar/>
      <main className="page-main" style={{maxWidth:600,margin:'0 auto',padding:'24px 16px 80px'}}>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:28}}>
          <button onClick={()=>navigate(-1)} style={{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:8,width:32,height:32,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text2)',fontSize:16}}>←</button>
          <div>
            <h1 style={{fontSize:20,fontWeight:600,letterSpacing:'-0.03em'}}>Notificações</h1>
            <p style={{color:'var(--text3)',fontSize:13,marginTop:2}}>Escolha o que você quer ser avisado</p>
          </div>
        </div>

        {/* Push */}
        <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:14,padding:'18px 20px',marginBottom:16}}>
          <p style={{fontSize:12,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.06em',fontWeight:600,marginBottom:16}}>Push no celular</p>

          {pushStatus==='denied' ? (
            <div style={{background:'var(--red-dim)',border:'1px solid rgba(240,94,110,0.2)',borderRadius:10,padding:'14px 16px'}}>
              <p style={{fontSize:13,color:'var(--red)',fontWeight:500,marginBottom:4}}>🚫 Notificações bloqueadas</p>
              <p style={{fontSize:12,color:'var(--text3)'}}>Você negou a permissão. Para reativar, vá nas configurações do navegador e permita notificações para este site.</p>
            </div>
          ) : prefs.push_enabled && pushStatus==='granted' ? (
            <div>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}>
                <span style={{width:8,height:8,borderRadius:'50%',background:'var(--green)',display:'inline-block'}}/>
                <p style={{fontSize:13,color:'var(--green)',fontWeight:500}}>Push ativo neste dispositivo</p>
              </div>
              <button onClick={disablePush} style={{fontSize:13,color:'var(--red)',background:'var(--red-dim)',border:'none',borderRadius:8,padding:'8px 16px',cursor:'pointer',fontFamily:'var(--font)'}}>
                Desativar push
              </button>
            </div>
          ) : (
            <div>
              <p style={{fontSize:13,color:'var(--text2)',marginBottom:14,lineHeight:1.5}}>Receba alertas mesmo com o app fechado. Funciona melhor quando instalado como PWA.</p>
              <button onClick={enablePush} disabled={pushStatus==='requesting'}
                style={{fontSize:13,fontWeight:600,color:'#fff',background:pushStatus==='requesting'?'var(--bg3)':'linear-gradient(135deg,var(--indigo),#a78bfa)',border:'none',borderRadius:9,padding:'10px 20px',cursor:'pointer',fontFamily:'var(--font)'}}>
                {pushStatus==='requesting'?'Aguardando permissão...':'🔔 Ativar notificações push'}
              </button>
            </div>
          )}
        </div>

        {/* Eventos */}
        <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:14,padding:'18px 20px'}}>
          <p style={{fontSize:12,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.06em',fontWeight:600,marginBottom:4}}>O que me avisar</p>
          <Toggle
            checked={prefs.budget_exceeded}
            onChange={v=>update('budget_exceeded',v)}
            label="🔴 Teto de gasto atingido"
            description="Quando uma categoria ultrapassar o limite definido"
          />
          <Toggle
            checked={prefs.recurring_due}
            onChange={v=>update('recurring_due',v)}
            label="🔄 Recorrentes pendentes"
            description="Quando houver transações recorrentes não geradas no mês"
          />
          <Toggle
            checked={prefs.goal_completed}
            onChange={v=>update('goal_completed',v)}
            label="🎯 Meta de economia concluída"
            description="Quando você atingir 100% de uma meta"
          />
        </div>

        {saving&&<p style={{fontSize:12,color:'var(--text3)',textAlign:'center',marginTop:12}}>Salvando...</p>}
      </main>
    </div>
  );
}
