// Types/enums mirrored from the API (kept local so the app doesn't depend on a
// workspace package at Metro-bundle time).

export type AccountStatus = 'pending' | 'active' | 'deactive';
export type DiscountType = 'percent' | 'fixed';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
}

export interface Student {
  id: string;
  name: string;
  surname: string;
  email: string;
  phone: string;
  universityId: string;
  accountStatus: AccountStatus;
  phoneVerified: boolean;
  emailVerified: boolean;
  idVerified: boolean;
  marketingConsent: boolean;
  cardSerial: string | null;
}

export interface University {
  id: string;
  nameEn: string;
  nameEl: string;
}

export interface Offer {
  id: string;
  storeId: string;
  titleEn: string;
  titleEl: string;
  descriptionEn: string;
  descriptionEl: string;
  discountType: DiscountType;
  discountValue: string; // Decimal serialized as string
  terms: string | null;
  expiryDate: string;
  status: 'active' | 'expired';
}

export interface Store {
  id: string;
  nameEn: string;
  nameEl: string;
  descriptionEn: string;
  descriptionEl: string;
  logoKey: string | null;
  status: 'active' | 'hidden';
  offers?: Offer[];
}

export interface WalletStatus {
  active: boolean;
  cardSerial: string | null;
  providers: { google: boolean; apple: boolean };
  passes: { platform: 'apple' | 'google'; state: string; issuedAt: string }[];
}
