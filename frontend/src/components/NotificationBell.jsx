import { useState, useEffect, useRef } from 'react';
import api from '../lib/api';

const fmtDate = d => {
  const diff = Math.floor((Date.now() - new Date(d)) / 60000);
  if (diff < 1)  return 'agora';
  if (diff < 60) return `${diff}min atrás`;
  const h = Math.floor(diff/60);
  if (h < 24)    return `${h}h atrás`;
  return new Date(d).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'});
};

const TYPE_ICON = {
  budget_exceeded:  '🔴',
  recurring_created:'🔄',
  goal_completed:   '🏆',
  custom_alert:     '🔔',
  default:          '📢',
};

export default function NotificationBell() {
  const [open,    setOpen]    = useState(false);
  const [notifs,  setNotifs]  = useState([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef();

  const unread = notifs.filter(n => !n.read).length;

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get('/api/notifications?limit=20');
      setNotifs(data || []);
    } catch {}
    setLoading(false);
  }

  useEffect(() => {
    load();
    // Atualiza badge quando RecurringCheckRunner cria notificações
    function handleUpdate() { load(); }
    window.addEventListener('ei:notifications-updated', handleUpdate);
    return () => window.removeEventListener('ei:notifications-updated', handleUpdate);
  }, []);

  // Fecha ao clicar fora
  useEffect(() => {
    if (!open) return;
    function handle(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    }
    const t = setTimeout(() => document.addEventListener('pointerdown', handle), 0);
    return () => { clearTimeout(t); document.removeEventListener('pointerdown', handle); };
  }, [open]);

  async function markAllRead() {
    try {
      await api.patch('/api/notifications/read-all');
      setNotifs(prev => prev.map(n => ({ ...n, read: true })));
    } catch {}
  }

  async function markRead(id) {
    try {
      await api.patch(`/api/notifications/${id}/read`);
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch {}
  }

  async function deleteNotif(id, e) {
    e.stopPropagation();
    try {
      await api.delete(`/api/notifications/${id}`);
      setNotifs(prev => prev.filter(n => n.id !== id));
    } catch {}
  }

  return (
    <div ref={panelRef} style={{ position: 'relative' }}>
      <style>{`
        @keyframes bell-ring {
          0%,100%{transform:rotate(0)}
          10%{transform:rotate(-15deg)}
          20%{transform:rotate(15deg)}
          30%{transform:rotate(-10deg)}
          40%{transform:rotate(10deg)}
          50%{transform:rotate(0)}
        }
        @keyframes badge-pop {
          from{transform:scale(0)}
          to{transform:scale(1)}
        }
        @keyframes notif-in {
          from{opacity:0;transform:translateY(-8px)}
          to{opacity:1;transform:translateY(0)}
        }
        .bell-icon { animation: ${unread > 0 ? 'bell-ring 3s ease-in-out infinite' : 'none'}; display:inline-block; }
        .notif-row:hover { background: var(--bg3) !important; }
      `}</style>

      {/* Botão sino */}
      <button
        onClick={() => { setOpen(v => !v); if (!open) load(); }}
        style={{
          width: 32, height: 32,
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border)',
          background: open ? 'var(--indigo-dim)' : 'var(--bg3)',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', fontSize: 15,
          transition: 'all var(--transition)',
        }}
        title="Notificações"
      >
        <span className="bell-icon">🔔</span>
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            width: 16, height: 16, borderRadius: '50%',
            background: 'var(--red)', color: '#fff',
            fontSize: 9, fontWeight: 'var(--font-bold)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'badge-pop 0.3s ease',
            border: '2px solid var(--bg2)',
            lineHeight: 1,
          }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Painel de notificações */}
      {open && (
        <div style={{
          position: 'absolute', top: 40, right: 0, zIndex: 50,
          width: 320, maxHeight: '70vh',
          background: 'var(--bg2)', border: '1px solid var(--border-md)',
          borderRadius: 'var(--radius-lg)', boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          display: 'flex', flexDirection: 'column',
          animation: 'notif-in 0.2s ease',
        }}>
          {/* Header */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 14px', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <p style={{ fontSize:'var(--text-sm)', fontWeight:'var(--font-semibold)', color:'var(--text)' }}>Notificações</p>
              {unread > 0 && (
                <span style={{ fontSize:10, fontWeight:'var(--font-bold)', color:'var(--red)', background:'var(--red-dim)', borderRadius:'var(--radius-full)', padding:'1px 6px' }}>
                  {unread} nova{unread !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            {unread > 0 && (
              <button onClick={markAllRead}
                style={{ fontSize:11, color:'var(--indigo)', background:'none', border:'none', cursor:'pointer', fontFamily:'var(--font)', padding:0 }}>
                Marcar todas como lidas
              </button>
            )}
          </div>

          {/* Lista */}
          <div style={{ overflowY:'auto', flex:1 }}>
            {loading ? (
              <div style={{ padding:'var(--space-5)', textAlign:'center', color:'var(--text3)', fontSize:'var(--text-sm)' }}>Carregando...</div>
            ) : notifs.length === 0 ? (
              <div style={{ padding:'var(--space-8)', textAlign:'center', color:'var(--text3)' }}>
                <div style={{ fontSize:32, marginBottom:8 }}>🔔</div>
                <p style={{ fontSize:'var(--text-sm)' }}>Nenhuma notificação ainda</p>
              </div>
            ) : notifs.map(n => (
              <div key={n.id} className="notif-row"
                onClick={() => markRead(n.id)}
                style={{
                  display:'flex', gap:10, padding:'12px 14px',
                  borderBottom:'1px solid var(--border)',
                  background: n.read ? 'transparent' : 'var(--indigo-dim)',
                  cursor:'pointer', transition:'background var(--transition)',
                  position:'relative',
                }}>
                {/* Dot não lida */}
                {!n.read && (
                  <span style={{ position:'absolute', left:6, top:'50%', transform:'translateY(-50%)', width:5, height:5, borderRadius:'50%', background:'var(--indigo)', flexShrink:0 }}/>
                )}
                <span style={{ fontSize:18, flexShrink:0, lineHeight:1.3 }}>{TYPE_ICON[n.type] || TYPE_ICON.default}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontSize:'var(--text-xs)', fontWeight:'var(--font-semibold)', color:'var(--text)', marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{n.title}</p>
                  <p style={{ fontSize:'var(--text-xs)', color:'var(--text3)', lineHeight:1.4, marginBottom:3 }}>{n.body}</p>
                  <p style={{ fontSize:10, color:'var(--text3)' }}>{fmtDate(n.created_at)}</p>
                </div>
                <button onClick={e => deleteNotif(n.id, e)}
                  style={{ width:20, height:20, borderRadius:'var(--radius-sm)', border:'none', background:'transparent', color:'var(--text3)', cursor:'pointer', fontSize:12, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}
                  onMouseOver={e => { e.currentTarget.style.background='var(--red-dim)'; e.currentTarget.style.color='var(--red)'; }}
                  onMouseOut={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--text3)'; }}>
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
