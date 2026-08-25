import { useState, useEffect } from 'react';
import api from '../lib/api';

const fmt  = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);
const inpS = { width:'100%',padding:'11px 14px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:8,color:'var(--text)' };
const lblS = { display:'block',fontSize:12,color:'var(--text2)',fontWeight:500,marginBottom:6 };

export default function EntryModal({ investment, onSave, onClose }) {
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({
    quantity:   '',
    price:      '',
    date:       new Date().toISOString().split('T')[0],
    account_id: '',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const isFixed = ['fixed_income','treasury'].includes(investment?.type);
  const totalCost = (parseFloat(form.quantity)||0) * (parseFloat(form.price)||0);

  useEffect(()=>{
    api.get('/api/accounts').then(r=>setAccounts(r.data||[])).catch(()=>{});
  },[]);

  async function handleSave(e) {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      await api.post(`/api/investments/${investment.id}/entries`, {
        quantity:   isFixed ? 1 : parseFloat(form.quantity),
        price:      isFixed ? parseFloat(form.quantity) : parseFloat(form.price),
        date:       form.date,
        account_id: form.account_id || null,
      });
      onSave();
    } catch(err) { setError(err.response?.data?.error||'Erro ao salvar'); }
    setSaving(false);
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50,padding:16}} onClick={onClose}>
      <div style={{background:'var(--bg2)',border:'1px solid var(--border-md)',borderRadius:16,width:'100%',maxWidth:400,padding:24,boxShadow:'var(--shadow)'}} className="fade-up" onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
          <div>
            <h2 style={{fontSize:16,fontWeight:600}}>Novo aporte</h2>
            <p style={{fontSize:12,color:'var(--text3)',marginTop:2}}>{investment?.name}</p>
          </div>
          <button onClick={onClose} style={{width:28,height:28,borderRadius:7,border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text2)',cursor:'pointer',fontSize:16}}>×</button>
        </div>

        <form onSubmit={handleSave}>
          <div style={{display:'flex',flexDirection:'column',gap:14}}>

            {isFixed ? (
              <div>
                <label style={lblS}>Valor aportado (R$)</label>
                <input required type="number" step="0.01" value={form.quantity}
                  onChange={e=>setForm({...form,quantity:e.target.value})}
                  placeholder="1000,00" style={inpS}/>
              </div>
            ) : (
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <div>
                  <label style={lblS}>Quantidade</label>
                  <input required type="number" step="0.001" value={form.quantity}
                    onChange={e=>setForm({...form,quantity:e.target.value})}
                    placeholder="10" style={inpS}/>
                </div>
                <div>
                  <label style={lblS}>Preço unitário (R$)</label>
                  <input required type="number" step="0.01" value={form.price}
                    onChange={e=>setForm({...form,price:e.target.value})}
                    placeholder="25,50" style={inpS}/>
                </div>
              </div>
            )}

            <div>
              <label style={lblS}>Data do aporte</label>
              <input type="date" required value={form.date}
                onChange={e=>setForm({...form,date:e.target.value})} style={inpS}/>
            </div>

            {/* Vinculação de conta */}
            <div>
              <label style={lblS}>Debitar da conta (opcional)</label>
              <select value={form.account_id} onChange={e=>setForm({...form,account_id:e.target.value})} style={inpS}>
                <option value="">Não vincular conta</option>
                {accounts.map(a=>(
                  <option key={a.id} value={a.id}>{a.icon||'🏦'} {a.name}</option>
                ))}
              </select>
              {form.account_id && (
                <p style={{fontSize:11,color:'var(--indigo)',marginTop:5}}>
                  💡 Uma transação de saída será criada automaticamente na conta selecionada.
                </p>
              )}
            </div>

            {/* Preview do custo total */}
            {totalCost > 0 && (
              <div style={{background:'var(--indigo-dim)',border:'1px solid rgba(124,127,247,0.2)',borderRadius:9,padding:'12px 14px'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontSize:12,color:'var(--indigo)'}}>Custo total do aporte</span>
                  <span style={{fontFamily:'var(--mono)',fontSize:16,fontWeight:700,color:'var(--indigo)'}}>{fmt(isFixed?parseFloat(form.quantity)||0:totalCost)}</span>
                </div>
                {form.account_id && (
                  <p style={{fontSize:11,color:'var(--text3)',marginTop:4}}>
                    Este valor será debitado da conta selecionada
                  </p>
                )}
              </div>
            )}

            {error&&<p style={{fontSize:12,color:'var(--red)',background:'var(--red-dim)',borderRadius:7,padding:'8px 10px'}}>{error}</p>}

            <button type="submit" disabled={saving}
              style={{padding:'13px',borderRadius:10,border:'none',background:saving?'var(--bg3)':'linear-gradient(135deg,#7c3aed,#a78bfa)',color:saving?'var(--text3)':'#fff',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'var(--font)'}}>
              {saving?'Salvando...':'Confirmar aporte'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
