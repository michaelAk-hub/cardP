import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

// Bootstrap the first root admin (spec: root has no creator — created_by null).
// Idempotent: re-running with the same ROOT_EMAIL is a no-op.
//
//   ROOT_EMAIL=you@example.com ROOT_PASSWORD='strong-pass' npm run create:root -w @blue-card/api
//
// The root enrols TOTP on first login; nothing here enables 2FA.
const prisma = new PrismaClient();

async function main(): Promise<void> {
  const email = process.env.ROOT_EMAIL?.toLowerCase().trim();
  const password = process.env.ROOT_PASSWORD;

  if (!email || !password) {
    throw new Error('Set ROOT_EMAIL and ROOT_PASSWORD in the environment.');
  }
  if (password.length < 12) {
    throw new Error('ROOT_PASSWORD must be at least 12 characters.');
  }

  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) {
    console.log(`Root/admin with email ${email} already exists — skipping.`);
    return;
  }

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const root = await prisma.adminUser.create({
    data: { email, passwordHash, role: 'root' },
  });
  console.log(`Created root admin ${root.email} (${root.id}).`);
  console.log('Next: log in at /api/auth/admin/login to enrol TOTP.');
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
