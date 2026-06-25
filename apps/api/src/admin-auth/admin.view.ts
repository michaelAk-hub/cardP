import { AdminUser } from '@prisma/client';

// Public projection of an admin — never leaks password_hash or totp_secret.
export type AdminView = Omit<AdminUser, 'passwordHash' | 'totpSecret'>;

export function toAdminView(admin: AdminUser): AdminView {
  const { passwordHash: _p, totpSecret: _t, ...view } = admin;
  return view;
}
