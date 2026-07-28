import { useState, useEffect } from 'react';
import api from '../lib/api';

const inp = { width:'100%', padding:'11px 14px', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text)' };
const lbl = { display:'block', fontSize:12, color:'var(--text2)', fontWeight:500, marginBottom:6, letterSpacing:'0.02em' };
const fmt = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v);

export default function DebtModal({ debt, onClose, onSave }) {
  const [form, setForm] = useState({
    name:'', total_amount:'', installments:'', installment_value:'',
    due_day:'', start_date: new Date().toISOString().split('T')[0],
    category_id:'', notes:'',
  });
  const [categories, setCategories] = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [autoCalc,   setAutoCalc]   = useState(true); // calcula parcela automaticamente

  useEffect(() => {
    api.get('/api/categories').then(r => setCategories(r.data));
    if (debt) setForm({
      name:              debt.name,
      total_amount:      debt.total_amount,
      installments:      debt.installments,
      installment_value: debt.installment_value,
      due_day:           debt.due_day || '',
      start_date:        debt.start_date || new Date().toISOString().split('T')[0],
      category_id:       debt.category_id || '',
      notes:             debt.notes || '',
    });
  }, [debt]);

  // Auto-calcula valor da parcela
  useEffect(() => {
    if (autoCalc && form.total_amount && form.installments && Number(form.installments) > 0) {
      const val = (Number(form.total_amount) / Number(form.installments)).toFixed(2);
      setForm(f => ({ ...f, installment_value: val }));
    }
  }, [form.total_amount, form.installments, autoCalc]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      if (debt) await api.put(`/api/debts/${debt.id}`, form);
      else      await api.post('/api/debts', form);
      onSave();
    } catch(err) {
      setError(err.response?.data?.error || 'Erro ao salvar');
    } finally { setLoading(false); }
  }

  const totalCalc = form.installment_value && form.installments
    ? Number(form.installment_value) * Number(form.installments)
    : 0;

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.65)',backdropFilter:'blur(4px)',display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:50,overflowY:'auto'}} onClick={onClose}>
      <div style={{background:'var(--bg2)',border:'1px solid var(--border-md)',borderRadius:'18px 18px 0 0',width:'100%',maxWidth:500,padding:'8px 24px 32px',maxHeight:'92vh',overflowY:'auto',boxShadow:'var(--shadow)'}} className="fade-up" onClick={e=>e.stopPropagation()}>
        <div style={{width:36,height:4,borderRadius:2,background:'var(--bg3)',margin:'10px auto 20px'}}/>

        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:22}}>
          <h2 style={{fontSize:16,fontWeight:600}}>{debt?'Editar dívida':'Nova dívida'}</h2>
          <button onClick={onClose} style={{width:28,height:28,borderRadius:7,border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text2)',cursor:'pointer',fontSize:16}}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{display:'flex',flexDirection:'column',gap:16}}>

            {/* Nome */}
            <div>
              <label style={lbl}>NOME DA DÍVIDA</label>
              <input type="text" required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}
                placeholder="Ex: Financiamento do carro, iPhone 16..." style={inp}/>
            </div>

            {/* Total + parcelas */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div>
                <label style={lbl}>VALOR TOTAL (R$)</label>
                <input type="number" step="0.01" min="0" required value={form.total_amount}
                  onChange={e=>setForm({...form,total_amount:e.target.value})}
                  placeholder="5000,00" style={{...inp,fontFamily:'var(--mono)'}}/>
              </div>
              <div>
                <label style={lbl}>Nº DE PARCELAS</label>
                <input type="number" min="1" required value={form.installments}
                  onChange={e=>setForm({...form,installments:e.target.value})}
                  placeholder="12" style={{...inp,fontFamily:'var(--mono)'}}/>
              </div>
            </div>

            {/* Valor da parcela */}
            <div>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                <label style={{...lbl,marginBottom:0}}>VALOR DA PARCELA (R$)</label>
                <label style={{display:'flex',alignItems:'center',gap:5,cursor:'pointer'}}>
                  <input type="checkbox" checked={autoCalc} onChange={e=>setAutoCalc(e.target.checked)}
                    style={{width:13,height:13,accentColor:'var(--indigo)'}}/>
                  <span style={{fontSize:11,color:'var(--text3)'}}>Calcular auto</span>
                </label>
              </div>
              <input type="number" step="0.01" min="0" required value={form.installment_value}
                onChange={e=>{setAutoCalc(false);setForm({...form,installment_value:e.target.value});}}
                placeholder="416,67" style={{...inp,fontFamily:'var(--mono)',color:'var(--indigo)'}}
                readOnly={autoCalc}/>
              {totalCalc > 0 && !autoCalc && Math.abs(totalCalc - Number(form.total_amount)) > 0.1 && (
                <p style={{fontSize:11,color:'var(--amber)',marginTop:4}}>
                  ⚠️ {Number(form.installments)}x {fmt(form.installment_value)} = {fmt(totalCalc)} (difere do total)
                </p>
              )}
            </div>

            {/* Dia vencimento + data início */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div>
                <label style={lbl}>DIA DO VENCIMENTO</label>
                <input type="number" min="1" max="31" value={form.due_day}
                  onChange={e=>setForm({...form,due_day:e.target.value})}
                  placeholder="10" style={inp}/>
              </div>
              <div>
                <label style={lbl}>DATA DA 1ª PARCELA</label>
                <input type="date" value={form.start_date}
                  onChange={e=>setForm({...form,start_date:e.target.value})} style={inp}/>
              </div>
            </div>

            {/* Categoria */}
            <div>
              <label style={lbl}>CATEGORIA</label>
              <select value={form.category_id} onChange={e=>setForm({...form,category_id:e.target.value})} style={inp}>
                <option value="">Sem categoria</option>
                {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {/* Observações */}
            <div>
              <label style={lbl}>OBSERVAÇÕES (OPCIONAL)</label>
              <input type="text" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}
                placeholder="Ex: Banco X, contrato nº..." style={inp}/>
            </div>

            {error && <p style={{fontSize:13,color:'var(--red)',background:'var(--red-dim)',borderRadius:8,padding:'10px 12px'}}>{error}</p>}

            <div style={{display:'flex',gap:10}}>
              <button type="button" onClick={onClose} style={{flex:1,padding:'13px 0',borderRadius:10,fontSize:14,fontWeight:500,border:'1px solid var(--border)',background:'transparent',color:'var(--text2)',cursor:'pointer',fontFamily:'var(--font)'}}>Cancelar</button>
              <button type="submit" disabled={loading} style={{flex:2,padding:'13px 0',borderRadius:10,fontSize:14,fontWeight:600,border:'none',cursor:'pointer',fontFamily:'var(--font)',background:loading?'var(--bg3)':'linear-gradient(135deg,var(--indigo),#a78bfa)',color:loading?'var(--text3)':'#fff'}}>
                {loading?'Salvando...':'Salvar'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
