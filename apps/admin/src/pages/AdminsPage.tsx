import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { Spinner, ErrorText, Pill, Field } from '../components/ui';
import { AdminView } from '../api/types';

export function AdminsPage() {
  const { t } = useTranslation();
  const { request, isRoot, admin } = useAuth();
  const [admins, setAdmins] = useState<AdminView[] | null>(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ email: '', password: '', role: 'protoporia' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    request<AdminView[]>('/admins')
      .then(setAdmins)
      .catch((e) => setError((e as Error).message));
  }, [request]);

  useEffect(() => {
    if (isRoot) load();
  }, [isRoot, load]);

  if (!isRoot) return <ErrorText message="Root only" />;

  const set = (k: keyof typeof form) => (e: any) => setForm({ ...form, [k]: e.target.value });

  const create = async () => {
    setBusy(true);
    try {
      await request('/admins', { method: 'POST', body: form });
      setForm({ email: '', password: '', role: 'protoporia' });
      load();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (a: AdminView) => {
    const action = a.disabledAt ? 'enable' : 'disable';
    await request(`/admins/${a.id}/${action}`, { method: 'PATCH' }).catch((e) => alert((e as Error).message));
    load();
  };

  if (error) return <ErrorText message={error} />;

  return (
    <div>
      <h1 className="page-title">{t('admins.title')}</h1>

      <div className="card" style={{ marginBottom: 16 }}>
        <strong>{t('admins.create')}</strong>
        <div className="row" style={{ marginTop: 10, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <Field label={t('admins.email')}><input className="input" value={form.email} onChange={set('email')} /></Field>
          </div>
          <div style={{ flex: 1 }}>
            <Field label={t('admins.password')}><input className="input" type="password" value={form.password} onChange={set('password')} /></Field>
          </div>
          <div style={{ width: 150 }}>
            <Field label={t('admins.role')}>
              <select className="select" value={form.role} onChange={set('role')}>
                <option value="protoporia">protoporia</option>
                <option value="root">root</option>
              </select>
            </Field>
          </div>
          <button className="btn" disabled={busy || !form.email || form.password.length < 12} onClick={create}>
            {t('common.create')}
          </button>
        </div>
      </div>

      {!admins ? (
        <Spinner />
      ) : (
        <table>
          <thead>
            <tr>
              <th>{t('admins.email')}</th>
              <th>{t('admins.role')}</th>
              <th>{t('admins.totp')}</th>
              <th>{t('common.status')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {admins.map((a) => (
              <tr key={a.id}>
                <td>{a.email}</td>
                <td>{a.role}</td>
                <td>{a.totpEnabled ? t('admins.enabled') : t('admins.notEnabled')}</td>
                <td>
                  {a.disabledAt ? (
                    <Pill kind="deactive">{t('admins.disabled')}</Pill>
                  ) : (
                    <Pill kind="active">{t('dashboard.active')}</Pill>
                  )}
                </td>
                <td>
                  {a.id !== admin?.id && (
                    <button className={`btn sm ${a.disabledAt ? '' : 'danger'}`} onClick={() => toggle(a)}>
                      {a.disabledAt ? t('admins.enable') : t('admins.disable')}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
