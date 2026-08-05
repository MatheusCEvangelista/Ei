import { useState, useEffect } from 'react';
import api from '../lib/api';

export default function CategoryRulesModal({ onClose }) {
  const [rules,      setRules]      = useState([]);
  const [categories, setCategories] = useState([]);
  const [form,       setForm]       = useState({ pattern:'', category_id:'' });
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState('');
  const [loading,    setLoading]    = useState(true);
  const [testDesc,   setTestDesc]   = useState('');
  const [testMatch,  setTestMatch]  = useState(null);

  async function load() {
    const [r, c] = await Promise.all([
      api.get('/api/import/rules'),
      api.get('/api/categories'),
    ]);
    setRules(r.data); setCategories(c.data); setLoading(false);
  }
  useEffect(()=>{ load(); },[]);

  async function addRule(e) {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      await api.post('/api/import/rules', form);
      setForm({ pattern:'', category_id:'' });
      await load();
    } catch(err) { setError(err.response?.data?.error||'Erro ao salvar'); }
    setSaving(false);
  }

  async function deleteRule(id) {
    await api.delete(`/api/import/rules/${id}`);
    setRules(prev => prev.filter(r=>r.id!==id));
  }

  // Testa padrão em tempo real
  function testPattern(pattern, desc) {
    if (!pattern || !desc) { setTestMatch(null); return; }
    try {
      const re = new RegExp(pattern, 'i');
      setTestMatch(re.test(desc));
    } catch { setTestMatch(null); }
  }

  const inp = { width:'100%', padding:'10px 12px', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text)' };

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.65)',backdropFilter:'blur(4px)',display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:50}} onClick={onClose}>
      <div style={{background:'var(--bg2)',border:'1px solid var(--border-md)',borderRadius:'18px 18px 0 0',width:'100%',maxWidth:560,padding:'8px 22px 32px',maxHeight:'85vh',overflowY:'auto',boxShadow:'var(--shadow)'}} className="fade-up" onClick={e=>e.stopPropagation()}>
        <div style={{width:36,height:4,borderRadius:2,background:'var(--bg3)',margin:'10px auto 18px'}}/>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
          <div>
            <h2 style={{fontSize:16,fontWeight:600}}>Regras de categorização</h2>
            <p style={{fontSize:12,color:'var(--text3)',marginTop:2}}>Palavras que identificam automaticamente a categoria</p>
          </div>
          <button onClick={onClose} style={{width:28,height:28,borderRadius:7,border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text2)',cursor:'pointer',fontSize:16}}>×</button>
        </div>

        {/* Regras built-in (explicação) */}
        <div style={{background:'var(--indigo-dim)',border:'1px solid rgba(124,127,247,0.2)',borderRadius:10,padding:'12px 14px',marginBottom:18,fontSize:12,color:'var(--text2)'}}>
          💡 O sistema já possui <strong>40+ regras automáticas</strong> para estabelecimentos brasileiros (Savegnago, Uber, Netflix, etc). Aqui você adiciona as suas próprias para casos específicos.
        </div>

        {/* Formulário nova regra */}
        <form onSubmit={addRule}>
          <div style={{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:12,padding:'14px',marginBottom:18}}>
            <p style={{fontSize:12,fontWeight:600,color:'var(--text)',marginBottom:12}}>➕ Nova regra</p>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              <div>
                <label style={{display:'block',fontSize:11,color:'var(--text3)',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.05em'}}>
                  Padrão (texto ou regex)
                </label>
                <input type="text" required value={form.pattern}
                  onChange={e=>{ setForm({...form,pattern:e.target.value}); testPattern(e.target.value,testDesc); }}
                  placeholder="Ex: posto|gasolina|combustivel" style={inp}/>
                <p style={{fontSize:11,color:'var(--text3)',marginTop:4}}>
                  Use <code>|</code> para múltiplas palavras. Ex: <code>ifood|rappi|delivery</code>
                </p>
              </div>

              <div>
                <label style={{display:'block',fontSize:11,color:'var(--text3)',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.05em'}}>
                  Categoria
                </label>
                <select required value={form.category_id} onChange={e=>setForm({...form,category_id:e.target.value})} style={inp}>
                  <option value="">Selecione uma categoria</option>
                  {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {/* Teste ao vivo */}
              <div>
                <label style={{display:'block',fontSize:11,color:'var(--text3)',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.05em'}}>
                  Testar padrão (opcional)
                </label>
                <div style={{display:'flex',gap:8,alignItems:'center'}}>
                  <input type="text" value={testDesc}
                    onChange={e=>{ setTestDesc(e.target.value); testPattern(form.pattern,e.target.value); }}
                    placeholder="Ex: POSTO GALO BRANCO FRANCA" style={{...inp,flex:1}}/>
                  {testMatch!==null&&(
                    <span style={{fontSize:13,fontWeight:700,color:testMatch?'var(--green)':'var(--red)',flexShrink:0}}>
                      {testMatch?'✓ bate':'✗ não bate'}
                    </span>
                  )}
                </div>
              </div>

              {error&&<p style={{fontSize:12,color:'var(--red)',background:'var(--red-dim)',borderRadius:7,padding:'8px 10px'}}>{error}</p>}
              <button type="submit" disabled={saving} style={{padding:'10px',borderRadius:9,border:'none',background:saving?'var(--bg)':'linear-gradient(135deg,var(--indigo),#a78bfa)',color:saving?'var(--text3)':'#fff',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'var(--font)'}}>
                {saving?'Salvando...':'Salvar regra'}
              </button>
            </div>
          </div>
        </form>

        {/* Lista de regras */}
        <p style={{fontSize:12,fontWeight:600,color:'var(--text)',marginBottom:10}}>Suas regras ({rules.length})</p>
        {loading ? (
          [1,2,3].map(i=><div key={i} className="skeleton" style={{height:44,borderRadius:9,marginBottom:8}}/>)
        ) : rules.length===0 ? (
          <p style={{fontSize:13,color:'var(--text3)',textAlign:'center',padding:'20px 0'}}>Nenhuma regra personalizada ainda.</p>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {rules.map(r=>(
              <div key={r.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 12px',background:'var(--bg3)',borderRadius:9,border:'1px solid var(--border)'}}>
                <div style={{minWidth:0,flex:1}}>
                  <code style={{fontSize:12,color:'var(--indigo)',background:'var(--indigo-dim)',padding:'2px 6px',borderRadius:4}}>{r.pattern}</code>
                  <span style={{fontSize:12,color:'var(--text3)',marginLeft:8}}>→</span>
                  <span style={{fontSize:12,color:'var(--text)',marginLeft:8,fontWeight:500}}>{r.categories?.name||'Categoria removida'}</span>
                </div>
                <button onClick={()=>deleteRule(r.id)} style={{fontSize:12,color:'var(--red)',background:'var(--red-dim)',border:'none',borderRadius:6,padding:'4px 10px',cursor:'pointer',fontFamily:'var(--font)',flexShrink:0,marginLeft:8}}>Excluir</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
