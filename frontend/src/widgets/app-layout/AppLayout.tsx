import { Outlet, useLocation } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';

export function AppLayout() {
  const location = useLocation();
  const transactions = location.pathname === '/transactions';
  const detail = transactions && new URLSearchParams(location.search).has('transaction');
  return (
    <div className={transactions ? 'transactions-layout' + (detail ? ' transactions-detail-layout' : '') : undefined}>
      <a href="#main-content" className="sr-only fixed left-4 top-3 z-50 rounded-lg bg-brand-700 px-4 py-3 text-white focus:not-sr-only">К содержимому</a>
      <Sidebar />
      <div className="app-body min-h-dvh md:pl-60">
        <Header />
        <main id="main-content" tabIndex={-1} className="app-content"><Outlet /></main>
      </div>
      <MobileNav />
    </div>
  );
}
