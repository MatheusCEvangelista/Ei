export function useExportCSV() {
  function exportCSV(transactions, month, year) {
    if (!transactions?.length) { alert('Nenhuma transação para exportar.'); return; }
    const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const header = ['Data','Descrição','Categoria','Tipo','Valor (R$)'];
    const rows = transactions.map(tx => [
      new Date(tx.date+'T00:00:00').toLocaleDateString('pt-BR'),
      tx.description || '',
      tx.categories?.name || 'Sem categoria',
      tx.type === 'income' ? 'Receita' : 'Despesa',
      Number(tx.amount).toFixed(2).replace('.',','),
    ]);
    const csv = [header,...rows].map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(';')).join('\n');
    const blob = new Blob(['\uFEFF'+csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `financas_${MONTHS[month-1]}_${year}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
  return { exportCSV };
}
