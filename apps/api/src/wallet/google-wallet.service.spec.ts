import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { GoogleWalletService } from './google-wallet.service';

const SECRET = 'testsecret';

function svc() {
  const map: Record<string, string> = { WALLET_DEV_SIGNING_SECRET: SECRET };
  const config = {
    get: (k: string, d?: unknown) => (k in map ? map[k] : d),
  } as unknown as ConfigService;
  return new GoogleWalletService(config);
}

describe('GoogleWalletService (dev signer)', () => {
  const pass = {
    studentId: 's1',
    fullName: 'Maria Papadopoulou',
    universityName: 'University of Athens',
    cardSerial: 'BC-ABC123',
  };

  it('reports not-configured without a service account', () => {
    expect(svc().configured).toBe(false);
  });

  it('builds a save URL with a decodable generic-object payload', () => {
    const url = svc().buildSaveUrl(pass);
    expect(url.startsWith('https://pay.google.com/gp/v/save/')).toBe(true);

    const token = url.split('/save/')[1];
    const decoded = jwt.verify(token, SECRET) as any;
    expect(decoded.aud).toBe('google');
    expect(decoded.typ).toBe('savetowallet');

    const obj = decoded.payload.genericObjects[0];
    expect(obj.id).toBe('DEV_ISSUER.BC-ABC123');
    expect(obj.classId).toBe('DEV_ISSUER.bluecard_student');
    expect(obj.barcode).toEqual({ type: 'QR_CODE', value: 'BC-ABC123' });
    expect(obj.header.defaultValue.value).toBe('Maria Papadopoulou');
    expect(obj.subheader.defaultValue.value).toBe('University of Athens');
  });

  it('sanitizes the object id', () => {
    const url = svc().buildSaveUrl({ ...pass, cardSerial: 'BC ABC/123' });
    const decoded = jwt.verify(url.split('/save/')[1], SECRET) as any;
    expect(decoded.payload.genericObjects[0].id).toBe('DEV_ISSUER.BC_ABC_123');
  });
});
