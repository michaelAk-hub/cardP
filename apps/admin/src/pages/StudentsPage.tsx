import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { Spinner, ErrorText, Pill, Bool, Modal, Field } from '../components/ui';
import { IdDocumentLinks, Paginated, StudentRow } from '../api/types';

const PAGE_SIZE = 20;

export function StudentsPage() {
  const { t } = useTranslation();
  const { request } = useAuth();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<StudentRow> | null>(null);
  const [error, setError] = useState('');
  const [reviewing, setReviewing] = useState<StudentRow | null>(null);
  const [deactivating, setDeactivating] = useState<StudentRow | null>(null);

  const load = useCallback(() => {
    setError('');
    const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (status) qs.set('status', status);
    if (search.trim()) qs.set('search', search.trim());
    request<Paginated<StudentRow>>(`/admin/students?${qs.toString()}`)
      .then(setData)
      .catch((e) => setError((e as Error).message));
  }, [request, status, search, page]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (path: string, method = 'POST', body?: unknown) => {
    try {
      await request(path, { method, body });
      load();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  if (error) return <ErrorText message={error} />;

  return (
    <div>
      <h1 className="page-title">{t('students.title')}</h1>

      <div className="row" style={{ marginBottom: 16 }}>
        <select
          className="select"
          style={{ width: 160 }}
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
        >
          <option value="">{t('common.all')}</option>
          <option value="pending">{t('dashboard.pending')}</option>
          <option value="active">{t('dashboard.active')}</option>
          <option value="deactive">{t('dashboard.deactive')}</option>
        </select>
        <input
          className="input"
          style={{ maxWidth: 260 }}
          placeholder={t('students.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (setPage(1), load())}
        />
        <button className="btn sm" onClick={() => (setPage(1), load())}>
          {t('common.search')}
        </button>
      </div>

      {!data ? (
        <Spinner />
      ) : (
        <>
          <table>
            <thead>
              <tr>
                <th>{t('students.email')}</th>
                <th>{t('students.phone')}</th>
                <th>{t('students.status')}</th>
                <th>{t('students.card')}</th>
                <th>{t('students.emailV')}</th>
                <th>{t('students.phoneV')}</th>
                <th>{t('students.idV')}</th>
                <th>{t('students.tamper')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((s) => (
                <tr key={s.id}>
                  <td>{s.email}</td>
                  <td>{s.phone}</td>
                  <td>
                    <Pill kind={s.accountStatus}>{t(`dashboard.${s.accountStatus}`)}</Pill>
                  </td>
                  <td>{s.cardSerial ?? t('common.none')}</td>
                  <td><Bool value={s.emailVerified} /></td>
                  <td><Bool value={s.phoneVerified} /></td>
                  <td><Bool value={s.idVerified} /></td>
                  <td>
                    {s.idDocument?.tamperStatus ? (
                      <Pill kind={s.idDocument.tamperStatus}>{s.idDocument.tamperStatus}</Pill>
                    ) : (
                      t('common.none')
                    )}
                  </td>
                  <td>
                    <div className="row">
                      <button className="btn sm" onClick={() => setReviewing(s)}>
                        {t('students.review')}
                      </button>
                      <button
                        className="btn secondary sm"
                        onClick={() => act(`/admin/students/${s.id}/send-recovery`)}
                      >
                        {t('students.recovery')}
                      </button>
                      <button
                        className="btn secondary sm"
                        onClick={() => act(`/admin/students/${s.id}/recreate-card-serial`)}
                      >
                        {t('students.recreate')}
                      </button>
                      {s.accountStatus === 'deactive' ? (
                        <button
                          className="btn sm"
                          onClick={() => act(`/admin/students/${s.id}/reactivate`)}
                        >
                          {t('students.reactivate')}
                        </button>
                      ) : (
                        <button className="btn danger sm" onClick={() => setDeactivating(s)}>
                          {t('students.deactivate')}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="row" style={{ marginTop: 14 }}>
            <button
              className="btn secondary sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              {t('students.prev')}
            </button>
            <span className="muted">
              {page} / {Math.max(1, Math.ceil(data.total / PAGE_SIZE))} ({data.total})
            </span>
            <button
              className="btn secondary sm"
              disabled={page >= Math.ceil(data.total / PAGE_SIZE)}
              onClick={() => setPage((p) => p + 1)}
            >
              {t('students.next')}
            </button>
          </div>
        </>
      )}

      {reviewing && (
        <ReviewModal
          student={reviewing}
          onClose={() => setReviewing(null)}
          onDone={() => {
            setReviewing(null);
            load();
          }}
        />
      )}
      {deactivating && (
        <DeactivateModal
          student={deactivating}
          onClose={() => setDeactivating(null)}
          onDone={() => {
            setDeactivating(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function PhotoView({ url }: { url: string }) {
  const { requestBlob } = useAuth();
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    const authed = url.includes('/id-photo/');
    if (authed) {
      const path = (url.startsWith('http') ? new URL(url).pathname : url).replace(/^\/api/, '');
      requestBlob(path)
        .then((b) => {
          objectUrl = URL.createObjectURL(b);
          setSrc(objectUrl);
        })
        .catch(() => setSrc(null));
    } else {
      setSrc(url); // presigned URL — usable directly
    }
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url, requestBlob]);

  if (!src) return <div className="muted">…</div>;
  return <img src={src} alt="ID" style={{ width: '100%', borderRadius: 8 }} />;
}

function ReviewModal({
  student,
  onClose,
  onDone,
}: {
  student: StudentRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const { request } = useAuth();
  const [doc, setDoc] = useState<IdDocumentLinks | null>(null);
  const [noDoc, setNoDoc] = useState(false);
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    request<IdDocumentLinks>(`/admin/students/${student.id}/id-document`)
      .then(setDoc)
      .catch(() => setNoDoc(true));
  }, [request, student.id]);

  const decide = async (decision: 'approved' | 'rejected') => {
    setBusy(true);
    try {
      await request(`/admin/students/${student.id}/id-review`, {
        method: 'POST',
        body: decision === 'approved' ? { decision } : { decision, reason, description },
      });
      onDone();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`${t('students.reviewTitle')} — ${student.email}`} onClose={onClose}>
      {noDoc ? (
        <p className="muted">{t('students.noDoc')}</p>
      ) : !doc ? (
        <p className="muted">{t('common.loading')}</p>
      ) : (
        <>
          <div className="row">
            {doc.tamperStatus && <Pill kind={doc.tamperStatus}>{doc.tamperStatus} ({doc.tamperScore})</Pill>}
          </div>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 10 }}>
            <div>
              <div className="muted">{t('students.front')}</div>
              <PhotoView url={doc.front} />
            </div>
            <div>
              <div className="muted">{t('students.back')}</div>
              <PhotoView url={doc.back} />
            </div>
          </div>

          <div className="spacer-v" />
          <Field label={t('students.rejectReason')}>
            <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <Field label={t('students.rejectDescription')}>
            <textarea
              className="input"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>

          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn secondary" onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button
              className="btn danger"
              disabled={busy || !reason.trim() || !description.trim()}
              onClick={() => decide('rejected')}
            >
              {t('students.reject')}
            </button>
            <button className="btn" disabled={busy} onClick={() => decide('approved')}>
              {t('students.approve')}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

function DeactivateModal({
  student,
  onClose,
  onDone,
}: {
  student: StudentRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const { request } = useAuth();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await request(`/admin/students/${student.id}/deactivate`, {
        method: 'POST',
        body: { reason },
      });
      onDone();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`${t('students.reasonTitle')} — ${student.email}`} onClose={onClose}>
      <Field label={t('students.reason')}>
        <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn secondary" onClick={onClose}>
          {t('common.cancel')}
        </button>
        <button className="btn danger" disabled={busy || !reason.trim()} onClick={submit}>
          {t('students.deactivate')}
        </button>
      </div>
    </Modal>
  );
}
