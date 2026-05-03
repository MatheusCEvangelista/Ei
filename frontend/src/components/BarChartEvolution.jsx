import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

function fmt(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(v);
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg3)', border: '1px solid var(--border-md)',
      borderRadius: 10, padding: '10px 14px', fontSize: 13,
      boxShadow: 'var(--shadow)',
    }}>
      <p style={{ color: 'var(--text2)', marginBottom: 6, fontWeight: 500 }}>{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.dataKey === 'income' ? 'var(--green)' : 'var(--red)', fontFamily: 'var(--mono)' }}>
          {p.dataKey === 'income' ? 'Receita' : 'Despesa'}: {fmt(p.value)}
        </p>
      ))}
    </div>
  );
}

export default function BarChartEvolution({ data }) {
  if (!data?.length) return (
    <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 13 }}>
      Sem dados ainda
    </div>
  );
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} barCategoryGap="35%">
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'var(--text3)', fontFamily: 'var(--font)' }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: 'var(--text3)', fontFamily: 'var(--mono)' }} axisLine={false} tickLine={false} width={62} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)', radius: 6 }} />
        <Legend formatter={v => (
          <span style={{ fontSize: 12, color: 'var(--text2)', fontFamily: 'var(--font)' }}>
            {v === 'income' ? 'Receita' : 'Despesa'}
          </span>
        )} iconType="circle" iconSize={7} />
        <Bar dataKey="income" fill="var(--green)" radius={[5, 5, 0, 0]} opacity={0.9} />
        <Bar dataKey="expense" fill="var(--red)"   radius={[5, 5, 0, 0]} opacity={0.9} />
      </BarChart>
    </ResponsiveContainer>
  );
}
