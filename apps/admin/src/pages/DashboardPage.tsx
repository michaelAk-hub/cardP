import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { Spinner, ErrorText } from '../components/ui';
import { AnalyticsSummary } from '../api/types';

interface Signup {
  day: string;
  count: number;
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}

export function DashboardPage() {
  const { t } = useTranslation();
  const { request } = useAuth();
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [signups, setSignups] = useState<Signup[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      request<AnalyticsSummary>('/admin/analytics/summary'),
      request<Signup[]>('/admin/analytics/signups?days=30'),
    ])
      .then(([s, sg]) => {
        setSummary(s);
        setSignups(sg);
      })
      .catch((e) => setError((e as Error).message));
  }, [request]);

  if (error) return <ErrorText message={error} />;
  if (!summary) return <Spinner />;

  const max = Math.max(1, ...signups.map((s) => s.count));

  return (
    <div>
      <h1 className="page-title">{t('dashboard.title')}</h1>

      <div className="grid stats">
        <Stat label={t('dashboard.students')} value={summary.students.total} />
        <Stat label={t('dashboard.active')} value={summary.students.active} />
        <Stat label={t('dashboard.pending')} value={summary.students.pending} />
        <Stat label={t('dashboard.deactive')} value={summary.students.deactive} />
        <Stat label={t('dashboard.activeOffers')} value={summary.offers.active} />
        <Stat label={t('dashboard.stores')} value={summary.stores.total} />
      </div>

      <div className="spacer-v" />
      <div className="card">
        <strong>{t('dashboard.signups')}</strong>
        {signups.length === 0 ? (
          <p className="muted">{t('common.none')}</p>
        ) : (
          <div className="chart">
            {signups.map((s) => (
              <div
                key={s.day}
                className="bar"
                style={{ height: `${(s.count / max) * 100}%` }}
                title={`${s.day}: ${s.count}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
