import { Link } from 'react-router-dom';
import { SearchX } from 'lucide-react';
import { t } from '../i18n';
import './NotFound.css';

export default function NotFound() {
  return (
    <div className="not-found">
      <SearchX size={48} className="not-found-icon" />
      <h1 className="not-found-code">404</h1>
      <h2 className="not-found-title">{t('notFound.title')}</h2>
      <p className="not-found-message">
        {t('notFound.description')}
      </p>
      <Link to="/" className="btn btn-primary">
        {t('notFound.backHome')}
      </Link>
    </div>
  );
}
