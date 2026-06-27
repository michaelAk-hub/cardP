import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import JSZip from 'jszip';
import { AppleWalletService } from './apple-wallet.service';

function svc() {
  const config = {
    get: (_k: string, d?: unknown) => d, // nothing configured -> defaults
  } as unknown as ConfigService;
  return new AppleWalletService(config);
}

const pass = {
  studentId: 's1',
  fullName: 'Maria Papadopoulou',
  universityName: 'University of Athens',
  cardSerial: 'BC-ABC123',
};

describe('AppleWalletService (dev / unsigned)', () => {
  it('builds a valid pass.json model', () => {
    const p = svc().buildPassJson(pass);
    expect(p.formatVersion).toBe(1);
    expect(p.serialNumber).toBe('BC-ABC123');
    expect((p.barcodes as any[])[0].message).toBe('BC-ABC123');
    expect((p.generic as any).primaryFields[0].value).toBe('Maria Papadopoulou');
  });

  it('reports not-configured and returns an UNSIGNED .pkpass', async () => {
    const s = svc();
    expect(s.configured).toBe(false);
    const { buffer, signed } = await s.generate(pass);
    expect(signed).toBe(false);

    const zip = await JSZip.loadAsync(buffer);
    expect(zip.file('pass.json')).toBeTruthy();
    expect(zip.file('manifest.json')).toBeTruthy();
    expect(zip.file('icon.png')).toBeTruthy();
    expect(zip.file('signature')).toBeNull(); // unsigned in dev
  });

  it('manifest contains the correct SHA-1 of pass.json', async () => {
    const { buffer } = await svc().generate(pass);
    const zip = await JSZip.loadAsync(buffer);
    const passJson = await zip.file('pass.json')!.async('nodebuffer');
    const manifest = JSON.parse(await zip.file('manifest.json')!.async('string'));
    expect(manifest['pass.json']).toBe(
      createHash('sha1').update(passJson).digest('hex'),
    );
  });
});
