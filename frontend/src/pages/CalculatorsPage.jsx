import { useState } from 'react';
import Navbar from '../components/Navbar';

const fmt  = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);
const fmtN = v => new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2}).format(v||0);

const inp = { width:'100%', padding:'11px 14px', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text)' };
const lbl = { display:'block', fontSize:12, color:'var(--text2)', fontWeight:500, marginBottom:6, letterSpacing:'0.02em' };

function ResultBox({ items }) {
  if (!items) return null;
  return (
    <div style={{background:'var(--indigo-dim)',border:'1px solid rgba(124,127,247,0.25)',borderRadius:10,padding:'14px 16px',marginTop:16}}>
      {items.map((item,i)=>(
        <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:i<items.length-1?8:0}}>
          <span style={{fontSize:12,color:'var(--text2)'}}>{item.label}</span>
          <span style={{fontFamily:'var(--mono)',fontSize:14,fontWeight:item.highlight?700:500,color:item.highlight?'var(--indigo)':'var(--text)'}}>{item.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── CALCULADORAS ──────────────────────────────────────────────────────────

function JurosCompostos() {
  const [f, setF] = useState({ capital:'', taxa:'', periodo:'', aporte:'', tipoTaxa:'mensal' });
  const [r, setR] = useState(null);
  function calc() {
    const C=parseFloat(f.capital)||0, i=parseFloat(f.taxa)/100, n=parseFloat(f.periodo)||0, A=parseFloat(f.aporte)||0;
    const im = f.tipoTaxa==='anual' ? Math.pow(1+i,1/12)-1 : i;
    const montante = C*Math.pow(1+im,n) + (A>0 ? A*(Math.pow(1+im,n)-1)/im : 0);
    const total = C + A*n;
    setR([
      {label:'Montante final',    value:fmt(montante), highlight:true},
      {label:'Total investido',   value:fmt(total)},
      {label:'Rendimento total',  value:fmt(montante-total)},
      {label:'Rentabilidade',     value:`${((montante/total-1)*100).toFixed(2)}%`},
    ]);
  }
  return (
    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><label style={lbl}>Capital inicial (R$)</label><input type="number" value={f.capital} onChange={e=>setF({...f,capital:e.target.value})} placeholder="10000" style={inp}/></div>
        <div><label style={lbl}>Aporte mensal (R$)</label><input type="number" value={f.aporte} onChange={e=>setF({...f,aporte:e.target.value})} placeholder="500" style={inp}/></div>
        <div><label style={lbl}>Taxa de juros (%)</label><input type="number" step="0.01" value={f.taxa} onChange={e=>setF({...f,taxa:e.target.value})} placeholder="1.0" style={inp}/></div>
        <div><label style={lbl}>Tipo da taxa</label>
          <select value={f.tipoTaxa} onChange={e=>setF({...f,tipoTaxa:e.target.value})} style={inp}>
            <option value="mensal">Mensal</option><option value="anual">Anual</option>
          </select>
        </div>
        <div><label style={lbl}>Período (meses)</label><input type="number" value={f.periodo} onChange={e=>setF({...f,periodo:e.target.value})} placeholder="24" style={inp}/></div>
      </div>
      <button onClick={calc} style={{padding:'12px',borderRadius:9,border:'none',background:'linear-gradient(135deg,var(--indigo),#a78bfa)',color:'#fff',fontFamily:'var(--font)',fontSize:13,fontWeight:600,cursor:'pointer'}}>Calcular</button>
      <ResultBox items={r}/>
    </div>
  );
}

function JurosSimples() {
  const [f, setF] = useState({ capital:'', taxa:'', periodo:'' });
  const [r, setR] = useState(null);
  function calc() {
    const C=parseFloat(f.capital)||0, i=parseFloat(f.taxa)/100, n=parseFloat(f.periodo)||0;
    const juros=C*i*n;
    setR([
      {label:'Montante',   value:fmt(C+juros), highlight:true},
      {label:'Juros totais', value:fmt(juros)},
      {label:'Capital',    value:fmt(C)},
    ]);
  }
  return (
    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><label style={lbl}>Capital (R$)</label><input type="number" value={f.capital} onChange={e=>setF({...f,capital:e.target.value})} placeholder="5000" style={inp}/></div>
        <div><label style={lbl}>Taxa mensal (%)</label><input type="number" step="0.01" value={f.taxa} onChange={e=>setF({...f,taxa:e.target.value})} placeholder="2.5" style={inp}/></div>
        <div><label style={lbl}>Período (meses)</label><input type="number" value={f.periodo} onChange={e=>setF({...f,periodo:e.target.value})} placeholder="12" style={inp}/></div>
      </div>
      <button onClick={calc} style={{padding:'12px',borderRadius:9,border:'none',background:'linear-gradient(135deg,var(--indigo),#a78bfa)',color:'#fff',fontFamily:'var(--font)',fontSize:13,fontWeight:600,cursor:'pointer'}}>Calcular</button>
      <ResultBox items={r}/>
    </div>
  );
}

function Financiamento() {
  const [f, setF] = useState({ valor:'', entrada:'', taxa:'', parcelas:'' });
  const [r, setR] = useState(null);
  function calc() {
    const PV=parseFloat(f.valor)-parseFloat(f.entrada||0), i=parseFloat(f.taxa)/100, n=parseFloat(f.parcelas)||1;
    const pmt = PV * (i*Math.pow(1+i,n)) / (Math.pow(1+i,n)-1);
    setR([
      {label:'Parcela mensal',  value:fmt(pmt), highlight:true},
      {label:'Total pago',      value:fmt(pmt*n)},
      {label:'Valor financiado',value:fmt(PV)},
      {label:'Total de juros',  value:fmt(pmt*n-PV)},
      {label:'CET aproximado',  value:`${((pmt*n/PV-1)*100).toFixed(1)}%`},
    ]);
  }
  return (
    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><label style={lbl}>Valor do bem (R$)</label><input type="number" value={f.valor} onChange={e=>setF({...f,valor:e.target.value})} placeholder="50000" style={inp}/></div>
        <div><label style={lbl}>Entrada (R$)</label><input type="number" value={f.entrada} onChange={e=>setF({...f,entrada:e.target.value})} placeholder="10000" style={inp}/></div>
        <div><label style={lbl}>Taxa mensal (%)</label><input type="number" step="0.01" value={f.taxa} onChange={e=>setF({...f,taxa:e.target.value})} placeholder="1.5" style={inp}/></div>
        <div><label style={lbl}>Nº de parcelas</label><input type="number" value={f.parcelas} onChange={e=>setF({...f,parcelas:e.target.value})} placeholder="48" style={inp}/></div>
      </div>
      <button onClick={calc} style={{padding:'12px',borderRadius:9,border:'none',background:'linear-gradient(135deg,var(--indigo),#a78bfa)',color:'#fff',fontFamily:'var(--font)',fontSize:13,fontWeight:600,cursor:'pointer'}}>Calcular</button>
      <ResultBox items={r}/>
    </div>
  );
}

function IPVA() {
  const TAXAS = {
    'SP':{ auto:4, moto:2, caminhao:1.5, label:'São Paulo' },
    'MG':{ auto:4, moto:2, caminhao:1,   label:'Minas Gerais' },
    'RJ':{ auto:4, moto:2, caminhao:1.5, label:'Rio de Janeiro' },
    'RS':{ auto:3, moto:3, caminhao:1,   label:'Rio Grande do Sul' },
    'PR':{ auto:3.5,moto:2,caminhao:1,   label:'Paraná' },
    'SC':{ auto:2, moto:2, caminhao:1,   label:'Santa Catarina' },
    'BA':{ auto:3.5,moto:2,caminhao:2,   label:'Bahia' },
    'GO':{ auto:3.75,moto:2,caminhao:1,  label:'Goiás' },
    'DF':{ auto:3.5,moto:2,caminhao:1.5, label:'Distrito Federal' },
    'outros':{ auto:3, moto:2, caminhao:1.5, label:'Outros estados (média)' },
  };
  const [f, setF] = useState({ valor:'', estado:'SP', tipo:'auto', desconto:'' });
  const [r, setR] = useState(null);

  function calc() {
    const valor = parseFloat(f.valor)||0;
    const taxa  = TAXAS[f.estado]?.[f.tipo] || 3;
    const ipvaBase = valor * taxa / 100;
    const descPct  = parseFloat(f.desconto)||0;
    const ipvaFinal = ipvaBase * (1 - descPct/100);
    const ipvaDivid = ipvaFinal / 12;

    setR([
      {label:`IPVA ${TAXAS[f.estado].label} (${taxa}%)`, value:fmt(ipvaBase), highlight:true},
      {label:'Com desconto à vista',  value:fmt(ipvaFinal)},
      {label:'Desconto aplicado',     value:fmt(ipvaBase-ipvaFinal)},
      {label:'Equivalente mensal',    value:fmt(ipvaDivid)},
    ]);
  }

  return (
    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      <div style={{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:9,padding:'10px 14px',fontSize:12,color:'var(--text3)',lineHeight:1.5}}>
        💡 O IPVA é calculado sobre o valor venal do veículo (tabela FIPE). A alíquota varia por estado e tipo de veículo.
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><label style={lbl}>Valor FIPE do veículo (R$)</label><input type="number" value={f.valor} onChange={e=>setF({...f,valor:e.target.value})} placeholder="45000" style={inp}/></div>
        <div><label style={lbl}>Estado</label>
          <select value={f.estado} onChange={e=>setF({...f,estado:e.target.value})} style={inp}>
            {Object.entries(TAXAS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div><label style={lbl}>Tipo de veículo</label>
          <select value={f.tipo} onChange={e=>setF({...f,tipo:e.target.value})} style={inp}>
            <option value="auto">Automóvel / Caminhonete</option>
            <option value="moto">Motocicleta</option>
            <option value="caminhao">Caminhão / Ônibus</option>
          </select>
        </div>
        <div><label style={lbl}>Desconto à vista (%)</label><input type="number" step="0.1" value={f.desconto} onChange={e=>setF({...f,desconto:e.target.value})} placeholder="Ex: 3" style={inp}/></div>
      </div>
      <button onClick={calc} style={{padding:'12px',borderRadius:9,border:'none',background:'linear-gradient(135deg,var(--indigo),#a78bfa)',color:'#fff',fontFamily:'var(--font)',fontSize:13,fontWeight:600,cursor:'pointer'}}>Calcular IPVA</button>
      <ResultBox items={r}/>
    </div>
  );
}

function ValorizacaoImovel() {
  const [f, setF] = useState({ valorAtual:'', valorOriginal:'', anos:'' });
  const [r, setR] = useState(null);
  function calc() {
    const atual=parseFloat(f.valorAtual)||0, orig=parseFloat(f.valorOriginal)||0, anos=parseFloat(f.anos)||1;
    const ganho = atual - orig;
    const ganhoTotal = orig>0?(ganho/orig*100):0;
    const ganhoAnual = Math.pow(atual/orig, 1/anos) - 1;
    setR([
      {label:'Valorização total',  value:`${ganhoTotal.toFixed(1)}%`, highlight:true},
      {label:'Ganho em R$',        value:fmt(ganho)},
      {label:'Valorização ao ano', value:`${(ganhoAnual*100).toFixed(2)}% a.a.`},
      {label:'Valor atual',        value:fmt(atual)},
    ]);
  }
  return (
    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><label style={lbl}>Valor de compra (R$)</label><input type="number" value={f.valorOriginal} onChange={e=>setF({...f,valorOriginal:e.target.value})} placeholder="300000" style={inp}/></div>
        <div><label style={lbl}>Valor atual / venda (R$)</label><input type="number" value={f.valorAtual} onChange={e=>setF({...f,valorAtual:e.target.value})} placeholder="420000" style={inp}/></div>
        <div><label style={lbl}>Anos decorridos</label><input type="number" value={f.anos} onChange={e=>setF({...f,anos:e.target.value})} placeholder="5" style={inp}/></div>
      </div>
      <button onClick={calc} style={{padding:'12px',borderRadius:9,border:'none',background:'linear-gradient(135deg,var(--indigo),#a78bfa)',color:'#fff',fontFamily:'var(--font)',fontSize:13,fontWeight:600,cursor:'pointer'}}>Calcular valorização</button>
      <ResultBox items={r}/>
    </div>
  );
}

function RendaPassiva() {
  const [f, setF] = useState({ patrimonio:'', taxa:'', renda:'' });
  const [r, setR] = useState(null);
  function calcDePatrimonio() {
    const P=parseFloat(f.patrimonio)||0, i=parseFloat(f.taxa)/100;
    setR([
      {label:'Renda mensal estimada', value:fmt(P*i), highlight:true},
      {label:'Renda anual',           value:fmt(P*i*12)},
      {label:'Patrimônio',            value:fmt(P)},
      {label:'Taxa mensal usada',     value:`${f.taxa}%`},
    ]);
  }
  function calcDeRenda() {
    const R=parseFloat(f.renda)||0, i=parseFloat(f.taxa)/100;
    setR([
      {label:'Patrimônio necessário', value:fmt(R/i), highlight:true},
      {label:'Renda mensal desejada', value:fmt(R)},
      {label:'Taxa mensal usada',     value:`${f.taxa}%`},
    ]);
  }
  return (
    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><label style={lbl}>Patrimônio investido (R$)</label><input type="number" value={f.patrimonio} onChange={e=>setF({...f,patrimonio:e.target.value})} placeholder="500000" style={inp}/></div>
        <div><label style={lbl}>Taxa de retorno mensal (%)</label><input type="number" step="0.01" value={f.taxa} onChange={e=>setF({...f,taxa:e.target.value})} placeholder="0.8" style={inp}/></div>
        <div><label style={lbl}>Ou: renda mensal desejada (R$)</label><input type="number" value={f.renda} onChange={e=>setF({...f,renda:e.target.value})} placeholder="5000" style={inp}/></div>
      </div>
      <div style={{display:'flex',gap:8}}>
        <button onClick={calcDePatrimonio} style={{flex:1,padding:'11px',borderRadius:9,border:'none',background:'linear-gradient(135deg,var(--indigo),#a78bfa)',color:'#fff',fontFamily:'var(--font)',fontSize:13,fontWeight:600,cursor:'pointer'}}>Calcular renda</button>
        <button onClick={calcDeRenda} style={{flex:1,padding:'11px',borderRadius:9,border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text)',fontFamily:'var(--font)',fontSize:13,fontWeight:500,cursor:'pointer'}}>Calcular patrimônio</button>
      </div>
      <ResultBox items={r}/>
    </div>
  );
}

function Ferias() {
  const [f, setF] = useState({ salario:'', tempoServico:'', diasFaltas:'' });
  const [r, setR] = useState(null);
  function calc() {
    const sal=parseFloat(f.salario)||0, faltas=parseFloat(f.diasFaltas)||0;
    let diasDireito=30;
    if (faltas>14) diasDireito=12;
    else if (faltas>9) diasDireito=18;
    else if (faltas>5) diasDireito=24;
    const feriasBruto = sal/30*diasDireito;
    const terco = feriasBruto/3;
    setR([
      {label:'Férias brutas',     value:fmt(feriasBruto), highlight:true},
      {label:'1/3 constitucional',value:fmt(terco)},
      {label:'Total bruto',       value:fmt(feriasBruto+terco)},
      {label:'Dias de direito',   value:`${diasDireito} dias`},
    ]);
  }
  return (
    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><label style={lbl}>Salário bruto (R$)</label><input type="number" value={f.salario} onChange={e=>setF({...f,salario:e.target.value})} placeholder="3000" style={inp}/></div>
        <div><label style={lbl}>Faltas no período</label><input type="number" value={f.diasFaltas} onChange={e=>setF({...f,diasFaltas:e.target.value})} placeholder="0" style={inp}/></div>
      </div>
      <button onClick={calc} style={{padding:'12px',borderRadius:9,border:'none',background:'linear-gradient(135deg,var(--indigo),#a78bfa)',color:'#fff',fontFamily:'var(--font)',fontSize:13,fontWeight:600,cursor:'pointer'}}>Calcular</button>
      <ResultBox items={r}/>
    </div>
  );
}

function DecTrimo() {
  const [f, setF] = useState({ salario:'' });
  const [r, setR] = useState(null);
  function calc() {
    const sal=parseFloat(f.salario)||0;
    const decimo=sal, fgts=sal*0.08*12;
    setR([
      {label:'13º salário bruto', value:fmt(decimo), highlight:true},
      {label:'FGTS anual (8%)',   value:fmt(fgts)},
      {label:'Total benefícios',  value:fmt(decimo+fgts)},
    ]);
  }
  return (
    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      <div><label style={lbl}>Salário bruto (R$)</label><input type="number" value={f.salario} onChange={e=>setF({...f,salario:e.target.value})} placeholder="3000" style={inp}/></div>
      <button onClick={calc} style={{padding:'12px',borderRadius:9,border:'none',background:'linear-gradient(135deg,var(--indigo),#a78bfa)',color:'#fff',fontFamily:'var(--font)',fontSize:13,fontWeight:600,cursor:'pointer'}}>Calcular</button>
      <ResultBox items={r}/>
    </div>
  );
}

// ── Tabs das calculadoras ─────────────────────────────────────────────────
const TABS = [
  { id:'juros_comp',   label:'Juros Compostos', icon:'📈', group:'financeiro' },
  { id:'juros_simples',label:'Juros Simples',   icon:'💰', group:'financeiro' },
  { id:'financiamento',label:'Financiamento',   icon:'🏦', group:'financeiro' },
  { id:'renda_passiva',label:'Renda Passiva',   icon:'🤑', group:'patrimonio' },
  { id:'ipva',         label:'IPVA',            icon:'🚗', group:'patrimonio' },
  { id:'imovel',       label:'Imóvel',          icon:'🏠', group:'patrimonio' },
  { id:'ferias',       label:'Férias',          icon:'🏖️', group:'trabalhista' },
  { id:'decimo',       label:'13º / FGTS',      icon:'📋', group:'trabalhista' },
];

const COMPONENTS = {
  juros_comp: JurosCompostos, juros_simples: JurosSimples,
  financiamento: Financiamento, renda_passiva: RendaPassiva,
  ipva: IPVA, imovel: ValorizacaoImovel,
  ferias: Ferias, decimo: DecTrimo,
};

const GROUP_LABELS = {
  financeiro: '💰 Financeiro',
  patrimonio: '🏛️ Patrimônio',
  trabalhista:'📋 Trabalhista',
};

export default function CalculatorsPage() {
  const [active, setActive] = useState('juros_comp');
  const Comp = COMPONENTS[active];

  const groups = ['financeiro','patrimonio','trabalhista'];

  return (
    <div style={{minHeight:'100vh',background:'var(--bg)'}}>
      <Navbar/>
      <main className="page-main" style={{maxWidth:720,margin:'0 auto',padding:'24px 16px 80px'}}>
        <div style={{marginBottom:24}}>
          <h1 style={{fontSize:20,fontWeight:600,letterSpacing:'-0.03em'}}>Calculadoras</h1>
          <p style={{color:'var(--text3)',fontSize:13,marginTop:4}}>Simule e planeje suas finanças</p>
        </div>

        {/* Grupos de calculadoras */}
        <div style={{display:'flex',flexDirection:'column',gap:12,marginBottom:20}}>
          {groups.map(group=>(
            <div key={group}>
              <p style={{fontSize:11,color:'var(--text3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:8}}>
                {GROUP_LABELS[group]}
              </p>
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {TABS.filter(t=>t.group===group).map(tab=>(
                  <button key={tab.id} onClick={()=>setActive(tab.id)}
                    style={{padding:'8px 14px',borderRadius:9,fontSize:12,fontWeight:500,border:`1.5px solid ${active===tab.id?'var(--indigo)':'var(--border)'}`,background:active===tab.id?'var(--indigo-dim)':'var(--bg2)',color:active===tab.id?'var(--indigo)':'var(--text)',cursor:'pointer',fontFamily:'var(--font)',transition:'all 0.15s',display:'flex',alignItems:'center',gap:5}}>
                    {tab.icon} {tab.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Calculadora ativa */}
        <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:14,padding:'20px'}}>
          <h2 style={{fontSize:15,fontWeight:600,marginBottom:16,color:'var(--text)'}}>
            {TABS.find(t=>t.id===active)?.icon} {TABS.find(t=>t.id===active)?.label}
          </h2>
          {Comp && <Comp/>}
        </div>
      </main>
    </div>
  );
}
