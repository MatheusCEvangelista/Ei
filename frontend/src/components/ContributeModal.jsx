// ContributeModal — modal de aporte de meta (separado para reuso)
import { useState } from 'react';
import api from '../lib/api';

const fmt  = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);
const inpS = { width:'100%',padding:'11px 14px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',color:'var(--text)',fontSize:'var(--text-base)',fontFamily:'var(--font)',outline:'none' };

export default function ContributeModal({ goal, onSave, onClose }) {
  const [amount,  setAmount]  = useState('');
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  async function handleSave(e) {
    e.preventDefault();
    const val = parseFloat(amount);
    if (!val || val <= 0) { setError('Informe um valor válido.'); return; }
    setError(''); setSaving(true);
    try {
      await api.patch(`/api/goals/${goal.id}/contribute`, { amount: val });
      onSave();
    } catch(err) {
      setError(err.response?.data?.error || 'Erro ao registrar aporte. Verifique se o endpoint está registrado no servidor.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50,padding:'var(--space-4)'}} onClick={onClose}>
      <div style={{background:'var(--bg2)',border:'1px solid var(--border-md)',borderRadius:'var(--radius-xl)',width:'100%',maxWidth:380,padding:'var(--space-5)',boxShadow:'var(--shadow)'}} className="fade-up" onClick={e=>e.stopPropagation()}>

        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'var(--space-4)'}}>
          <div>
            <h3 style={{fontSize:'var(--text-lg)',fontWeight:'var(--font-semibold)',color:'var(--text)'}}>Adicionar aporte</h3>
            <p style={{fontSize:'var(--text-xs)',color:'var(--text3)',marginTop:2}}>{goal.icon} {goal.name}</p>
          </div>
          <button onClick={onClose} style={{width:28,height:28,borderRadius:'var(--radius-sm)',border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text2)',cursor:'pointer',fontSize:16}}>×</button>
        </div>

        {/* Progresso atual */}
        <div style={{background:'var(--bg3)',borderRadius:'var(--radius-md)',padding:'var(--space-3)',marginBottom:'var(--space-4)'}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:'var(--space-1)'}}>
            <span style={{fontSize:'var(--text-xs)',color:'var(--text3)'}}>Progresso atual</span>
            <span style={{fontSize:'var(--text-xs)',fontFamily:'var(--mono)',color:'var(--text)',fontWeight:'var(--font-semibold)'}}>
              {fmt(goal.current_amount)} / {fmt(goal.target_amount)}
            </span>
          </div>
          <div style={{height:6,background:'var(--bg2)',borderRadius:'var(--radius-full)',overflow:'hidden'}}>
            <div style={{height:'100%',width:`${Math.min(100,goal.pct||0)}%`,background:'linear-gradient(90deg,var(--indigo),#a78bfa)',borderRadius:'var(--radius-full)'}}/>
          </div>
        </div>

        {goal.monthly_target && (
          <div style={{background:'var(--indigo-dim)',border:'1px solid rgba(124,127,247,0.2)',borderRadius:'var(--radius-md)',padding:'10px 14px',marginBottom:'var(--space-4)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontSize:'var(--text-xs)',color:'var(--indigo)'}}>Meta mensal sugerida</span>
            <span style={{fontFamily:'var(--mono)',fontSize:'var(--text-md)',fontWeight:'var(--font-bold)',color:'var(--indigo)'}}>{fmt(goal.monthly_target)}</span>
          </div>
        )}

        <form onSubmit={handleSave} style={{display:'flex',flexDirection:'column',gap:'var(--space-3)'}}>
          <div>
            <label style={{display:'block',fontSize:'var(--text-xs)',color:'var(--text2)',fontWeight:'var(--font-medium)',marginBottom:'var(--space-1)',textTransform:'uppercase',letterSpacing:'0.05em'}}>Valor do aporte (R$)</label>
            <input
              autoFocus
              type="number" step="0.01" inputMode="decimal"
              value={amount}
              onChange={e=>setAmount(e.target.value)}
              placeholder={goal.monthly_target ? fmt(goal.monthly_target) : fmt(goal.remaining)}
              style={inpS}
              onFocus={e=>e.target.style.borderColor='var(--indigo)'}
              onBlur={e=>e.target.style.borderColor='var(--border)'}
            />
          </div>

          {/* Atalhos de valor */}
          <div style={{display:'flex',gap:'var(--space-2)'}}>
            {[goal.monthly_target, goal.remaining].filter(Boolean).map((v,i)=>(
              <button key={i} type="button" onClick={()=>setAmount(v.toFixed(2))}
                style={{flex:1,padding:'7px',borderRadius:'var(--radius-sm)',border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text2)',fontSize:'var(--text-xs)',cursor:'pointer',fontFamily:'var(--font)',transition:'all var(--transition)'}}
                onMouseOver={e=>{e.currentTarget.style.borderColor='var(--indigo)';e.currentTarget.style.color='var(--indigo)';}}
                onMouseOut={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.color='var(--text2)';}}>
                {i===0?`Meta: ${fmt(v)}`:`Restante: ${fmt(v)}`}
              </button>
            ))}
          </div>

          {error && (
            <div style={{background:'var(--red-dim)',border:'1px solid rgba(240,94,110,0.2)',borderRadius:'var(--radius-md)',padding:'10px 14px',fontSize:'var(--text-xs)',color:'var(--red)'}}>
              ⚠️ {error}
            </div>
          )}

          <button type="submit" disabled={saving}
            style={{padding:'13px',borderRadius:'var(--radius-md)',border:'none',background:saving?'var(--bg3)':'linear-gradient(135deg,#7c3aed,#a78bfa)',color:saving?'var(--text3)':'#fff',fontSize:'var(--text-sm)',fontWeight:'var(--font-semibold)',cursor:saving?'wait':'pointer',fontFamily:'var(--font)',transition:'all var(--transition)'}}>
            {saving?'Salvando...':'Confirmar aporte ✓'}
          </button>
        </form>
      </div>
    </div>
  );
}
