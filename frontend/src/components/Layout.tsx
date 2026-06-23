import type { ReactNode } from 'react';
import { useEffect } from 'react';
import Header from './Header';
import Toast from './Toast';
import { useThemeStore } from '../store/theme';
import { useSettingsStore } from '../store/settings';
import { useSiteConfig } from '../hooks/useSiteConfig';
import './Layout.css';

export default function Layout({ children }: { children: ReactNode }) {
  const { theme } = useThemeStore();
  const config = useSiteConfig();
  const fetchSettings = useSettingsStore((s) => s.fetchSettings);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return (
    <div className="layout">
      <Header />
      <main className="main-content">
        {children}
      </main>
      {config.footer.enabled && (
        <footer className="site-footer">
          <div className="footer-inner">
            {config.footer.text && (
              <div className="footer-text" dangerouslySetInnerHTML={{ __html: config.footer.text }} />
            )}
            {!config.footer.text && (
              <div className="footer-text">
                &copy; {new Date().getFullYear()} {config.site.name}
              </div>
            )}
            {config.footer.links.length > 0 && (
              <div className="footer-links">
                {config.footer.links.map((link, i) => (
                  <a key={i} href={link.url} target="_blank" rel="noopener noreferrer">
                    {link.name}
                  </a>
                ))}
              </div>
            )}
          </div>
        </footer>
      )}
      <Toast />
    </div>
  );
}
