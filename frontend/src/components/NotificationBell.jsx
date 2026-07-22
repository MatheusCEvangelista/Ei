import { useState, useEffect, useRef } from 'react';
import api from '../lib/api';

const TYPE_ICON = { budget_exceeded:'🔴', recurring_due:'🔄', goal_completed:'🎯' };

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [open,  setOpen]  = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef();
  const unread = notifications.filter(n=>!n.read).length;

  async function load() {
    setLoading(true);
    try { const { data } = await api.get('/api/notifications'); setNotifications(data); } catch(_){}
    setLoading(false);
  }

  useEffect(()=>{
    load();
    api.post('/api/notifications/check-recurring').catch(()=>{});
  },[]);

  useEffect(()=>{
    function handle(e){ if(ref.current&&!ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown',handle);
    return ()=>document.removeEventListener('mousedown',handle);
  },[]);

  async function markRead(id){ await api.put(`/api/notifications/${id}/read`); setNotifications(p=>p.map(n=>n.id===id?{...n,read:true}:n)); }
  async function markAllRead(){ await api.put('/api/notifications/read-all'); setNotifications(p=>p.map(n=>({...n,read:true}))); }
  async function remove(id){ await api.delete(`/api/notifications/${id}`); setNotifications(p=>p.filter(n=>n.id!==id)); }

  const fmtDate = d => {
    const diff=Math.floor((new Date()-new Date(d))/60000);
    if(diff<1) return 'agora';
    if(diff<60) return `${diff}min atrás`;
    if(diff<1440) return `${Math.floor(diff/60)}h atrás`;
    return `${Math.floor(diff/1440)}d atrás`;
  };

  return (
    <div ref={ref} style={{position:'relative'}}>
      <button onClick={()=>{setOpen(v=>!v);if(!open)load();}}
        style={{width:34,height:34,borderRadius:8,border:'1px solid var(--border)',background:'var(--bg3)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',position:'relative',flexShrink:0}}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unread>0&&<span style={{position:'absolute',top:-4,right:-4,width:16,height:16,borderRadius:'50%',background:'var(--red)',color:'#fff',fontSize:10,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',border:'2px solid var(--bg2)'}}>{unread>9?'9+':unread}</span>}
      </button>

      {open&&(
        <div style={{position:'absolute',right:0,top:42,width:340,maxHeight:480,background:'var(--bg2)',border:'1px solid var(--border-md)',borderRadius:14,boxShadow:'var(--shadow)',zIndex:50,display:'flex',flexDirection:'column',overflow:'hidden'}} className="fade-up">
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 16px',borderBottom:'1px solid var(--border)'}}>
            <span style={{fontSize:14,fontWeight:600,color:'var(--text)'}}>Notificações {unread>0&&<span style={{fontSize:11,color:'var(--text3)',fontWeight:400}}>({unread} novas)</span>}</span>
            <div style={{display:'flex',gap:10,alignItems:'center'}}>
              {unread>0&&<button onClick={markAllRead} style={{fontSize:11,color:'var(--indigo)',background:'none',border:'none',cursor:'pointer',fontFamily:'var(--font)'}}>Ler todas</button>}
              <a href="/notification-settings" style={{fontSize:13,color:'var(--text3)',textDecoration:'none'}} onClick={()=>setOpen(false)}>⚙️</a>
            </div>
          </div>
          <div style={{overflowY:'auto',flex:1}}>
            {loading?(
              <div style={{padding:16,display:'flex',flexDirection:'column',gap:8}}>{[1,2,3].map(i=><div key={i} className="skeleton" style={{height:52}}/>)}</div>
            ):notifications.length===0?(
              <div style={{textAlign:'center',padding:'36px 16px',color:'var(--text3)'}}>
                <div style={{fontSize:32,marginBottom:8}}>🔔</div>
                <p style={{fontSize:13}}>Tudo em dia!</p>
              </div>
            ):notifications.map(n=>(
              <div key={n.id} style={{display:'flex',alignItems:'flex-start',gap:10,padding:'12px 16px',borderBottom:'1px solid var(--border)',background:n.read?'transparent':'var(--indigo-dim)',cursor:'pointer'}}
                onClick={()=>!n.read&&markRead(n.id)}>
                <span style={{fontSize:18,flexShrink:0,marginTop:1}}>{TYPE_ICON[n.type]||'🔔'}</span>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{fontSize:13,fontWeight:n.read?400:600,color:'var(--text)',lineHeight:1.3}}>{n.title}</p>
                  <p style={{fontSize:12,color:'var(--text3)',marginTop:2,lineHeight:1.4}}>{n.body}</p>
                  <p style={{fontSize:11,color:'var(--text3)',marginTop:4}}>{fmtDate(n.created_at)}</p>
                </div>
                <button onClick={e=>{e.stopPropagation();remove(n.id);}} style={{background:'none',border:'none',color:'var(--text3)',cursor:'pointer',fontSize:16,flexShrink:0}}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
