import { useState } from 'react';
import type { ReactNode } from 'react';
import { Bell, ChevronRight, Languages, ScanFace, ShieldCheck, Sun, UserRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { version } from '../../../package.json';
import { useAuth } from '@/features/auth/model/context';
import { useOnboarding } from '@/features/onboarding/model/context';
import { settingsPath } from '@/pages/profile/paths';
import { isRecord } from '@/shared/lib/guards';
import { Modal } from '@/shared/ui/Modal';
import { MoreHeading } from './MoreUi';
import './more-settings.css';

const storageKey = 'finsmart.app-settings-preview.v1';
const initialPreferences = { notifications: true, biometrics: false };
type Preference = keyof typeof initialPreferences;

function readPreferences(): typeof initialPreferences {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
    if (isRecord(saved)) {
      return {
        notifications: typeof saved.notifications === 'boolean' ? saved.notifications : initialPreferences.notifications,
        biometrics: typeof saved.biometrics === 'boolean' ? saved.biometrics : initialPreferences.biometrics,
      };
    }
  } catch { /* В приватном режиме можно использовать значения по умолчанию. */ }
  return initialPreferences;
}

const details = {
  theme: {
    title: 'Тема оформления',
    text: 'В этой версии доступна светлая тема.',
  },
  language: {
    title: 'Язык приложения',
    text: 'В этой версии доступен русский язык.',
  },
  privacy: {
    title: 'Конфиденциальность',
    text: 'Имя, дату рождения, цель и диапазон дохода можно посмотреть в разделе «Личные данные».',
  },
  policy: {
    title: 'Политика конфиденциальности',
    text: 'ФинСмарт — учебный сервис. Данные аккаунта и записи об операциях хранятся на сервере. Пароль хранится в виде хеша. В браузере сохраняются токены текущего входа и настройки интерфейса.',
  },
};

function SettingContent({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <>
      <span className="more-menu-icon"><Icon size={21} strokeWidth={1.65} aria-hidden="true" /></span>
      <span>{title}</span>
      <span className="more-setting-value">{children}</span>
    </>
  );
}

export function MoreSettingsPage() {
  const [preferences, setPreferences] = useState(readPreferences);
  const [notice, setNotice] = useState('');
  const [detail, setDetail] = useState<keyof typeof details | null>(null);
  const { status, signOut } = useAuth();
  const { resetSession } = useOnboarding();
  const navigate = useNavigate();
  const modal = detail ? details[detail] : null;

  function setPreference(key: Preference, checked: boolean) {
    const next = { ...preferences, [key]: checked };
    setPreferences(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); }
    catch { /* Переключатель продолжает работать в открытом приложении. */ }
    setNotice(key === 'notifications'
      ? 'Предпросмотр настройки уведомлений. Колокольчик работает как обычно.'
      : 'Предпросмотр настройки биометрии. Биометрический вход пока недоступен.');
  }

  function leaveAccount() {
    signOut();
    resetSession();
    navigate('/welcome', { replace: true });
  }

  return (
    <div className="more-page more-settings">
      <MoreHeading title="Настройки" back="/more" />
      <div className="more-settings-list">
        <label className="more-setting-row">
          <SettingContent icon={Bell} title="Уведомления">
            <input type="checkbox" role="switch" className="more-setting-switch" checked={preferences.notifications}
              onChange={(event) => setPreference('notifications', event.target.checked)} />
          </SettingContent>
        </label>
        <button type="button" className="more-setting-row" onClick={() => setDetail('theme')}>
          <SettingContent icon={Sun} title="Тема оформления">Светлая <ChevronRight size={15} aria-hidden="true" /></SettingContent>
        </button>
        <button type="button" className="more-setting-row" onClick={() => setDetail('language')}>
          <SettingContent icon={Languages} title="Язык приложения">Русский <ChevronRight size={15} aria-hidden="true" /></SettingContent>
        </button>
        <label className="more-setting-row">
          <SettingContent icon={ScanFace} title="Биометрия">
            <input type="checkbox" role="switch" className="more-setting-switch" checked={preferences.biometrics}
              onChange={(event) => setPreference('biometrics', event.target.checked)} />
          </SettingContent>
        </label>
        <Link className="more-setting-row" to={settingsPath} state={{ from: '/more/settings' }}>
          <SettingContent icon={UserRound} title="Личные данные"><ChevronRight size={15} aria-hidden="true" /></SettingContent>
        </Link>
        <button type="button" className="more-setting-row" onClick={() => setDetail('privacy')}>
          <SettingContent icon={ShieldCheck} title="Конфиденциальность"><ChevronRight size={15} aria-hidden="true" /></SettingContent>
        </button>
      </div>
      {notice && <p className="more-setting-notice" role="status">{notice}</p>}
      <div className="more-settings-footer">
        <Link className="more-settings-about" to="/more/about">
          <span>О приложении</span><small>Версия {version}</small>
        </Link>
        <button type="button" className="more-settings-policy" onClick={() => setDetail('policy')}>Политика конфиденциальности</button>
        {status === 'anonymous'
          ? <Link className="more-settings-account" to="/auth?next=/more/settings">Войти в аккаунт</Link>
          : <button type="button" className="more-settings-account" onClick={leaveAccount}>Выйти из аккаунта</button>}
      </div>
      <Modal open={modal !== null} title={modal?.title ?? 'Настройки'} onClose={() => setDetail(null)}>
        {modal && <p>{modal.text}</p>}
      </Modal>
    </div>
  );
}
