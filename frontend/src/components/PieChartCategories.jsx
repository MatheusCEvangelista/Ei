import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

function fmt(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div style={{
      background: 'var(--bg3)', border: '1px solid var(--border-md)',
      borderRadius: 10, padding: '10px 14px', fontSize: 13,
      boxShadow: 'var(--shadow)',
    }}>
      <p style={{ color: 'var(--text)', fontWeight: 500, marginBottom: 4 }}>{d.name}</p>
      <p style={{ color: d.payload.color, fontFamily: 'var(--mono)' }}>{fmt(d.value)}</p>
    </div>
  );
}

export default function PieChartCategories({ data }) {
  if (!data?.length) return (
    <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 13 }}>
      Sem despesas no período
    </div>
  );
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%"
          outerRadius={72} innerRadius={36} paddingAngle={3} strokeWidth={0}>
          {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend iconType="circle" iconSize={7}
          formatter={v => <span style={{ fontSize: 12, color: 'var(--text2)', fontFamily: 'var(--font)' }}>{v}</span>} />
      </PieChart>
    </ResponsiveContainer>
  );
}
