import { useState } from 'react';
import { Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useDemoSession } from '@/features/onboarding/model/context';
import { Modal } from '@/shared/ui/Modal';
import { ExpenseChart } from '@/widgets/dashboard/ExpenseChart';
import { BudgetStrip, FinancialHealth, GoalPreview } from '@/widgets/dashboard/DashboardWidgets';

export default function DashboardPage() {
  const { session } = useDemoSession();
  const [healthHelp, setHealthHelp] = useState(false);
  const firstName = session.fullName.trim().split(/\s+/)[0];

  return (
    <div className="dashboard-page">
      <div className="dashboard-heading"><h1>{firstName ? 'Привет, ' + firstName + '!' : 'Привет!'}</h1><p>Твой финансовый обзор</p></div>
      <dl className="dashboard-summary">
        <div className="summary-tile summary-tile-balance"><Wallet aria-hidden="true" /><div><dt>Баланс</dt><dd>—</dd><small>Нет данных</small></div></div>
        <div className="summary-tile summary-tile-expenses"><Wallet aria-hidden="true" /><div><dt>Расходы</dt><dd>—</dd><small>Нет операций</small></div></div>
      </dl>
      <div className="dashboard-grid">
        <ExpenseChart categories={[]} total={0} title="Структура расходов" compact />
        <div className="dashboard-right">
          <FinancialHealth score={null} onHelp={() => setHealthHelp(true)} />
          <BudgetStrip />
        </div>
      </div>
      <GoalPreview />
      <Modal open={healthHelp} title="Финансовое здоровье" onClose={() => setHealthHelp(false)}>
        <p>Пока нет данных для оценки. Здесь появятся рейтинг и рекомендации на основе Ваших операций.</p>
        <Link to="/analytics" className="button-primary" onClick={() => setHealthHelp(false)}>Посмотреть аналитику</Link>
      </Modal>
    </div>
  );
}
