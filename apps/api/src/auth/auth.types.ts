import { AdminRole } from '@blue-card/shared';

export type PrincipalKind = 'student' | 'admin';

// Compact JWT access-token payload. `typ` distinguishes students from admins;
// `role` is only present for admins (root | protoporia).
export interface JwtPayload {
  sub: string;
  typ: PrincipalKind;
  role?: AdminRole;
}

// What guards attach to the request as `request.user`.
export interface AuthPrincipal {
  id: string;
  type: PrincipalKind;
  role?: AdminRole;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
}
