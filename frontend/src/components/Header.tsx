import { useState } from 'react';
import { NavLink, useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { useThemeStore } from '../store/theme';
import { useSettingsStore } from '../store/settings';
import { t } from '../i18n';
import { LogOut, User, Shield, Code2, ListChecks, Trophy, Target, Heart, Menu, X, Sun, Moon, Swords, Ticket, BookOpen, MessageSquare, Home, FolderOpen } from 'lucide-react';
import { usePermissions } from '../hooks/usePermissions';
import { useSiteConfig } from '../hooks/useSiteConfig';
import './Header.css';
export default function Header() {
  const { user, logout } = useAuthStore();
  const perms = usePermissions();
  const config = useSiteConfig();
  const { theme, toggleTheme } = useThemeStore();
  const getImageUploadEnabled = useSettingsStore((s) => s.getImageUploadEnabled);
  const getUploadEnabled = useSettingsStore((s) => s.getUploadEnabled);
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const showMyFiles = user && (getImageUploadEnabled() || getUploadEnabled() || perms.canManageUploads);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="header">
      <div className="header-inner">
        <NavLink to="/" className="header-logo">
          {config.site.icon === 'default' ? <Code2 size={24} /> : <img src={config.site.icon} alt={config.site.name} className="header-logo-img" />}
          <span>{config.site.name}</span>
        </NavLink>

        <nav className="header-nav">
          <div className="nav-links">
            <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              <Home size={16} />
              {t('nav.home')}
            </NavLink>
            <NavLink to="/problems" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              <Target size={16} />
              {t('nav.problems')}
            </NavLink>
            <NavLink to="/rankings" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              <Trophy size={16} />
              {t('nav.rankings')}
            </NavLink>
            <NavLink to="/contests" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              <Swords size={16} />
              {t('nav.contests')}
            </NavLink>
            <NavLink to="/lists" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              <BookOpen size={16} />
              {t('nav.lists')}
            </NavLink>
            <NavLink to="/discussions/all" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              <MessageSquare size={16} />
              {t('nav.discussions')}
            </NavLink>
            {user && (
              <NavLink to="/tickets" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                <Ticket size={16} />
                {t('nav.tickets')}
              </NavLink>
            )}
            {user && (
              <NavLink to="/submissions" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                <ListChecks size={16} />
                {t('nav.submissions')}
              </NavLink>
            )}
            {user && (
              <NavLink to="/favorites" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                <Heart size={16} />
                {t('nav.favorites')}
              </NavLink>
            )}
            {showMyFiles && (
              <NavLink to="/my-files" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                <FolderOpen size={16} />
                {t('common.myFiles')}
              </NavLink>
            )}
            {perms.hasAllPermissions && (
              <NavLink to="/admin" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                <Shield size={16} />
                {t('nav.admin')}
              </NavLink>
            )}
          </div>
        </nav>

        <button className="mobile-menu-btn" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        {mobileMenuOpen && (
          <div className="mobile-nav">
            <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} onClick={() => setMobileMenuOpen(false)}>
              <Home size={16} /> {t('nav.home')}
            </NavLink>
            <NavLink to="/problems" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} onClick={() => setMobileMenuOpen(false)}>
              <Target size={16} /> {t('nav.problems')}
            </NavLink>
            <NavLink to="/rankings" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} onClick={() => setMobileMenuOpen(false)}>
              <Trophy size={16} /> {t('nav.rankings')}
            </NavLink>
            <NavLink to="/contests" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} onClick={() => setMobileMenuOpen(false)}>
              <Swords size={16} /> {t('nav.contests')}
            </NavLink>
            <NavLink to="/lists" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} onClick={() => setMobileMenuOpen(false)}>
              <BookOpen size={16} /> {t('nav.lists')}
            </NavLink>
            <NavLink to="/discussions/all" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} onClick={() => setMobileMenuOpen(false)}>
              <MessageSquare size={16} /> {t('nav.discussions')}
            </NavLink>
            {user && (
              <NavLink to="/tickets" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} onClick={() => setMobileMenuOpen(false)}>
                <Ticket size={16} /> {t('nav.tickets')}
              </NavLink>
            )}
            {user && (
              <NavLink to="/submissions" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} onClick={() => setMobileMenuOpen(false)}>
                <ListChecks size={16} /> {t('nav.submissions')}
              </NavLink>
            )}
            {user && (
              <NavLink to="/favorites" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} onClick={() => setMobileMenuOpen(false)}>
                <Heart size={16} /> {t('nav.favorites')}
              </NavLink>
            )}
            {showMyFiles && (
              <NavLink to="/my-files" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} onClick={() => setMobileMenuOpen(false)}>
                <FolderOpen size={16} /> {t('common.myFiles')}
              </NavLink>
            )}
            {perms.hasAllPermissions && (
              <NavLink to="/admin" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} onClick={() => setMobileMenuOpen(false)}>
                <Shield size={16} /> {t('nav.admin')}
              </NavLink>
            )}
          </div>
        )}

        <div className="header-actions">
          <button
            className="theme-toggle-btn"
            onClick={toggleTheme}
            title={theme === 'dark' ? t('nav.lightMode') : t('nav.darkMode')}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          {user ? (
            <div className="user-menu">
              <Link to="/profile" className="user-info">
                {user.avatar_url && (
                  <img src={user.avatar_url} alt={user.username} className="user-avatar" />
                )}
                <span className="user-name">{user.username}</span>
              </Link>
              <button className="btn-icon" onClick={handleLogout} title={t('nav.logout')}>
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <Link to="/login" className="btn btn-primary btn-sm">
              <User size={16} />
              {t('nav.login')}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
