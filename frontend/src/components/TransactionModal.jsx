import { useState, useEffect } from 'react';
import api from '../lib/api';

const inpS = {
  width:'100%', padding:'11px 14px',
  background:'var(--bg3)', border:'1px solid var(--border)',
  borderRadius:'var(--radius-sm)', color:'var(--text)',
  fontSize:'var(--text-base)', fontFamily:'var(--font)',
  outline:'none', transition:'border-color var(--transition)',
};
const lblS = {
  display:'block', fontSize:'var(--text-xs)',
  color:'var(--text2)', fontWeight:'var(--font-medium)',
  marginBottom:'var(--space-1)',
  textTransform:'uppercase', letterSpacing:'0.05em',
};

export default function TransactionModal({ transaction, defaultType='expense', onSave, onClose }) {
  const [categories, setCategories] = useState([]);
  const [accounts,   setAccounts]   = useState([]);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState('');

  const [form, setForm] = useState({
    type:        transaction?.type        || defaultType,
    amount:      transaction?.amount      || '',
    description: transaction?.description || '',
    category_id: transaction?.category_id || '',
    account_id:  transaction?.account_id  || '',
    date:        transaction?.date        || new Date().toISOString().split('T')[0],
    status:      transaction?.status      || 'confirmed',
  });

  useEffect(() => {
    Promise.all([
      api.get('/api/categories').catch(()=>({data:[]})),
      api.get('/api/accounts').catch(()=>({data:[]})),
    ]).then(([c, a]) => {
      setCategories(c.data || []);
      setAccounts(a.data || []);
    });
  }, []);

  const filteredCats = categories.filter(c =>
    !c.type || c.type === form.type || c.type === 'both'
  );

  async function handleSave(e) {
    e.preventDefault();
    if (!form.amount || parseFloat(form.amount) <= 0) {
      setError('Informe um valor válido.'); return;
    }
    setError(''); setSaving(true);
    try {
      const payload = {
        ...form,
        amount: parseFloat(form.amount),
        category_id: form.category_id || null,
        account_id:  form.account_id  || null,
      };
      if (transaction?.id) await api.put(`/api/transactions/${transaction.id}`, payload);
      else                  await api.post('/api/transactions', payload);
      onSave();
    } catch(err) {
      setError(err.response?.data?.error || 'Erro ao salvar transação.');
    }
    setSaving(false);
  }

  function focusIn(e)  { e.target.style.borderColor = 'var(--indigo)'; }
  function focusOut(e) { e.target.style.borderColor = 'var(--border)'; }

  const isExpense = form.type === 'expense';
  const typeColor = isExpense ? 'var(--red)' : 'var(--green)';

  return (
    <>
      <style>{`
        @keyframes tx-modal-in {
          from{opacity:0;transform:translateY(20px);}
          to{opacity:1;transform:translateY(0);}
        }
      `}</style>

      {/* Overlay */}
      <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',backdropFilter:'blur(4px)',display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:50,padding:'var(--space-4)'}} onClick={onClose}>

        {/* Modal — bottom sheet no mobile */}
        <div style={{
          background:'var(--bg2)',
          border:'1px solid var(--border-md)',
          borderRadius:'var(--radius-xl) var(--radius-xl) 0 0',
          width:'100%', maxWidth:480,
          padding:'8px 22px 32px',
          maxHeight:'95vh', overflowY:'auto',
          boxShadow:'0 -4px 32px rgba(0,0,0,0.2)',
          animation:'tx-modal-in 0.25s ease forwards',
        }} onClick={e=>e.stopPropagation()}>

          {/* Handle */}
          <div style={{width:36,height:4,borderRadius:2,background:'var(--bg3)',margin:'10px auto 20px'}}/>

          {/* Header */}
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'var(--space-5)'}}>
            <h2 style={{fontSize:'var(--text-lg)',fontWeight:'var(--font-semibold)',color:'var(--text)'}}>
              {transaction?.id ? 'Editar transação' : 'Nova transação'}
            </h2>
            <button onClick={onClose} style={{width:28,height:28,borderRadius:'var(--radius-sm)',border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text2)',cursor:'pointer',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
          </div>

          <form onSubmit={handleSave}>
            <div style={{display:'flex',flexDirection:'column',gap:'var(--space-4)'}}>

              {/* Tipo */}
              <div style={{display:'flex',background:'var(--bg3)',borderRadius:'var(--radius-md)',padding:3,border:'1px solid var(--border)'}}>
                {[
                  {v:'expense', label:'↓ Despesa',  color:'var(--red)'},
                  {v:'income',  label:'↑ Receita',  color:'var(--green)'},
                ].map(t=>(
                  <button key={t.v} type="button" onClick={()=>setForm({...form,type:t.v,category_id:''})}
                    style={{
                      flex:1, padding:'10px',
                      borderRadius:'var(--radius-sm)',
                      border:'none', cursor:'pointer',
                      fontFamily:'var(--font)',
                      fontSize:'var(--text-sm)', fontWeight:'var(--font-semibold)',
                      background: form.type===t.v ? 'var(--bg2)' : 'transparent',
                      color:      form.type===t.v ? t.color : 'var(--text3)',
                      transition:'all var(--transition)',
                    }}>
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Valor — inputMode decimal para teclado numérico no iOS */}
              <div>
                <label style={lblS}>Valor (R$) *</label>
                <input
                  autoFocus
                  type="number" step="0.01" inputMode="decimal"
                  required value={form.amount}
                  onChange={e=>setForm({...form,amount:e.target.value})}
                  placeholder="0,00"
                  style={{...inpS, fontSize:24, fontFamily:'var(--mono)', fontWeight:'var(--font-bold)', color:typeColor, textAlign:'center'}}
                  onFocus={focusIn} onBlur={focusOut}
                />
              </div>

              {/* Descrição */}
              <div>
                <label style={lblS}>Descrição</label>
                <input type="text" value={form.description}
                  onChange={e=>setForm({...form,description:e.target.value})}
                  placeholder={isExpense ? 'Ex: Supermercado, Uber...' : 'Ex: Salário, Freelance...'}
                  style={inpS} onFocus={focusIn} onBlur={focusOut}/>
              </div>

              {/* Data */}
              <div>
                <label style={lblS}>Data</label>
                <input type="date" required value={form.date}
                  onChange={e=>setForm({...form,date:e.target.value})}
                  style={inpS} onFocus={focusIn} onBlur={focusOut}/>
              </div>

              {/* Categoria + Conta em grid */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'var(--space-2)'}}>
                <div>
                  <label style={lblS}>Categoria</label>
                  <select value={form.category_id}
                    onChange={e=>setForm({...form,category_id:e.target.value})}
                    style={{...inpS,cursor:'pointer'}} onFocus={focusIn} onBlur={focusOut}>
                    <option value="">Sem categoria</option>
                    {filteredCats.map(c=>(
                      <option key={c.id} value={c.id}>{c.icon||''} {c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={lblS}>Conta</label>
                  <select value={form.account_id}
                    onChange={e=>setForm({...form,account_id:e.target.value})}
                    style={{...inpS,cursor:'pointer'}} onFocus={focusIn} onBlur={focusOut}>
                    <option value="">Sem conta</option>
                    {accounts.map(a=>(
                      <option key={a.id} value={a.id}>{a.icon||'🏦'} {a.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Status */}
              <div>
                <label style={lblS}>Status</label>
                <div style={{display:'flex',background:'var(--bg3)',borderRadius:'var(--radius-sm)',padding:3,border:'1px solid var(--border)'}}>
                  {[
                    {v:'confirmed',label:'✓ Confirmado'},
                    {v:'pending',  label:'○ Pendente'},
                  ].map(s=>(
                    <button key={s.v} type="button" onClick={()=>setForm({...form,status:s.v})}
                      style={{flex:1,padding:'7px',borderRadius:'var(--radius-sm)',border:'none',cursor:'pointer',fontFamily:'var(--font)',fontSize:'var(--text-xs)',fontWeight:'var(--font-medium)',background:form.status===s.v?'var(--bg2)':'transparent',color:form.status===s.v?'var(--text)':'var(--text3)',transition:'all var(--transition)'}}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div style={{background:'var(--red-dim)',border:'1px solid rgba(240,94,110,0.2)',borderRadius:'var(--radius-md)',padding:'10px 14px',fontSize:'var(--text-xs)',color:'var(--red)'}}>
                  ⚠️ {error}
                </div>
              )}

              <button type="submit" disabled={saving} style={{
                padding:'14px',
                borderRadius:'var(--radius-md)',
                border:'none',
                background: saving ? 'var(--bg3)' : `linear-gradient(135deg,${isExpense?'#ef4444,#f87171':'#22c55e,#4ade80'})`,
                color: saving ? 'var(--text3)' : '#fff',
                fontSize:'var(--text-md)', fontWeight:'var(--font-bold)',
                cursor: saving ? 'wait' : 'pointer',
                fontFamily:'var(--font)',
                transition:'all var(--transition)',
              }}>
                {saving ? 'Salvando...' : transaction?.id ? 'Salvar alterações' : `${isExpense?'↓ Registrar despesa':'↑ Registrar receita'}`}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
