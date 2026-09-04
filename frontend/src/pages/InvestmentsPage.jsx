import { useState, useEffect } from 'react';
import { PageShell, PageHeader, Card, StatCard, EmptyState, SkeletonList, Button, SectionLabel, Badge, InfoBox } from '../components/ui';
import { useConfirm } from '../components/ConfirmDialog';
import EntryModal from '../components/EntryModal';
import api from '../lib/api';

const fmt    = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);
const fmtPct = v => `${v >= 0 ? '+' : ''}${v?.toFixed(2)}%`;

const TYPE_LABELS = {
  stock:'Ação', fii:'FII', bdr:'BDR', etf:'ETF',
  crypto:'Cripto', fixed_income:'Renda Fixa', treasury:'Tesouro Direto', other:'Outro',
};
const TYPE_COLORS = {
  stock:'var(--indigo)', fii:'var(--green)', bdr:'var(--blue)',
  etf:'var(--amber)', crypto:'var(--red)', fixed_income:'var(--green)',
  treasury:'var(--green)', other:'var(--text3)',
};

// ── Modal de criação/edição ───────────────────────────────────────────────
function InvestmentModal({ investment, onSave, onClose }) {
  const isFixed = inv => ['fixed_income','treasury'].includes(inv?.type);
  const [form, setForm] = useState({
    name:          investment?.name          || '',
    ticker:        investment?.ticker        || '',
    type:          investment?.type          || 'stock',
    rate:          investment?.rate          || '',
    rate_period:   investment?.rate_period   || 'yearly',
    maturity_date: investment?.maturity_date || '',
    initial_amount:investment?.initial_amount|| '',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const inpS = { width:'100%',padding:'11px 14px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',color:'var(--text)',fontSize:'var(--text-sm)',fontFamily:'var(--font)',outline:'none' };

  async function handleSave(e) {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      if (investment?.id) await api.put(`/api/investments/${investment.id}`, form);
      else                await api.post('/api/investments', form);
      onSave();
    } catch(err) { setError(err.response?.data?.error || 'Erro ao salvar'); }
    setSaving(false);
  }

  const fixed = isFixed(form);

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',backdropFilter:'blur(4px)',display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:50,padding:'var(--space-4)'}} onClick={onClose}>
      <div style={{background:'var(--bg2)',border:'1px solid var(--border-md)',borderRadius:'var(--radius-xl) var(--radius-xl) 0 0',width:'100%',maxWidth:480,padding:'8px 22px 32px',maxHeight:'90vh',overflowY:'auto'}} className="fade-up" onClick={e=>e.stopPropagation()}>
        <div style={{width:36,height:4,borderRadius:2,background:'var(--bg3)',margin:'10px auto 20px'}}/>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'var(--space-4)'}}>
          <h2 style={{fontSize:'var(--text-lg)',fontWeight:'var(--font-semibold)'}}>{investment?.id?'Editar':'Novo investimento'}</h2>
          <button onClick={onClose} style={{width:28,height:28,borderRadius:'var(--radius-sm)',border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text2)',cursor:'pointer',fontSize:16}}>×</button>
        </div>
        <form onSubmit={handleSave}>
          <div style={{display:'flex',flexDirection:'column',gap:'var(--space-3)'}}>
            <div>
              <label style={{display:'block',fontSize:'var(--text-xs)',color:'var(--text2)',fontWeight:'var(--font-medium)',marginBottom:'var(--space-1)',textTransform:'uppercase',letterSpacing:'0.05em'}}>Tipo</label>
              <select value={form.type} onChange={e=>setForm({...form,type:e.target.value})} style={inpS}>
                {Object.entries(TYPE_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'var(--space-2)'}}>
              <div>
                <label style={{display:'block',fontSize:'var(--text-xs)',color:'var(--text2)',fontWeight:'var(--font-medium)',marginBottom:'var(--space-1)',textTransform:'uppercase',letterSpacing:'0.05em'}}>Nome *</label>
                <input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Ex: Tesouro IPCA+" style={inpS}/>
              </div>
              {!fixed && (
                <div>
                  <label style={{display:'block',fontSize:'var(--text-xs)',color:'var(--text2)',fontWeight:'var(--font-medium)',marginBottom:'var(--space-1)',textTransform:'uppercase',letterSpacing:'0.05em'}}>Ticker</label>
                  <input value={form.ticker} onChange={e=>setForm({...form,ticker:e.target.value.toUpperCase()})} placeholder="Ex: PETR4" style={inpS}/>
                </div>
              )}
            </div>
            {fixed && (<>
              <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:'var(--space-2)'}}>
                <div>
                  <label style={{display:'block',fontSize:'var(--text-xs)',color:'var(--text2)',fontWeight:'var(--font-medium)',marginBottom:'var(--space-1)',textTransform:'uppercase',letterSpacing:'0.05em'}}>Taxa de rendimento (%)</label>
                  <input type="number" step="0.01" value={form.rate} onChange={e=>setForm({...form,rate:e.target.value})} placeholder="12.5" style={inpS}/>
                </div>
                <div>
                  <label style={{display:'block',fontSize:'var(--text-xs)',color:'var(--text2)',fontWeight:'var(--font-medium)',marginBottom:'var(--space-1)',textTransform:'uppercase',letterSpacing:'0.05em'}}>Período</label>
                  <select value={form.rate_period} onChange={e=>setForm({...form,rate_period:e.target.value})} style={inpS}>
                    <option value="yearly">Anual</option>
                    <option value="monthly">Mensal</option>
                  </select>
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'var(--space-2)'}}>
                <div>
                  <label style={{display:'block',fontSize:'var(--text-xs)',color:'var(--text2)',fontWeight:'var(--font-medium)',marginBottom:'var(--space-1)',textTransform:'uppercase',letterSpacing:'0.05em'}}>Valor inicial (R$)</label>
                  <input type="number" step="0.01" inputMode="decimal" value={form.initial_amount} onChange={e=>setForm({...form,initial_amount:e.target.value})} placeholder="1000" style={inpS}/>
                </div>
                <div>
                  <label style={{display:'block',fontSize:'var(--text-xs)',color:'var(--text2)',fontWeight:'var(--font-medium)',marginBottom:'var(--space-1)',textTransform:'uppercase',letterSpacing:'0.05em'}}>Vencimento</label>
                  <input type="date" value={form.maturity_date} onChange={e=>setForm({...form,maturity_date:e.target.value})} style={inpS}/>
                </div>
              </div>
            </>)}
            {error && <InfoBox variant="danger">{error}</InfoBox>}
            <Button type="submit" disabled={saving} size="lg" style={{width:'100%'}}>{saving?'Salvando...':'Salvar'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Card de investimento ──────────────────────────────────────────────────
function InvestmentCard({ inv, onEdit, onDelete, onAporte }) {
  const isFixed    = ['fixed_income','treasury'].includes(inv.type);
  const currentVal = isFixed
    ? (inv.calculated_current_value || inv.initial_amount || 0)
    : (inv.quantity || 0) * (inv.avg_price || 0);
  const invested   = isFixed ? (inv.initial_amount || 0) : currentVal;
  const gain       = currentVal - invested;
  const gainPct    = invested > 0 ? (gain / invested * 100) : 0;
  const color      = TYPE_COLORS[inv.type] || 'var(--indigo)';

  return (
    <Card style={{marginBottom:'var(--space-2)'}}>
      <div style={{padding:'var(--space-4)'}}>
        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'var(--space-3)'}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:'flex',alignItems:'center',gap:'var(--space-2)',marginBottom:'var(--space-1)'}}>
              <span style={{fontSize:'var(--text-xs)',fontWeight:'var(--font-bold)',color,background:`${color}18`,borderRadius:'var(--radius-sm)',padding:'1px 7px'}}>
                {inv.ticker || TYPE_LABELS[inv.type]}
              </span>
              <Badge>{TYPE_LABELS[inv.type] || inv.type}</Badge>
            </div>
            <p style={{fontSize:'var(--text-md)',fontWeight:'var(--font-semibold)',color:'var(--text)'}}>{inv.name}</p>
            {!isFixed && inv.quantity > 0 && (
              <p style={{fontSize:'var(--text-xs)',color:'var(--text3)',marginTop:2}}>
                {inv.quantity} cotas × {fmt(inv.avg_price)} (PM)
              </p>
            )}
            {isFixed && inv.rate && (
              <p style={{fontSize:'var(--text-xs)',color:'var(--text3)',marginTop:2}}>
                {inv.rate}% {inv.rate_period==='yearly'?'a.a.':'a.m.'}
                {inv.maturity_date && ` • Vence ${new Date(inv.maturity_date+'T00:00:00').toLocaleDateString('pt-BR')}`}
              </p>
            )}
          </div>

          <div style={{textAlign:'right',flexShrink:0}}>
            <p style={{fontFamily:'var(--mono)',fontSize:'var(--text-lg)',fontWeight:'var(--font-bold)',color:'var(--text)'}}>{fmt(currentVal)}</p>
            {!isFixed && (
              <p style={{fontFamily:'var(--mono)',fontSize:'var(--text-xs)',color:gainPct>=0?'var(--green)':'var(--red)',marginTop:2}}>
                {fmtPct(gainPct)}
              </p>
            )}
          </div>
        </div>

        {/* Ações */}
        <div style={{display:'flex',gap:'var(--space-2)',marginTop:'var(--space-3)',paddingTop:'var(--space-3)',borderTop:'1px solid var(--border)'}}>
          <Button size="sm" onClick={()=>onAporte(inv)} style={{flex:1}}>
            + Novo aporte
          </Button>
          <Button variant="ghost" size="sm" onClick={()=>onEdit(inv)}>Editar</Button>
          <Button variant="danger" size="sm" onClick={()=>onDelete(inv.id)}>Excluir</Button>
        </div>
      </div>
    </Card>
  );
}

