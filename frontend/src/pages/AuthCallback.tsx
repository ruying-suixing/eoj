import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { t } from '../i18n';

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setToken, fetchUser } = useAuthStore();
  const [error, setError] = useState(false);

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      setToken(token);
      fetchUser()
        .then(() => {
          navigate('/', { replace: true });
        })
        .catch(() => {
          setError(true);
        });
    } else {
      setError(true);
    }
  }, [searchParams]);

  if (error) {
    return (
      <div className="loading">
        <p>{t('authCallback.authFailed')}</p>
        <Link to="/login">{t('authCallback.backToLogin')}</Link>
      </div>
    );
  }

  return <div className="loading">{t('authCallback.authenticating')}</div>;
}
