import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { DemoSessionProvider } from '@/features/onboarding/DemoSessionProvider';
import { AppLayout } from '@/widgets/app-layout/AppLayout';
import { OnboardingLayout } from '@/widgets/onboarding/OnboardingLayout';
import { WelcomePage } from '@/pages/welcome/WelcomePage';
import { RegisterPage } from '@/pages/register/RegisterPage';
import { ProfileSetupPage } from '@/pages/register-profile/ProfileSetupPage';
import { RegistrationSuccessPage } from '@/pages/register-success/RegistrationSuccessPage';
import { InitialSetupPage } from '@/pages/initial-setup/InitialSetupPage';
import { TransactionsPage } from '@/pages/transactions/TransactionsPage';
import { GoalsPage } from '@/pages/goals/GoalsPage';
import { AuthPage } from '@/pages/auth/AuthPage';
import { MorePage } from '@/pages/more/MorePage';
import { DiscountsPage } from '@/pages/discounts/DiscountsPage';
import { NotFoundPage } from '@/pages/not-found/NotFoundPage';
import { RouteEffects } from './RouteEffects';

const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'));
const AnalyticsPage = lazy(() => import('@/pages/analytics/AnalyticsPage'));

export function App() {
  return (
    <DemoSessionProvider>
      <BrowserRouter>
        <RouteEffects />
        <Suspense fallback={<p className="p-8" role="status">Загружаем страницу…</p>}>
          <Routes>
            <Route element={<OnboardingLayout />}>
              <Route path="welcome" element={<WelcomePage />} />
              <Route path="register" element={<RegisterPage />} />
              <Route path="register/profile" element={<ProfileSetupPage />} />
              <Route path="register/success" element={<RegistrationSuccessPage />} />
              <Route path="setup" element={<InitialSetupPage />} />
            </Route>
            <Route element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="dashboard" element={<Navigate to="/" replace />} />
              <Route path="transactions" element={<TransactionsPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="goals" element={<GoalsPage />} />
              <Route path="discounts" element={<DiscountsPage />} />
              <Route path="more" element={<MorePage />} />
              <Route path="auth" element={<AuthPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </DemoSessionProvider>
  );
}
