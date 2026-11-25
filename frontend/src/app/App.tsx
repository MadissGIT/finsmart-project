import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { OnboardingProvider } from '@/features/onboarding/OnboardingProvider';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { AppLayout } from '@/widgets/app-layout/AppLayout';
import { OnboardingLayout } from '@/widgets/onboarding/OnboardingLayout';
import { WelcomePage } from '@/pages/welcome/WelcomePage';
import { RegisterPage } from '@/pages/register/RegisterPage';
import { ProfileSetupPage } from '@/pages/register-profile/ProfileSetupPage';
import { RegistrationSuccessPage } from '@/pages/register-success/RegistrationSuccessPage';
import { InitialSetupPage } from '@/pages/initial-setup/InitialSetupPage';
import DashboardPage from '@/pages/dashboard/DashboardPage';
import { AuthPage } from '@/pages/auth/AuthPage';
import { MorePage } from '@/pages/more/MorePage';
import { AboutPage, FaqPage, SupportPage } from '@/pages/more/HelpPages';
import { NotFoundPage } from '@/pages/not-found/NotFoundPage';
import { RouteEffects } from './RouteEffects';

const ProfileRoutes = lazy(() => import('@/pages/profile/ProfileRoutes'));
const AnalyticsPage = lazy(() => import('@/pages/analytics/AnalyticsPage'));

const TransactionsPage = lazy(() => import('@/pages/transactions/TransactionsPage').then((module) => ({ default: module.TransactionsPage })));
const GoalsPage = lazy(() => import('@/pages/goals/GoalsPage').then((module) => ({ default: module.GoalsPage })));
const KnowledgePage = lazy(() => import('@/pages/more/KnowledgePage').then((module) => ({ default: module.KnowledgePage })));
const ArticlePage = lazy(() => import('@/pages/more/ArticlePage').then((module) => ({ default: module.ArticlePage })));
const DiscountsPage = lazy(() => import('@/pages/discounts/DiscountsPage').then((module) => ({ default: module.DiscountsPage })));

export function App() {
  return (
    <AuthProvider><OnboardingProvider>
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
              <Route path="goals/:goalId" element={<GoalsPage />} />
              <Route path="discounts" element={<DiscountsPage />} />
              <Route path="more" element={<MorePage />} />
              <Route path="more/knowledge" element={<KnowledgePage />} />
              <Route path="more/knowledge/:articleId" element={<ArticlePage />} />
              <Route path="more/faq" element={<FaqPage />} />
              <Route path="more/support" element={<SupportPage />} />
              <Route path="more/about" element={<AboutPage />} />
              <Route path="more/profile/*" element={<ProfileRoutes />} />
              <Route path="auth" element={<AuthPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </OnboardingProvider></AuthProvider>
  );
}
