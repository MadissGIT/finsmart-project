import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AppLayout } from '@/widgets/app-layout/AppLayout';
import { TransactionsPage } from '@/pages/transactions/TransactionsPage';
import { GoalsPage } from '@/pages/goals/GoalsPage';
import { AuthPage } from '@/pages/auth/AuthPage';
import { NotFoundPage } from '@/pages/not-found/NotFoundPage';
import { RouteEffects } from './RouteEffects';

const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'));
const AnalyticsPage = lazy(() => import('@/pages/analytics/AnalyticsPage'));

export function App() {
  return (
    <BrowserRouter>
      <RouteEffects />
      <Suspense fallback={<p className="p-8" role="status">Загружаем страницу…</p>}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="transactions" element={<TransactionsPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="goals" element={<GoalsPage />} />
            <Route path="auth" element={<AuthPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
