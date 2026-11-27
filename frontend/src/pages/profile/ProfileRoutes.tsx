import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/model/context';
import { MoreError, MoreHeading } from '@/pages/more/MoreUi';
import { NotFoundPage } from '@/pages/not-found/NotFoundPage';
import { AchievementsPage } from './AchievementsPage';
import { ChallengesPage } from './ChallengesPage';
import { ProfilePage } from './ProfilePage';
import { ProfileSettings } from './ProfileSettings';
import '@/pages/more/more.css';
import './profile.css';

export default function ProfileRoutes() {
  const auth = useAuth();
  const { pathname } = useLocation();

  if (auth.status === 'anonymous') {
    return <Navigate to={'/auth?next=' + encodeURIComponent(pathname.replace(/\/$/, ''))} replace />;
  }

  if (!auth.user) {
    return (
      <div className="more-page profile-page">
        <MoreHeading title="Профиль" back="/more" />
        {auth.error
          ? <MoreError error={auth.error} retry={auth.retryProfile} />
          : <p className="profile-note" role="status">Загружаем профиль…</p>}
      </div>
    );
  }

  return (
    <Routes key={auth.user.id}>
      <Route index element={<ProfilePage user={auth.user} />} />
      <Route path="achievements" element={<AchievementsPage />} />
      <Route path="achievements/statistics" element={<AchievementsPage statistics />} />
      <Route path="challenges" element={<ChallengesPage />} />
      <Route path="settings" element={<ProfileSettings user={auth.user} />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
