import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { Spinner, ErrorText, Field } from '../components/ui';
import { Campaign } from '../api/types';

interface Preview {
  matching: number;
  consenting: number;
  skippedOptout: number;
}

export function AdvertisingPage() {
  const { t } = useTranslation();
  const { request } = useAuth();
  const [status, setStatus] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [channel, setChannel] = useState<'email' | 'sms'>('email');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [error, setError] = useState('');

  const audience = () => ({ audience: status ? { status } : {} });

  const loadCampaigns = useCallback(() => {
    request<Campaign[]>('/admin/campaigns')
      .then(setCampaigns)
      .catch((e) => setError((e as Error).message));
  }, [request]);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  const doPreview = async () => {
    try {
      setPreview(await request<Preview>('/admin/campaigns/preview', { method: 'POST', body: audience() }));
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const send = async () => {
    setBusy(true);
    try {
      await request('/admin/campaigns', {
        method: 'POST',
        body: {
          channel,
          subject: channel === 'email' ? subject : undefined,
          body,
          ...audience(),
        },
      });
      setSubject('');
      setBody('');
      loadCampaigns();
      alert('Campaign created');
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (error) return <ErrorText message={error} />;

  return (
    <div>
      <h1 className="page-title">{t('advertising.title')}</h1>

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="card">
          <strong>{t('advertising.audience')}</strong>
          <Field label={t('advertising.status')}>
            <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">{t('common.all')}</option>
              <option value="pending">{t('dashboard.pending')}</option>
              <option value="active">{t('dashboard.active')}</option>
              <option value="deactive">{t('dashboard.deactive')}</option>
            </select>
          </Field>
          <button className="btn secondary" onClick={doPreview}>
            {t('advertising.preview')}
          </button>
          {preview && (
            <p className="muted" style={{ marginTop: 10 }}>
              {t('advertising.matching')}: {preview.matching} · {t('advertising.consenting')}:{' '}
              {preview.consenting} · {t('advertising.skipped')}: {preview.skippedOptout}
            </p>
          )}
        </div>

        <div className="card">
          <strong>{t('advertising.channel')}</strong>
          <Field label={t('advertising.channel')}>
            <select className="select" value={channel} onChange={(e) => setChannel(e.target.value as any)}>
              <option value="email">{t('advertising.email')}</option>
              <option value="sms">{t('advertising.sms')}</option>
            </select>
          </Field>
          {channel === 'email' && (
            <Field label={t('advertising.subject')}>
              <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </Field>
          )}
          <Field label={t('advertising.body')}>
            <textarea className="input" rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
          </Field>
          <button className="btn" disabled={busy || !body.trim()} onClick={send}>
            {t('advertising.send')}
          </button>
        </div>
      </div>

      <div className="spacer-v" />
      <strong>{t('advertising.campaigns')}</strong>
      {!campaigns ? (
        <Spinner />
      ) : (
        <table style={{ marginTop: 10 }}>
          <thead>
            <tr>
              <th>{t('advertising.channel')}</th>
              <th>{t('advertising.subject')}</th>
              <th>{t('advertising.recipients')}</th>
              <th>{t('advertising.sent')}</th>
              <th>{t('advertising.created')}</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id}>
                <td>{c.channel}</td>
                <td>{c.subject ?? t('common.none')}</td>
                <td>{c._count?.recipients ?? '—'}</td>
                <td>{c.sentAt ? '✓' : '…'}</td>
                <td>{c.createdAt.slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
