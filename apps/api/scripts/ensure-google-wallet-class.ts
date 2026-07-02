import { readFileSync } from 'node:fs';
import * as jwt from 'jsonwebtoken';

// One-time, idempotent: ensures the Generic pass class exists on your Google
// Wallet issuer (id = `${ISSUER_ID}.${CLASS_SUFFIX}`). Safe to re-run.
//
//   GOOGLE_WALLET_ISSUER_ID=33880000000xxxxxxxx \
//   GOOGLE_WALLET_SERVICE_ACCOUNT_PATH=/secrets/google-wallet-sa.json \
//   npm run ensure:google-wallet-class -w @blue-card/api
//
// Must run where api.googleapis.com is reachable (your machine / the VPS).
const WALLET_API = 'https://walletobjects.googleapis.com/walletobjects/v1';
const SCOPE = 'https://www.googleapis.com/auth/wallet_object.issuer';

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

async function accessToken(sa: ServiceAccount): Promise<string> {
  const assertion = jwt.sign(
    { scope: SCOPE, aud: 'https://oauth2.googleapis.com/token' },
    sa.private_key,
    { algorithm: 'RS256', issuer: sa.client_email, expiresIn: '1h' },
  );
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const data = (await res.json()) as { access_token?: string; error_description?: string };
  if (!res.ok || !data.access_token) {
    throw new Error(`Token request failed: ${data.error_description ?? res.status}`);
  }
  return data.access_token;
}

async function main(): Promise<void> {
  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID;
  const saPath = process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_PATH;
  const suffix = process.env.GOOGLE_WALLET_CLASS_SUFFIX ?? 'bluecard_student';
  if (!issuerId || !saPath) {
    throw new Error('Set GOOGLE_WALLET_ISSUER_ID and GOOGLE_WALLET_SERVICE_ACCOUNT_PATH');
  }

  const sa = JSON.parse(readFileSync(saPath, 'utf8')) as ServiceAccount;
  const token = await accessToken(sa);
  const auth = { authorization: `Bearer ${token}` };
  const classId = `${issuerId}.${suffix}`;

  const existing = await fetch(`${WALLET_API}/genericClass/${classId}`, { headers: auth });
  if (existing.ok) {
    console.log(`Generic class ${classId} already exists — nothing to do.`);
    return;
  }
  if (existing.status !== 404) {
    throw new Error(`Unexpected status checking class: ${existing.status}`);
  }

  const created = await fetch(`${WALLET_API}/genericClass`, {
    method: 'POST',
    headers: { ...auth, 'content-type': 'application/json' },
    body: JSON.stringify({ id: classId }),
  });
  if (!created.ok) {
    throw new Error(`Failed to create class: ${created.status} ${await created.text()}`);
  }
  console.log(`Created Generic class ${classId}.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
