import { useState, useEffect } from 'react';
import api from '../lib/api';
import SummaryCards      from '../components/SummaryCards';
import BarChartEvolution from '../components/BarChartEvolution';
import PieChartCategories from '../components/PieChartCategories';
import TransactionList   from '../components/TransactionList';
import TransactionModal  from '../components/TransactionModal';
import ImportModal       from '../components/ImportModal';
import MonthSelector     from '../components/MonthSelector';
import MonthlyAnalysis   from '../components/MonthlyAnalysis';
import Navbar            from '../components/Navbar';
import { useExportCSV }  from '../hooks/useExportCSV';

const card = { background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'20px 18px 16px' };

export default function Dashboard() {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth()+1);
  const [year,  setYear]  = useState(today.getFullYear());
  const [summary,      setSummary]      = useState({income:0,expense:0,balance:0,byCategory:[]});
  const [evolution,    setEvolution]    = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [showModal,    setShowModal]    = useState(false);
  const [showImport,   setShowImport]   = useState(false);
  const [editingTx,    setEditingTx]    = useState(null);
  const [loading,      setLoading]      = useState(true);
  const { exportCSV } = useExportCSV();

  async function loadData() {
    setLoading(true);
    try {
      const [s, e, t] = await Promise.all([
        api.get(`/api/summary?month=${month}&year=${year}`),
        api.get('/api/summary/evolution'),
        api.get(`/api/transactions?month=${month}&year=${year}`),
      ]);
      setSummary(s.data); setEvolution(e.data); setTransactions(t.data);
    } catch(err){ console.error(err); }
    finally { setLoading(false); }
  }

  useEffect(()=>{ loadData(); },[month,year]);

  function handleClose() { setShowModal(false); setEditingTx(null); }
  async function handleDelete(id) {
    if(!confirm('Excluir esta transação?')) return;
    await api.delete(`/api/transactions/${id}`);
    loadData();
  }

  return (
    <div style={{minHeight:'100vh',background:'var(--bg)'}}>
      <Navbar/>
      <main className="page-main" style={{maxWidth:960,margin:'0 auto',padding:'20px 16px 80px'}}>

        <div className="stack-mobile" style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20,gap:12,flexWrap:'wrap'}}>
          <MonthSelector month={month} year={year} onChange={(m,y)=>{setMonth(m);setYear(y);}}/>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            <MonthlyAnalysis month={month} year={year}/>
            <button onClick={()=>setShowImport(true)} style={{padding:'8px 12px',borderRadius:10,border:'1px solid var(--border)',background:'var(--bg2)',color:'var(--text2)',fontFamily:'var(--font)',fontSize:13,fontWeight:500,cursor:'pointer'}}>
              ↑ Importar
            </button>
            <button onClick={()=>exportCSV(transactions,month,year)} style={{padding:'8px 12px',borderRadius:10,border:'1px solid var(--border)',background:'var(--bg2)',color:'var(--text2)',fontFamily:'var(--font)',fontSize:13,fontWeight:500,cursor:'pointer'}}>
              ↓ CSV
            </button>
            <button onClick={()=>setShowModal(true)} style={{padding:'8px 14px',borderRadius:10,border:'none',background:'linear-gradient(135deg,var(--indigo),#a78bfa)',color:'#fff',fontFamily:'var(--font)',fontSize:13,fontWeight:600,cursor:'pointer'}}>
              ＋ Nova transação
            </button>
          </div>
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <SummaryCards summary={summary} loading={loading}/>
          <div className="charts-grid" style={{display:'grid',gap:14}}>
            <div style={card}>
              <p style={{fontSize:11,color:'var(--text3)',fontWeight:600,letterSpacing:'0.07em',textTransform:'uppercase',marginBottom:16}}>Evolução — 6 meses</p>
              <BarChartEvolution data={evolution}/>
            </div>
            <div style={card}>
              <p style={{fontSize:11,color:'var(--text3)',fontWeight:600,letterSpacing:'0.07em',textTransform:'uppercase',marginBottom:16}}>Despesas por categoria</p>
              <PieChartCategories data={summary.byCategory}/>
            </div>
          </div>
          <div style={card}>
            <p style={{fontSize:11,color:'var(--text3)',fontWeight:600,letterSpacing:'0.07em',textTransform:'uppercase',marginBottom:16}}>Transações do mês</p>
            <TransactionList transactions={transactions} loading={loading}
              onEdit={tx=>{setEditingTx(tx);setShowModal(true);}}
              onDelete={handleDelete}/>
          </div>
        </div>
      </main>

      <button onClick={()=>setShowModal(true)} className="fab sm:hidden" style={{position:'fixed',bottom:24,right:20,zIndex:30,width:54,height:54,borderRadius:'50%',border:'none',background:'linear-gradient(135deg,var(--indigo),#a78bfa)',color:'#fff',fontSize:26,cursor:'pointer',boxShadow:'0 4px 20px rgba(124,127,247,0.45)',display:'flex',alignItems:'center',justifyContent:'center'}}>＋</button>

      {showImport && <ImportModal onClose={()=>setShowImport(false)} onSave={()=>{setShowImport(false);loadData();}}/>}
      {showModal  && <TransactionModal transaction={editingTx} onClose={handleClose} onSave={()=>{handleClose();loadData();}}/>}
    </div>
  );
}
