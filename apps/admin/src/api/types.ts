export type AdminRole = 'root' | 'protoporia';
export type AccountStatus = 'pending' | 'active' | 'deactive';
export type TamperStatus = 'clean' | 'suspect' | 'flagged' | null;
export type DiscountType = 'percent' | 'fixed';
export type CampaignChannel = 'sms' | 'email';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
}

export interface AdminView {
  id: string;
  role: AdminRole;
  email: string;
  totpEnabled: boolean;
  disabledAt: string | null;
  createdById: string | null;
  createdAt: string;
}

export interface University {
  id: string;
  nameEn: string;
  nameEl: string;
}

export interface StudentRow {
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
  deactivationReason: string | null;
  createdAt: string;
  idDocument: { tamperStatus: TamperStatus; uploadedAt: string } | null;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface IdDocumentLinks {
  uploadedAt: string;
  tamperStatus: TamperStatus;
  tamperScore: number | null;
  front: string;
  back: string;
}

export interface Store {
  id: string;
  nameEn: string;
  nameEl: string;
  descriptionEn: string;
  descriptionEl: string;
  logoKey: string | null;
  status: 'active' | 'hidden';
  createdAt: string;
}

export interface Offer {
  id: string;
  storeId: string;
  titleEn: string;
  titleEl: string;
  descriptionEn: string;
  descriptionEl: string;
  discountType: DiscountType;
  discountValue: string;
  terms: string | null;
  expiryDate: string;
  status: 'active' | 'expired';
}

export interface AnalyticsSummary {
  students: { total: number; active: number; pending: number; deactive: number };
  offers: { total: number; active: number };
  stores: { total: number; active: number };
}

export interface Campaign {
  id: string;
  channel: CampaignChannel;
  subject: string | null;
  body: string;
  sentAt: string | null;
  createdAt: string;
  _count?: { recipients: number };
  stats?: Record<string, number>;
}