// ── Página principal ──────────────────────────────────────────────────────
export default function InvestmentsPage() {
  const [investments, setInvestments] = useState([]);
  const [evolution,   setEvolution]   = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [showModal,   setShowModal]   = useState(false);
  const [editing,     setEditing]     = useState(null);
  const [aporteInv,   setAporteInv]   = useState(null); // investimento selecionado para aporte
  const { confirm, ConfirmDialog }    = useConfirm();

  async function load() {
    setLoading(true);
    try {
      const [invRes, evoRes] = await Promise.all([
        api.get('/api/investments'),
        api.get('/api/investments/evolution?months=12').catch(()=>({data:null})),
      ]);
      setInvestments(invRes.data || []);
      setEvolution(evoRes.data);
    } catch {} finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id) {
    const ok = await confirm({
      title:        'Excluir investimento?',
      message:      'Todos os aportes registrados também serão removidos. Esta ação não pode ser desfeita.',
      confirmLabel: 'Excluir investimento',
      icon:         '📈',
      variant:      'danger',
    });
    if (!ok) return;
    await api.delete(`/api/investments/${id}`);
    setInvestments(prev => prev.filter(i => i.id !== id));
  }

  const totalInvested  = evolution?.total_invested  || investments.reduce((s,i)=>s+Number(i.initial_amount||0),0);
  const totalEstimated = evolution?.total_estimated || totalInvested;
  const gain           = evolution?.gain || 0;
  const gainPct        = evolution?.gain_pct || 0;

  return (
    <PageShell maxWidth={720}>
      <ConfirmDialog/>
      <PageHeader
        title="Investimentos"
        subtitle={`${investments.length} ativo${investments.length!==1?'s':''}`}
        action={<Button onClick={()=>{setEditing(null);setShowModal(true);}}>+ Novo investimento</Button>}
      />

      {/* Resumo */}
      {investments.length > 0 && (
        <div className="summary-grid" style={{gap:'var(--space-3)',marginBottom:'var(--space-4)'}}>
          <StatCard label="Total investido"   value={fmt(totalInvested)}  color="var(--text)"/>
          <StatCard label="Valor atual"        value={fmt(totalEstimated)} color="var(--indigo)"/>
          <StatCard label="Ganho/Perda"        value={fmt(gain)}           color={gain>=0?'var(--green)':'var(--red)'}/>
          <StatCard label="Rentabilidade"      value={fmtPct(gainPct)}     color={gainPct>=0?'var(--green)':'var(--red)'}/>
        </div>
      )}

      {loading ? <SkeletonList n={3} h={120}/> :
       investments.length === 0 ? (
        <EmptyState icon="📈" title="Nenhum investimento cadastrado."
          subtitle="Adicione seus investimentos para acompanhar a evolução da sua carteira."
          action={<Button onClick={()=>{setEditing(null);setShowModal(true);}}>+ Primeiro investimento</Button>}/>
       ) : (
        investments.map(inv => (
          <InvestmentCard
            key={inv.id}
            inv={inv}
            onEdit={i=>{setEditing(i);setShowModal(true);}}
            onDelete={handleDelete}
            onAporte={i=>setAporteInv(i)}
          />
        ))
       )}

      {showModal && (
        <InvestmentModal
          investment={editing}
          onSave={()=>{setShowModal(false);load();}}
          onClose={()=>setShowModal(false)}
        />
      )}

      {aporteInv && (
        <EntryModal
          investment={aporteInv}
          onSave={()=>{setAporteInv(null);load();}}
          onClose={()=>setAporteInv(null)}
        />
      )}
    </PageShell>
  );
}
