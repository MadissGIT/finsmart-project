import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';

export function AppLayout() {
  return (
    <>
      <a href="#main-content" className="sr-only fixed left-4 top-3 z-50 rounded-lg bg-brand-700 px-4 py-3 text-white focus:not-sr-only">К содержимому</a>
      <Sidebar />
      <div className="min-h-dvh md:pl-60">
        <Header />
        <main id="main-content" tabIndex={-1} className="app-content"><Outlet /></main>
      </div>
      <MobileNav />
    </>
  );
}
