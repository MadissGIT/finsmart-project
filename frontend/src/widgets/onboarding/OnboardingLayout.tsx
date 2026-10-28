import { Outlet } from 'react-router-dom';

export function OnboardingLayout() {
  return (
    <div className="onboarding-background">
      <main className="onboarding-screen" id="main-content">
        <Outlet />
        <p className="demo-note">Демо-версия · аккаунт на сервере не создаётся</p>
      </main>
    </div>
  );
}
