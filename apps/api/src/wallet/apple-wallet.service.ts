import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import JSZip from 'jszip';
import * as forge from 'node-forge';
import { PassData } from './wallet.types';

// 1x1 transparent PNG — placeholder icon/logo so the .pkpass is structurally
// valid in dev. Replace with real branding assets for production.
const PLACEHOLDER_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==',
  'base64',
);

export interface PkpassResult {
  buffer: Buffer;
  signed: boolean;
}

// Builds a .pkpass (zip of pass.json + images + manifest + signature). The
// manifest + zip are always produced; the PKCS#7 signature is added only when
// the Pass Type ID cert + key + WWDR cert are configured (otherwise a clearly
// unsigned DEV pass is returned so the flow is testable).
@Injectable()
export class AppleWalletService {
  private readonly logger = new Logger(AppleWalletService.name);

  constructor(private readonly config: ConfigService) {}

  get configured(): boolean {
    return Boolean(
      this.config.get<string>('APPLE_PASS_CERT_PEM_PATH') &&
        this.config.get<string>('APPLE_PASS_KEY_PEM_PATH') &&
        this.config.get<string>('APPLE_WWDR_PEM_PATH'),
    );
  }

  buildPassJson(pass: PassData): Record<string, unknown> {
    return {
      formatVersion: 1,
      passTypeIdentifier: this.config.get<string>('APPLE_PASS_TYPE_ID', 'pass.dev.bluecard'),
      teamIdentifier: this.config.get<string>('APPLE_TEAM_ID', 'DEVTEAM'),
      organizationName: this.config.get<string>('APPLE_PASS_ORG_NAME', 'Blue Card'),
      serialNumber: pass.cardSerial,
      description: 'Blue Card student discount card',
      foregroundColor: 'rgb(255,255,255)',
      backgroundColor: 'rgb(10,77,162)',
      labelColor: 'rgb(255,255,255)',
      barcodes: [
        {
          format: 'PKBarcodeFormatQR',
          message: pass.cardSerial,
          messageEncoding: 'iso-8859-1',
        },
      ],
      generic: {
        primaryFields: [{ key: 'name', label: 'STUDENT', value: pass.fullName }],
        secondaryFields: [
          { key: 'university', label: 'UNIVERSITY', value: pass.universityName },
        ],
        auxiliaryFields: [{ key: 'serial', label: 'CARD', value: pass.cardSerial }],
      },
    };
  }

  async generate(pass: PassData): Promise<PkpassResult> {
    const files: Record<string, Buffer> = {
      'pass.json': Buffer.from(JSON.stringify(this.buildPassJson(pass))),
      'icon.png': PLACEHOLDER_PNG,
      'icon@2x.png': PLACEHOLDER_PNG,
      'logo.png': PLACEHOLDER_PNG,
    };

    // manifest.json = { filename: sha1hex } for every file in the bundle.
    const manifest: Record<string, string> = {};
    for (const [name, buf] of Object.entries(files)) {
      manifest[name] = createHash('sha1').update(buf).digest('hex');
    }
    const manifestStr = JSON.stringify(manifest);

    const zip = new JSZip();
    for (const [name, buf] of Object.entries(files)) zip.file(name, buf);
    zip.file('manifest.json', manifestStr);

    let signed = false;
    if (this.configured) {
      try {
        zip.file('signature', this.sign(manifestStr));
        signed = true;
      } catch (err) {
        this.logger.error(`Apple pass signing failed: ${(err as Error).message}`);
      }
    } else {
      this.logger.warn('Apple Wallet certs absent — returning UNSIGNED dev .pkpass');
    }

    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    return { buffer, signed };
  }

  // PKCS#7 detached signature over manifest.json (PassKit requirement).
  private sign(manifestStr: string): Buffer {
    const cert = forge.pki.certificateFromPem(
      readFileSync(this.config.getOrThrow<string>('APPLE_PASS_CERT_PEM_PATH'), 'utf8'),
    );
    const wwdr = forge.pki.certificateFromPem(
      readFileSync(this.config.getOrThrow<string>('APPLE_WWDR_PEM_PATH'), 'utf8'),
    );
    const keyPem = readFileSync(
      this.config.getOrThrow<string>('APPLE_PASS_KEY_PEM_PATH'),
      'utf8',
    );
    const password = this.config.get<string>('APPLE_PASS_KEY_PASSWORD') || undefined;
    const key = password
      ? forge.pki.decryptRsaPrivateKey(keyPem, password)
      : forge.pki.privateKeyFromPem(keyPem);

    const p7 = forge.pkcs7.createSignedData();
    p7.content = forge.util.createBuffer(manifestStr, 'utf8');
    p7.addCertificate(cert);
    p7.addCertificate(wwdr);
    p7.addSigner({
      key: key as forge.pki.rsa.PrivateKey,
      certificate: cert,
      digestAlgorithm: forge.pki.oids.sha256,
      authenticatedAttributes: [
        { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
        { type: forge.pki.oids.messageDigest },
        { type: forge.pki.oids.signingTime, value: new Date().toString() },
      ],
    });
    p7.sign({ detached: true });
    const der = forge.asn1.toDer(p7.toAsn1()).getBytes();
    return Buffer.from(der, 'binary');
  }
}
