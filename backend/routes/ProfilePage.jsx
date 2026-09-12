import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageShell, PageHeader, Card, Button, Input, InfoBox, SectionLabel, Divider } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../lib/api';

export default function ProfilePage() {
  const { user, logout }              = useAuth();
  const { theme, toggleTheme, setSystemTheme } = useTheme();
  const navigate                      = useNavigate();
  const [name,        setName]        = useState('');
  const [saving,      setSaving]      = useState(false);
  const [pwForm,      setPwForm]      = useState({ current:'', next:'', confirm:'' });
  const [pwSaving,    setPwSaving]    = useState(false);
  const [msg,         setMsg]         = useState(null); // {type, text}
  const [stats,       setStats]       = useState(null);
  const [exporting,   setExporting]   = useState(false);

  useEffect(() => {
    setName(user?.user_metadata?.name || user?.email?.split('@')[0] || '');
    // Carrega estatísticas básicas
    Promise.all([
      api.get('/api/transactions?include_pending=true').catch(()=>({data:[]})),
      api.get('/api/goals').catch(()=>({data:[]})),
      api.get('/api/investments').catch(()=>({data:[]})),
    ]).then(([txRes, goalRes, invRes]) => {
      setStats({
        transactions: txRes.data?.length || 0,
        goals:        goalRes.data?.length || 0,
        investments:  invRes.data?.length || 0,
      });
    });
  }, [user]);

  async function handleSaveName(e) {
    e.preventDefault(); setSaving(true); setMsg(null);
    try {
      await api.put('/api/auth/profile', { name });
      setMsg({ type:'success', text:'Nome atualizado com sucesso!' });
    } catch(err) {
      setMsg({ type:'error', text: err.response?.data?.error || 'Erro ao atualizar nome.' });
    }
    setSaving(false);
  }

  async function handleChangePassword(e) {
    e.preventDefault(); setMsg(null);
    if (pwForm.next !== pwForm.confirm) {
      setMsg({ type:'error', text:'As senhas não coincidem.' }); return;
    }
    if (pwForm.next.length < 6) {
      setMsg({ type:'error', text:'A senha deve ter pelo menos 6 caracteres.' }); return;
    }
    setPwSaving(true);
    try {
      await api.put('/api/auth/password', { password: pwForm.next });
      setMsg({ type:'success', text:'Senha alterada! Faça login novamente.' });
      setPwForm({ current:'', next:'', confirm:'' });
      setTimeout(() => logout(), 2000);
    } catch(err) {
      setMsg({ type:'error', text: err.response?.data?.error || 'Erro ao alterar senha.' });
    }
    setPwSaving(false);
  }

  async function handleExport() {
    setExporting(true);
    try {
      const [txRes, goalRes, invRes, accRes] = await Promise.all([
        api.get('/api/transactions?include_pending=true'),
        api.get('/api/goals'),
        api.get('/api/investments'),
        api.get('/api/accounts'),
      ]);

      const data = {
        exported_at:  new Date().toISOString(),
        user_email:   user?.email,
        transactions: txRes.data || [],
        goals:        goalRes.data || [],
        investments:  invRes.data || [],
        accounts:     accRes.data || [],
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `ei-dados-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg({ type:'success', text:'Dados exportados com sucesso!' });
    } catch {
      setMsg({ type:'error', text:'Erro ao exportar dados.' });
    }
    setExporting(false);
  }

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  const isDark = theme === 'dark';

  return (
    <PageShell maxWidth={600}>
      <PageHeader title="Meu perfil" subtitle={user?.email}/>

      {msg && (
        <InfoBox variant={msg.type==='success'?'success':'danger'} style={{marginBottom:'var(--space-4)'}}>
          {msg.text}
        </InfoBox>
      )}

      {/* Stats */}
      {stats && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'var(--space-3)',marginBottom:'var(--space-5)'}}>
          {[
            { label:'Transações', value:stats.transactions, icon:'📋' },
            { label:'Metas',      value:stats.goals,        icon:'🎯' },
            { label:'Investimentos',value:stats.investments, icon:'📈' },
          ].map(s=>(
            <Card key={s.label}>
              <div style={{padding:'var(--space-4)',textAlign:'center'}}>
                <div style={{fontSize:24,marginBottom:'var(--space-1)'}}>{s.icon}</div>
                <p style={{fontFamily:'var(--mono)',fontSize:'var(--text-2xl)',fontWeight:'var(--font-bold)',color:'var(--indigo)'}}>{s.value}</p>
                <p style={{fontSize:'var(--text-xs)',color:'var(--text3)',marginTop:'var(--space-1)'}}>{s.label}</p>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Nome */}
      <Card style={{marginBottom:'var(--space-4)'}}>
        <div style={{padding:'var(--space-5)'}}>
          <SectionLabel style={{marginBottom:'var(--space-4)'}}>Informações pessoais</SectionLabel>
          <form onSubmit={handleSaveName} style={{display:'flex',flexDirection:'column',gap:'var(--space-3)'}}>
            <Input label="Nome de exibição" value={name} onChange={e=>setName(e.target.value)} placeholder="Como quer ser chamado?"/>
            <div>
              <label style={{display:'block',fontSize:'var(--text-xs)',color:'var(--text2)',fontWeight:'var(--font-medium)',marginBottom:'var(--space-1)',textTransform:'uppercase',letterSpacing:'0.05em'}}>E-mail</label>
              <p style={{fontSize:'var(--text-base)',color:'var(--text3)',padding:'11px 14px',background:'var(--bg3)',borderRadius:'var(--radius-sm)',border:'1px solid var(--border)'}}>{user?.email}</p>
            </div>
            <Button type="submit" disabled={saving} size="md">{saving?'Salvando...':'Salvar nome'}</Button>
          </form>
        </div>
      </Card>

      {/* Tema */}
      <Card style={{marginBottom:'var(--space-4)'}}>
        <div style={{padding:'var(--space-5)'}}>
          <SectionLabel style={{marginBottom:'var(--space-4)'}}>Aparência</SectionLabel>
          <div style={{display:'flex',gap:'var(--space-3)',flexWrap:'wrap'}}>
            {[
              { id:'light',  label:'☀️ Claro'  },
              { id:'dark',   label:'🌙 Escuro'  },
              { id:'system', label:'⚙️ Sistema' },
            ].map(t=>(
              <button key={t.id} onClick={()=>{ if(t.id==='system') setSystemTheme(); else if(t.id!==theme) toggleTheme(); }}
                style={{
                  flex:1, padding:'var(--space-3)',
                  borderRadius:'var(--radius-md)',
                  border:`2px solid ${(t.id==='system'?false:theme===t.id)?'var(--indigo)':'var(--border)'}`,
                  background:(t.id==='system'?false:theme===t.id)?'var(--indigo-dim)':'var(--bg3)',
                  color:(t.id==='system'?false:theme===t.id)?'var(--indigo)':'var(--text)',
                  cursor:'pointer', fontFamily:'var(--font)',
                  fontSize:'var(--text-sm)', fontWeight:'var(--font-medium)',
                  transition:'all var(--transition)',
                }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Alterar senha */}
      <Card style={{marginBottom:'var(--space-4)'}}>
        <div style={{padding:'var(--space-5)'}}>
          <SectionLabel style={{marginBottom:'var(--space-4)'}}>Alterar senha</SectionLabel>
          <form onSubmit={handleChangePassword} style={{display:'flex',flexDirection:'column',gap:'var(--space-3)'}}>
            <Input label="Nova senha" type="password" value={pwForm.next} onChange={e=>setPwForm({...pwForm,next:e.target.value})} placeholder="Mínimo 6 caracteres"/>
            <Input label="Confirmar nova senha" type="password" value={pwForm.confirm} onChange={e=>setPwForm({...pwForm,confirm:e.target.value})} placeholder="Repita a senha"/>
            <Button type="submit" disabled={pwSaving} variant="secondary">{pwSaving?'Alterando...':'Alterar senha'}</Button>
          </form>
        </div>
      </Card>

      {/* Dados e conta */}
      <Card>
        <div style={{padding:'var(--space-5)'}}>
          <SectionLabel style={{marginBottom:'var(--space-4)'}}>Dados e conta</SectionLabel>
          <div style={{display:'flex',flexDirection:'column',gap:'var(--space-3)'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:'var(--space-2)'}}>
              <div>
                <p style={{fontSize:'var(--text-sm)',fontWeight:'var(--font-medium)',color:'var(--text)'}}>Exportar meus dados</p>
                <p style={{fontSize:'var(--text-xs)',color:'var(--text3)'}}>Baixa todas as suas transações, metas e investimentos em JSON</p>
              </div>
              <Button variant="secondary" size="sm" onClick={handleExport} disabled={exporting}>
                {exporting?'Exportando...':'📥 Exportar'}
              </Button>
            </div>

            <Divider/>

            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:'var(--space-2)'}}>
              <div>
                <p style={{fontSize:'var(--text-sm)',fontWeight:'var(--font-medium)',color:'var(--text)'}}>Sair da conta</p>
                <p style={{fontSize:'var(--text-xs)',color:'var(--text3)'}}>Você precisará fazer login novamente</p>
              </div>
              <Button variant="danger" size="sm" onClick={handleLogout}>Sair</Button>
            </div>
          </div>
        </div>
      </Card>
    </PageShell>
  );
}
