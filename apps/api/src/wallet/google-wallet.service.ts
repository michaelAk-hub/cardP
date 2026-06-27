import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'node:fs';
import * as jwt from 'jsonwebtoken';
import { PassData } from './wallet.types';

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

// Builds the "Add to Google Wallet" save link: a signed JWT carrying a generic
// pass class + object. With a service-account key it is RS256-signed and
// production-ready; without one it falls back to a DEV HS256 token so the flow
// is exercisable locally.
//
// NOTE: for production scale the generic CLASS should be pre-created once via
// the Wallet REST API; inlining it in the JWT (as here) is fine for v1.
@Injectable()
export class GoogleWalletService {
  private readonly logger = new Logger(GoogleWalletService.name);
  private readonly sa: ServiceAccount | null;
  private readonly issuerId: string;

  constructor(private readonly config: ConfigService) {
    this.issuerId = this.config.get<string>('GOOGLE_WALLET_ISSUER_ID', '') || 'DEV_ISSUER';
    this.sa = this.loadServiceAccount();
  }

  get configured(): boolean {
    return this.sa !== null;
  }

  buildSaveUrl(pass: PassData): string {
    const classId = `${this.issuerId}.${this.config.get<string>('GOOGLE_WALLET_CLASS_SUFFIX', 'bluecard_student')}`;
    const objectId = `${this.issuerId}.${sanitize(pass.cardSerial)}`;

    const genericClass = { id: classId };
    const genericObject = {
      id: objectId,
      classId,
      state: 'ACTIVE',
      cardTitle: text('Blue Card'),
      header: text(pass.fullName),
      subheader: text(pass.universityName),
      hexBackgroundColor: this.config.get<string>('GOOGLE_WALLET_BG_COLOR', '#0A4DA2'),
      logo: this.logo(),
      barcode: { type: 'QR_CODE', value: pass.cardSerial },
      textModulesData: [
        { id: 'university', header: 'University', body: pass.universityName },
        { id: 'serial', header: 'Card', body: pass.cardSerial },
      ],
    };

    const claims = {
      aud: 'google',
      typ: 'savetowallet',
      payload: { genericClasses: [genericClass], genericObjects: [genericObject] },
    };

    const token = this.sign(claims);
    return `https://pay.google.com/gp/v/save/${token}`;
  }

  private sign(claims: object): string {
    if (this.sa) {
      return jwt.sign({ iss: this.sa.client_email, ...claims }, this.sa.private_key, {
        algorithm: 'RS256',
      });
    }
    // DEV: not a valid Google token, but decodable for local verification.
    return jwt.sign(
      { iss: 'dev-issuer@bluecard.local', ...claims },
      this.config.get<string>('WALLET_DEV_SIGNING_SECRET', 'dev'),
      { algorithm: 'HS256' },
    );
  }

  private logo() {
    const uri = this.config.get<string>('GOOGLE_WALLET_LOGO_URL', '');
    return uri ? { sourceUri: { uri } } : undefined;
  }

  private loadServiceAccount(): ServiceAccount | null {
    const path = this.config.get<string>('GOOGLE_WALLET_SERVICE_ACCOUNT_PATH', '');
    if (!path) {
      this.logger.warn('Google Wallet not configured — using DEV save-JWT signer');
      return null;
    }
    try {
      const sa = JSON.parse(readFileSync(path, 'utf8')) as ServiceAccount;
      if (!sa.client_email || !sa.private_key) throw new Error('missing fields');
      this.logger.log('Google Wallet RS256 signer configured');
      return sa;
    } catch (err) {
      this.logger.error(`Failed to load Google SA key (${(err as Error).message}) — DEV signer`);
      return null;
    }
  }
}

function text(value: string) {
  return { defaultValue: { language: 'en', value } };
}

// Google object id allows [A-Za-z0-9._-]; map anything else to '_'.
function sanitize(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/g, '_');
}
