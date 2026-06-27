import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';

export function Layout() {
  const { t, i18n } = useTranslation();
  const { admin, isRoot, logout } = useAuth();

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">Blue Card</div>
        <NavLink to="/" end>{t('nav.dashboard')}</NavLink>
        <NavLink to="/students">{t('nav.students')}</NavLink>
        <NavLink to="/stores">{t('nav.stores')}</NavLink>
        <NavLink to="/advertising">{t('nav.advertising')}</NavLink>
        {isRoot && <NavLink to="/admins">{t('nav.admins')}</NavLink>}
        <div className="spacer" />
        <div className="me">{admin?.email}<br />({admin?.role})</div>
        <button
          className="btn secondary sm"
          onClick={() => i18n.changeLanguage(i18n.language === 'el' ? 'en' : 'el')}
        >
          {i18n.language === 'el' ? 'EN' : 'EL'}
        </button>
        <div className="spacer-v" />
        <button className="btn danger sm" onClick={logout}>{t('nav.logout')}</button>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
