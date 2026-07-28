import { useState, useEffect } from 'react';
import api from '../lib/api';
import Navbar from '../components/Navbar';
import DebtModal from '../components/DebtModal';

const fmt = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const fmtDate = d => {
  if (!d) return '';
  const dateStr = d.includes('T') ? d : `${d}T00:00:00`;
  return new Date(dateStr).toLocaleDateString('pt-BR');
};

function DebtCard({ debt, onEdit, onDelete, onPay, onUnpay }) {
  const [paying, setPaying] = useState(false);
  const [createTx, setCreateTx] = useState(true);

  const pct = debt.pct || 0;
  const color = debt.done ? 'var(--green)' : pct >= 75 ? 'var(--indigo)' : pct >= 40 ? 'var(--amber)' : 'var(--red)';

  const urgency = !debt.done && debt.days_until_due !== null
    ? debt.days_until_due < 0   ? { label: 'Vencida',            color: 'var(--red)',   bg: 'var(--red-dim)' }
    : debt.days_until_due <= 5  ? { label: `Vence em ${debt.days_until_due}d`, color: 'var(--red)', bg: 'var(--red-dim)' }
    : debt.days_until_due <= 15 ? { label: `${debt.days_until_due}d restantes`, color: 'var(--amber)', bg: 'rgba(245,166,35,0.12)' }
    : null : null;

  async function handlePay() {
    setPaying(true);
    try {
      await onPay(debt.id, createTx);
    } catch (e) {
      console.error(e);
    } finally {
      setPaying(false);
    }
  }

  return (
    <div style={{ background: 'var(--bg2)', border: `1px solid ${debt.done ? 'rgba(45,212,160,0.25)' : 'var(--border)'}`, borderRadius: 14, padding: '18px 20px' }} className="fade-up">

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 11,
            background: `color-mix(in srgb, ${color} 15%, transparent)`,
            border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            flexShrink: 0
          }}>
            {debt.done ? '✅' : '💳'}
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{debt.name}</p>
            <div style={{ display: 'flex', gap: 6, marginTop: 2, flexWrap: 'wrap', alignItems: 'center' }}>
              {debt.categories && (
                <span style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: debt.categories.color, display: 'inline-block' }} />
                  {debt.categories.name}
                </span>
              )}
              {urgency && (
                <span style={{ fontSize: 11, fontWeight: 600, color: urgency.color, background: urgency.bg, borderRadius: 5, padding: '2px 7px' }}>{urgency.label}</span>
              )}
              {debt.done && <span style={{ fontSize: 11, color: 'var(--green)', background: 'var(--green-dim)', borderRadius: 5, padding: '2px 7px', fontWeight: 600 }}>✓ Quitada</span>}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => onEdit(debt)} style={{ fontSize: 12, color: 'var(--indigo)', background: 'var(--indigo-dim)', border: 'none', borderRadius: 7, padding: '5px 10px', cursor: 'pointer', fontFamily: 'var(--font)' }}>Editar</button>
          <button onClick={() => onDelete(debt.id)} style={{ fontSize: 12, color: 'var(--red)', background: 'var(--red-dim)', border: 'none', borderRadius: 7, padding: '5px 10px', cursor: 'pointer', fontFamily: 'var(--font)' }}>Excluir</button>
        </div>
      </div>

      {/* Progresso */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>{debt.paid_installments} de {debt.installments} parcelas pagas</span>
          <span style={{ fontSize: 12, fontFamily: 'var(--mono)', fontWeight: 600, color }}>{pct}%</span>
        </div>
        <div style={{ height: 7, background: 'var(--bg3)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99, transition: 'width 0.4s' }} />
        </div>
      </div>

      {/* Valores */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: debt.done ? 0 : 14 }}>
        {[
          { label: 'Parcela',  value: fmt(debt.installment_value), color: 'var(--text)' },
          { label: 'Restante', value: fmt(debt.remaining),         color: debt.done ? 'var(--green)' : 'var(--red)' },
          { label: 'Total',    value: fmt(debt.total_amount),      color: 'var(--text2)' },
        ].map(c => (
          <div key={c.label} style={{ background: 'var(--bg3)', borderRadius: 9, padding: '10px 12px' }}>
            <p style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{c.label}</p>
            <p style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600, color: c.color }}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Próximo vencimento + botão pagar */}
      {!debt.done && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div>
            {debt.next_due && (
              <p style={{ fontSize: 12, color: 'var(--text3)' }}>
                Próximo vencimento: <span style={{ color: 'var(--text)', fontWeight: 500 }}>{fmtDate(debt.next_due)}</span>
              </p>
            )}
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, cursor: 'pointer' }}>
              <input type="checkbox" checked={createTx} onChange={e => setCreateTx(e.target.checked)}
                style={{ width: 14, height: 14, accentColor: 'var(--indigo)', cursor: 'pointer' }} />
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>Lançar como despesa no dashboard</span>
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {debt.paid_installments > 0 && (
              <button onClick={() => onUnpay(debt.id)} style={{ fontSize: 12, color: 'var(--text3)', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontFamily: 'var(--font)' }}>
                ↩ Desfazer
              </button>
            )}
            <button onClick={handlePay} disabled={paying} style={{ fontSize: 13, fontWeight: 600, color: '#fff', background: paying ? 'var(--bg3)' : 'linear-gradient(135deg,var(--green),#14b8a6)', border: 'none', borderRadius: 9, padding: '9px 18px', cursor: 'pointer', fontFamily: 'var(--font)', opacity: paying ? 0.6 : 1 }}>
              {paying ? 'Pagando...' : '✓ Pagar parcela'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DebtsPage() {
  const [debts, setDebts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [tab, setTab] = useState('active'); // 'active' | 'done'

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get('/api/debts');
      setDebts(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handlePay(id, createTx) {
    try {
      await api.post(`/api/debts/${id}/pay`, { create_transaction: createTx });
      await load();
    } catch (e) {
      console.error(e);
    }
  }

  async function handleUnpay(id) {
    try {
      await api.post(`/api/debts/${id}/unpay`);
      await load();
    } catch (e) {
      console.error(e);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Excluir esta dívida?')) return;
    try {
      await api.delete(`/api/debts/${id}`);
      await load();
    } catch (e) {
      console.error(e);
    }
  }

  const active = debts.filter(d => !d.done);
  const done = debts.filter(d => d.done);
  const shown = tab === 'active' ? active : done;

  // Totais
  const totalRemaining = active.reduce((s, d) => s + Number(d.remaining || 0), 0);
  const totalMonthly = active.reduce((s, d) => s + Number(d.installment_value || 0), 0);
  const totalDebt = active.reduce((s, d) => s + Number(d.total_amount || 0), 0);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />
      <main className="page-main" style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px 80px' }}>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.03em' }}>Dívidas e parcelamentos</h1>
            <p style={{ color: 'var(--text3)', fontSize: 13, marginTop: 4 }}>Controle seus parcelamentos e dívidas</p>
          </div>
          <button onClick={() => setModal(true)} style={{ padding: '9px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,var(--indigo),#a78bfa)', color: '#fff', fontFamily: 'var(--font)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            ＋ Nova dívida
          </button>
        </div>

        {/* Cards resumo */}
        {active.length > 0 && (
          <div className="summary-grid" style={{ display: 'grid', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Total em aberto', value: fmt(totalRemaining), color: 'var(--red)' },
              { label: 'Compromisso/mês', value: fmt(totalMonthly), color: 'var(--amber)' },
              { label: 'Dívida original', value: fmt(totalDebt), color: 'var(--text2)' },
            ].map(c => (
              <div key={c.label} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px' }}>
                <p style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>{c.label}</p>
                <p style={{ fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 600, color: c.color }}>{c.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', background: 'var(--bg3)', borderRadius: 10, padding: 3, marginBottom: 20, border: '1px solid var(--border)' }}>
          {[
            ['active', `Em aberto (${active.length})`],
            ['done', `Quitadas (${done.length})`]
          ].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{ flex: 1, padding: '9px 0', borderRadius: 8, fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all 0.2s', background: tab === id ? 'var(--bg2)' : 'transparent', color: tab === id ? 'var(--indigo)' : 'var(--text3)', boxShadow: tab === id ? '0 1px 4px rgba(0,0,0,0.2)' : 'none' }}>
              {label}
            </button>
          ))}
        </div>

        {/* Lista */}
        {loading ? (
          [1, 2].map(i => <div key={i} className="skeleton" style={{ height: 200, borderRadius: 14, marginBottom: 12 }} />)
        ) : shown.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text3)', background: 'var(--bg2)', borderRadius: 14, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>{tab === 'active' ? '💳' : '🎉'}</div>
            <p style={{ fontSize: 14 }}>{tab === 'active' ? 'Nenhuma dívida em aberto.' : 'Nenhuma dívida quitada ainda.'}</p>
            {tab === 'active' && <button onClick={() => setModal(true)} style={{ marginTop: 12, background: 'none', border: 'none', color: 'var(--indigo)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font)' }}>Adicionar →</button>}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {shown.map(d => (
              <DebtCard key={d.id} debt={d}
                onEdit={d => { setEditing(d); setModal(true); }}
                onDelete={handleDelete}
                onPay={handlePay}
                onUnpay={handleUnpay}
              />
            ))}
          </div>
        )}
      </main>

      {modal && (
        <DebtModal
          debt={editing}
          onClose={() => { setModal(false); setEditing(null); }}
          onSave={() => { setModal(false); setEditing(null); load(); }}
        />
      )}
    </div>
  );
}