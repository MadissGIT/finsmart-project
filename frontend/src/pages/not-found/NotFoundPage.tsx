import { Link } from 'react-router-dom';
import { PageHeading } from '@/shared/ui/PageHeading';

export function NotFoundPage() {
  return (
    <>
      <PageHeading title="Страница не найдена" description="Возможно, в адресе опечатка или страница была перемещена." />
      <Link to="/" className="button-primary">Вернуться к обзору</Link>
    </>
  );
}
