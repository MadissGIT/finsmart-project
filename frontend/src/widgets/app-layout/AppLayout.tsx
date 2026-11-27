import { Outlet, useLocation } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';

export function AppLayout() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const transactions = location.pathname === '/transactions';
  const detail = transactions && params.has('transaction');
  const offer = location.pathname === '/discounts' && (params.has('offer') || params.get('view') === 'offers');
  const moreHome = location.pathname === '/more' || location.pathname === '/more/';
  const more = moreHome || location.pathname.startsWith('/more/');
  const profile = /^\/more\/profile(?:\/|$)/.test(location.pathname);
  const article = location.pathname.startsWith('/more/knowledge/');
  const goalDetail = /^\/goals\/[^/]+/.test(location.pathname);
  const className = [
    transactions && 'transactions-layout',
    detail && 'transactions-detail-layout',
    offer && 'offer-layout',
    more && 'more-layout',
    moreHome && 'more-home-layout',
    profile && 'profile-layout',
    article && 'knowledge-article-layout',
    goalDetail && 'goal-detail-layout',
  ].filter(Boolean).join(' ');
  return (
    <div className={className}>
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
