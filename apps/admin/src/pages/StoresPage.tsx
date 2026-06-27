import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { Spinner, ErrorText, Pill, Modal, Field } from '../components/ui';
import { Offer, Paginated, Store } from '../api/types';

export function StoresPage() {
  const { t } = useTranslation();
  const { request } = useAuth();
  const [stores, setStores] = useState<Store[] | null>(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<Store | null>(null);

  const load = useCallback(() => {
    request<Paginated<Store>>('/admin/stores?pageSize=100')
      .then((r) => setStores(r.data))
      .catch((e) => setError((e as Error).message));
  }, [request]);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (id: string) => {
    if (!confirm('Delete store?')) return;
    await request(`/admin/stores/${id}`, { method: 'DELETE' }).catch((e) => alert((e as Error).message));
    if (selected?.id === id) setSelected(null);
    load();
  };

  const expireNow = async () => {
    const r = await request<{ expired: number }>('/admin/offers/expire-now', { method: 'POST' });
    alert(`Expired: ${r.expired}`);
  };

  if (error) return <ErrorText message={error} />;

  return (
    <div>
      <h1 className="page-title">{t('stores.title')}</h1>
      <div className="row" style={{ marginBottom: 16 }}>
        <button className="btn" onClick={() => setCreating(true)}>
          {t('stores.create')}
        </button>
        <button className="btn secondary" onClick={expireNow}>
          {t('stores.expireNow')}
        </button>
      </div>

      {!stores ? (
        <Spinner />
      ) : stores.length === 0 ? (
        <p className="muted">{t('stores.noStores')}</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>{t('stores.nameEn')}</th>
              <th>{t('common.status')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {stores.map((s) => (
              <tr key={s.id}>
                <td>{s.nameEn} / {s.nameEl}</td>
                <td><Pill kind={s.status === 'active' ? 'active' : 'muted'}>{s.status}</Pill></td>
                <td>
                  <div className="row">
                    <button className="btn sm" onClick={() => setSelected(s)}>
                      {t('stores.manageOffers')}
                    </button>
                    <button className="btn danger sm" onClick={() => remove(s.id)}>
                      {t('stores.delete')}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selected && <OffersPanel store={selected} onClose={() => setSelected(null)} />}
      {creating && (
        <CreateStoreModal
          onClose={() => setCreating(false)}
          onDone={() => {
            setCreating(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function CreateStoreModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation();
  const { request } = useAuth();
  const [f, setF] = useState({ nameEn: '', nameEl: '', descriptionEn: '', descriptionEl: '' });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: any) => setF({ ...f, [k]: e.target.value });

  const submit = async () => {
    setBusy(true);
    try {
      await request('/admin/stores', { method: 'POST', body: { ...f, status: 'active' } });
      onDone();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={t('stores.create')} onClose={onClose}>
      <Field label={t('stores.nameEn')}><input className="input" value={f.nameEn} onChange={set('nameEn')} /></Field>
      <Field label={t('stores.nameEl')}><input className="input" value={f.nameEl} onChange={set('nameEl')} /></Field>
      <Field label={t('stores.descEn')}><textarea className="input" rows={2} value={f.descriptionEn} onChange={set('descriptionEn')} /></Field>
      <Field label={t('stores.descEl')}><textarea className="input" rows={2} value={f.descriptionEl} onChange={set('descriptionEl')} /></Field>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn secondary" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn" disabled={busy} onClick={submit}>{t('common.create')}</button>
      </div>
    </Modal>
  );
}

function OffersPanel({ store, onClose }: { store: Store; onClose: () => void }) {
  const { t } = useTranslation();
  const { request } = useAuth();
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const empty = {
    titleEn: '', titleEl: '', descriptionEn: '', descriptionEl: '',
    discountType: 'percent', discountValue: '10', terms: '', expiryDate: '',
  };
  const [f, setF] = useState({ ...empty });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: any) => setF({ ...f, [k]: e.target.value });

  const load = useCallback(() => {
    request<Offer[]>(`/admin/stores/${store.id}/offers`).then(setOffers).catch(() => setOffers([]));
  }, [request, store.id]);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    setBusy(true);
    try {
      await request(`/admin/stores/${store.id}/offers`, {
        method: 'POST',
        body: {
          titleEn: f.titleEn, titleEl: f.titleEl,
          descriptionEn: f.descriptionEn, descriptionEl: f.descriptionEl,
          discountType: f.discountType,
          discountValue: Number(f.discountValue),
          terms: f.terms || undefined,
          expiryDate: f.expiryDate,
        },
      });
      setF({ ...empty });
      load();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    await request(`/admin/offers/${id}`, { method: 'DELETE' }).catch((e) => alert((e as Error).message));
    load();
  };

  return (
    <Modal title={`${t('stores.manageOffers')} — ${store.nameEn}`} onClose={onClose}>
      {!offers ? (
        <p className="muted">{t('common.loading')}</p>
      ) : offers.length === 0 ? (
        <p className="muted">{t('stores.noOffers')}</p>
      ) : (
        <table>
          <thead><tr><th>{t('stores.titleEn')}</th><th>{t('stores.discountValue')}</th><th>{t('common.status')}</th><th /></tr></thead>
          <tbody>
            {offers.map((o) => (
              <tr key={o.id}>
                <td>{o.titleEn}</td>
                <td>{o.discountType === 'percent' ? `${o.discountValue}%` : `€${o.discountValue}`}</td>
                <td><Pill kind={o.status === 'active' ? 'active' : 'muted'}>{o.status}</Pill></td>
                <td><button className="btn danger sm" onClick={() => remove(o.id)}>{t('stores.delete')}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="spacer-v" />
      <strong>{t('stores.newOffer')}</strong>
      <Field label={t('stores.titleEn')}><input className="input" value={f.titleEn} onChange={set('titleEn')} /></Field>
      <Field label={t('stores.titleEl')}><input className="input" value={f.titleEl} onChange={set('titleEl')} /></Field>
      <Field label={t('stores.descEn')}><input className="input" value={f.descriptionEn} onChange={set('descriptionEn')} /></Field>
      <Field label={t('stores.descEl')}><input className="input" value={f.descriptionEl} onChange={set('descriptionEl')} /></Field>
      <div className="row">
        <div style={{ flex: 1 }}>
          <Field label={t('stores.discountType')}>
            <select className="select" value={f.discountType} onChange={set('discountType')}>
              <option value="percent">{t('stores.percent')}</option>
              <option value="fixed">{t('stores.fixed')}</option>
            </select>
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label={t('stores.discountValue')}>
            <input className="input" type="number" value={f.discountValue} onChange={set('discountValue')} />
          </Field>
        </div>
      </div>
      <Field label={t('stores.terms')}><input className="input" value={f.terms} onChange={set('terms')} /></Field>
      <Field label={t('stores.expiry')}>
        <input className="input" type="date" value={f.expiryDate} onChange={set('expiryDate')} />
      </Field>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn" disabled={busy || !f.expiryDate} onClick={create}>{t('stores.newOffer')}</button>
      </div>
    </Modal>
  );
}
