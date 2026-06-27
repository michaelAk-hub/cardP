import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { Field } from '../components/ui';

type Phase = 'credentials' | 'code' | 'enroll';
interface EnrolData {
  enrollmentToken: string;
  qrDataUrl: string;
  otpauthUrl: string;
}

export function LoginPage() {
  const { t } = useTranslation();
  const { login, verifyEnrollment } = useAuth();
  const [phase, setPhase] = useState<Phase>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [enrol, setEnrol] = useState<EnrolData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const run = async (fn: () => Promise<unknown>) => {
    setError('');
    setLoading(true);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const submitCredentials = () =>
    run(async () => {
      const res = await login(email.trim(), password);
      if (res.kind === 'needCode') setPhase('code');
      else if (res.kind === 'enroll') {
        setEnrol(res);
        setPhase('enroll');
      }
      // 'authenticated' -> the auth state flips and the router redirects.
    });

  const submitCode = () => run(() => login(email.trim(), password, code.trim()));
  const submitEnrol = () =>
    run(() => verifyEnrollment(enrol!.enrollmentToken, code.trim()));

  const secret = enrol ? new URL(enrol.otpauthUrl).searchParams.get('secret') : null;

  return (
    <div className="center">
      <div className="card" style={{ width: 360 }}>
        <h2 style={{ marginTop: 0 }}>{t('login.title')}</h2>

        {phase === 'credentials' && (
          <>
            <Field label={t('login.email')}>
              <input
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
              />
            </Field>
            <Field label={t('login.password')}>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </Field>
            <button className="btn" disabled={loading} onClick={submitCredentials}>
              {t('login.signIn')}
            </button>
          </>
        )}

        {phase === 'enroll' && enrol && (
          <>
            <h3>{t('login.enrolTitle')}</h3>
            <p className="muted">{t('login.enrolHint')}</p>
            <img src={enrol.qrDataUrl} alt="TOTP QR" style={{ width: 200, height: 200 }} />
            {secret && (
              <p className="muted" style={{ fontSize: 12, wordBreak: 'break-all' }}>
                {t('login.secret')}: <code>{secret}</code>
              </p>
            )}
            <Field label={t('login.totpCode')}>
              <input className="input" value={code} onChange={(e) => setCode(e.target.value)} />
            </Field>
            <button className="btn" disabled={loading} onClick={submitEnrol}>
              {t('login.verify')}
            </button>
          </>
        )}

        {phase === 'code' && (
          <>
            <Field label={t('login.totpCode')}>
              <input className="input" value={code} onChange={(e) => setCode(e.target.value)} />
            </Field>
            <button className="btn" disabled={loading} onClick={submitCode}>
              {t('login.verify')}
            </button>
          </>
        )}

        {!!error && <p className="error-text">{error}</p>}
      </div>
    </div>
  );
}
