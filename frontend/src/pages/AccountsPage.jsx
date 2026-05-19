import { useState, useEffect } from 'react';
import api from '../lib/api';
import Navbar from '../components/Navbar';
import AccountModal from '../components/AccountModal';

const fmt = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export default function AccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [balances, setBalances] = useState({});
  const [txCounts, setTxCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedAccount, setSelectedAccount] = useState(null); // para ver extrato

  async function load() {
    setLoading(true);
    const { data: accs } = await api.get('/api/accounts');
    setAccounts(accs);

    // Busca saldo de cada conta individualmente usando account_id
    const bals = {};
    const counts = {};
    await Promise.all(accs.map(async acc => {
      const { data: txs } = await api.get(`/api/transactions?account_id=${acc.id}`);
      const income  = txs.filter(t => t.type === 'income').reduce((s, t)  => s + Number(t.amount), 0);
      const expense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
      bals[acc.id]   = income - expense;
      counts[acc.id] = txs.length;
    }));
    setBalances(bals);
    setTxCounts(counts);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id) {
    if (!confirm('Excluir esta conta? As transações vinculadas ficarão sem conta.')) return;
    await api.delete(`/api/accounts/${id}`);
    if (selectedAccount?.id === id) setSelectedAccount(null);
    load();
  }

  const totalBalance = Object.values(balances).reduce((s, v) => s + v, 0);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />
      <main style={{ maxWidth: 700, margin: '0 auto', padding: '24px 14px 80px' }}>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.03em' }}>Minhas contas</h1>
            <p style={{ color: 'var(--text3)', fontSize: 13, marginTop: 4 }}>Saldo individual por conta</p>
          </div>
          <button onClick={() => setShowModal(true)} style={{ padding: '9px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, var(--indigo), #a78bfa)', color: '#fff', fontFamily: 'var(--font)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            ＋ Nova conta
          </button>
        </div>

        {/* Card total consolidado */}
        <div style={{ background: 'linear-gradient(135deg, var(--indigo), #a78bfa)', borderRadius: 16, padding: '20px 24px', marginBottom: 16 }}>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Saldo total consolidado</p>
          <p style={{ fontSize: 30, fontWeight: 600, color: '#fff', fontFamily: 'var(--mono)', letterSpacing: '-0.03em' }}>
            {loading ? '—' : fmt(totalBalance)}
          </p>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 6 }}>{accounts.length} conta{accounts.length !== 1 ? 's' : ''}</p>
        </div>

        {/* Grid de contas — cada uma separada */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 90 }} />)}
          </div>
        ) : accounts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text3)', background: 'var(--bg2)', borderRadius: 14, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>🏦</div>
            <p style={{ fontSize: 13 }}>Nenhuma conta cadastrada.</p>
            <button onClick={() => setShowModal(true)} style={{ marginTop: 10, background: 'none', border: 'none', color: 'var(--indigo)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font)' }}>
              Adicionar primeira conta →
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {accounts.map(acc => {
              const bal   = balances[acc.id] ?? 0;
              const count = txCounts[acc.id] ?? 0;
              const isSelected = selectedAccount?.id === acc.id;
              return (
                <div key={acc.id} style={{ background: 'var(--bg2)', border: `1px solid ${isSelected ? (acc.color || 'var(--indigo)') + '55' : 'var(--border)'}`, borderRadius: 14, overflow: 'hidden', transition: 'border-color 0.2s' }}>
                  {/* Cabeçalho da conta */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', cursor: 'pointer' }}
                    onClick={() => setSelectedAccount(isSelected ? null : acc)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: (acc.color || '#7c7ff7') + '22', border: `1px solid ${(acc.color || '#7c7ff7')}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                        {acc.icon || '🏦'}
                      </div>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{acc.name}</p>
                        <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                          {acc.bank || 'Conta'} · {count} transaç{count !== 1 ? 'ões' : 'ão'}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 600, color: bal >= 0 ? 'var(--green)' : 'var(--red)' }}>
                          {fmt(bal)}
                        </p>
                        <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>saldo atual</p>
                      </div>
                      <span style={{ color: 'var(--text3)', fontSize: 12 }}>{isSelected ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {/* Ações */}
                  <div style={{ display: 'flex', gap: 8, padding: '0 20px 14px' }}>
                    <button onClick={() => { setEditing(acc); setShowModal(true); }} style={{ fontSize: 12, color: 'var(--indigo)', background: 'var(--indigo-dim)', border: 'none', borderRadius: 7, padding: '5px 12px', cursor: 'pointer', fontFamily: 'var(--font)' }}>Editar</button>
                    <button onClick={() => handleDelete(acc.id)} style={{ fontSize: 12, color: 'var(--red)', background: 'var(--red-dim)', border: 'none', borderRadius: 7, padding: '5px 12px', cursor: 'pointer', fontFamily: 'var(--font)' }}>Excluir</button>
                  </div>

                  {/* Extrato da conta expandido */}
                  {isSelected && <AccountStatement account={acc} />}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {showModal && (
        <AccountModal
          account={editing}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSave={() => { setShowModal(false); setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

// Sub-componente: extrato da conta selecionada
function AccountStatement({ account }) {
  const [txs, setTxs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/api/transactions?account_id=${account.id}`)
      .then(r => { setTxs(r.data); setLoading(false); });
  }, [account.id]);

  const fmt    = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  const fmtDate = d => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');

  return (
    <div style={{ borderTop: '1px solid var(--border)', background: 'var(--bg)' }}>
      <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Extrato — todas as transações desta conta
        </span>
      </div>

      {loading ? (
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 40 }} />)}
        </div>
      ) : txs.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 13, padding: '20px 0' }}>
          Nenhuma transação vinculada a esta conta ainda.
        </p>
      ) : (
        <div style={{ maxHeight: 280, overflowY: 'auto' }}>
          {txs.map(tx => (
            <div key={tx.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: tx.type === 'income' ? 'var(--green-dim)' : 'var(--red-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: tx.type === 'income' ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
                  {tx.type === 'income' ? '↑' : '↓'}
                </div>
                <div>
                  <p style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{tx.description || tx.categories?.name || '—'}</p>
                  <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>{fmtDate(tx.date)}{tx.categories ? ` · ${tx.categories.name}` : ''}</p>
                </div>
              </div>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 500, color: tx.type === 'income' ? 'var(--green)' : 'var(--red)' }}>
                {tx.type === 'income' ? '+' : '-'}{fmt(tx.amount)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
