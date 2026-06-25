import { useTranslation } from 'react-i18next';

export default function App() {
  const { t, i18n } = useTranslation();

  return (
    <main style={{ fontFamily: 'system-ui', padding: '2rem' }}>
      <h1>{t('app.title')}</h1>
      <p>{t('foundation.ready')}</p>
      <nav style={{ display: 'flex', gap: '1rem', margin: '1rem 0' }}>
        <span>{t('nav.dashboard')}</span>
        <span>{t('nav.students')}</span>
        <span>{t('nav.advertising')}</span>
        <span>{t('nav.stores')}</span>
        <span>{t('nav.admins')}</span>
      </nav>
      <button onClick={() => i18n.changeLanguage(i18n.language === 'el' ? 'en' : 'el')}>
        {i18n.language === 'el' ? 'EN' : 'EL'}
      </button>
    </main>
  );
}
