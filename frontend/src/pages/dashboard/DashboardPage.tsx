import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PeriodFilter } from '@/features/dashboard/PeriodFilter';
import { useDashboard } from '@/features/dashboard/model/useDashboard';
import { Modal } from '@/shared/ui/Modal';
import { ExpenseChart } from '@/widgets/dashboard/ExpenseChart';
import { SummaryCards } from '@/widgets/dashboard/SummaryCards';
import { DashboardNotice } from '@/widgets/dashboard/DashboardNotice';
import { BudgetStrip, BudgetScore, GoalPreview } from '@/widgets/dashboard/DashboardWidgets';
import { Diagnostics } from '@/widgets/dashboard/Diagnostics';
import { getAuthGeneration } from '@/shared/api/tokens';

export default function DashboardPage() {
  const dashboard = useDashboard();
  const { status, data, selection, user } = dashboard;
  const [healthHelp, setHealthHelp] = useState(false);
  const firstName = user?.full_name.trim().split(/\s+/)[0];
  const hasOperations = !!data && (data.summary.total_income > 0 || data.summary.total_expense > 0);
  const showPanels = status === 'ready' || status === 'anonymous';
  const search = dashboard.search.toString();

  return <div className="dashboard-page" aria-busy={status === 'loading'}>
    <div className="dashboard-heading"><div><h1>{firstName ? 'Привет, ' + firstName + '!' : 'Привет!'}</h1><p>Твой финансовый обзор</p></div>
      {status === 'ready' ? <div className="dashboard-heading-actions"><Link to="/transactions?add=1" className="icon-button" aria-label="Добавить операцию"><img src="/figma/transactions/c46ca.svg" alt="" /></Link><button type="button" className="icon-button" onClick={dashboard.reload} aria-label="Обновить финансовый обзор"><RefreshCw size={18} /></button></div> : null}
    </div>
    <PeriodFilter selection={selection} onChange={dashboard.setSearch} />
    <DashboardNotice status={status} error={dashboard.error} reload={dashboard.reload} />
    <SummaryCards summary={data?.summary} loading={status === 'loading'} />
    {showPanels ? <>
      {status === 'ready' && !hasOperations ? <div className="dashboard-notice"><p>За этот период операций пока нет. Выберите другой период или добавьте выписку.</p><Link className="button-secondary" to="/setup">Загрузить выписку</Link></div> : null}
      <div className="dashboard-grid">
        <ExpenseChart key={selection.range.from + selection.range.to} categories={data?.by_categories ?? []} total={data?.summary.total_expense ?? 0} title="Структура расходов" compact emptyText={status === 'anonymous' ? 'Данные появятся после входа в аккаунт.' : undefined} />
        <div className="dashboard-right">
          <BudgetScore score={hasOperations ? data?.budget_score ?? null : null} onHelp={() => setHealthHelp(true)} />
          <BudgetStrip budget={hasOperations ? data?.budget_50_30_20 : undefined} to={'/analytics' + (search ? '?' + search : '')} />
          {hasOperations && data?.deficit_financing ? <p className="budget-context-note">За период не учтены доходы. Базой бюджета служат расходы.</p> : null}
        </div>
      </div>
    </> : null}
    {dashboard.canLoadAnalytics && (
      <Diagnostics
        key={[user?.id, getAuthGeneration(), selection.range.from, selection.range.to, dashboard.revision].join(':')}
        range={selection.range}
      />
    )}
    {showPanels && <GoalPreview />}
    <Modal open={healthHelp} title="Соблюдение бюджета" onClose={() => setHealthHelp(false)}>
      <p>{hasOperations ? 'Индекс рассчитывается по Вашим операциям за выбранный период. Он учитывает долю необязательных расходов относительно базы бюджета.' : 'Пока нет операций для расчёта. Здесь появится индекс соблюдения бюджета.'}</p>
      <Link to={'/analytics' + (search ? '?' + search : '')} className="button-primary" onClick={() => setHealthHelp(false)}>Посмотреть аналитику</Link>
    </Modal>
  </div>;
}
