import { Link } from 'react-router-dom';
import { Brand } from '@/shared/ui/Brand';

export function WelcomePage() {
  return (
    <div className="welcome-page">
      <h1 className="welcome-brand"><Brand large /></h1>
      <p className="welcome-tagline">Умные деньги —<br />большие цели</p>
      <p className="welcome-description">Анализируй расходы.<br />Экономь. Достигай.</p>
      <img className="welcome-illustration" src="/illustrations/wallet.png" width="260" height="195" alt="Кошелёк, банковская карта и монеты" />
      <div className="welcome-actions">
        <Link className="button-primary" to="/register">Создать аккаунт</Link>
        <Link className="button-secondary" to="/auth">Войти</Link>
      </div>
      <Link to="/" className="text-link welcome-demo-link">Перейти к обзору</Link>
    </div>
  );
}
