import type { DashboardResponse } from '@/entities/analytics/model/types';
import { formatMoney } from '@/shared/lib/format';

function csvCell(value: string | number): string {
  const text = typeof value === 'string' && /^[\s]*[=+@-]/.test(value) ? "'" + value : String(value);
  return '"' + text.replaceAll('"', '""') + '"';
}

export function BudgetExport({ budget }: { budget: DashboardResponse }) {
  const totals = [
    { label: 'Доходы', amount: budget.summary.total_income },
    { label: 'Расходы', amount: budget.summary.total_expense },
    { label: 'Баланс', amount: budget.summary.net_balance },
  ];
  const filename = `finsmart-${budget.period.from}-${budget.period.to}`;
  const rows = [...totals, ...budget.by_categories.map((row) => ({ label: row.name, amount: row.amount }))];

  function download() {
    const csv = [
      ['Начало периода', 'Конец периода', 'Показатель', 'Сумма в рублях'],
      ...rows.map((row) => [budget.period.from, budget.period.to, row.label, row.amount]),
    ].map((row) => row.map(csvCell).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename + '.csv';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <>
    <div className="flex flex-wrap gap-3 print:hidden">
      <button type="button" className="button-primary" onClick={download}>Скачать CSV</button>
      <button type="button" className="button-primary" onClick={() => window.print()}>Печать / PDF</button>
    </div>
    <section className="budget-print hidden print:block">
      <h1>ФинСмарт — финансовый отчёт</h1>
      <p>Период {budget.period.from} — {budget.period.to}</p>
      <table className="w-full border-collapse">
        <thead><tr><th className="border p-2 text-left">Показатель</th><th className="border p-2 text-right">Сумма</th></tr></thead>
        <tbody>{rows.map((row, index) => <tr key={index}>
          <td className="border p-2">{row.label}</td>
          <td className="border p-2 text-right">{formatMoney(row.amount)}</td>
        </tr>)}</tbody>
      </table>
    </section>
  </>;
}
