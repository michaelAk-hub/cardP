import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Starter seed for the university dropdown (spec §6.1, §9).
// Replace/extend with the official list (el + en) the human provides.
const universities: { nameEn: string; nameEl: string }[] = [
  {
    nameEn: 'National and Kapodistrian University of Athens',
    nameEl: 'Εθνικό και Καποδιστριακό Πανεπιστήμιο Αθηνών',
  },
  {
    nameEn: 'Aristotle University of Thessaloniki',
    nameEl: 'Αριστοτέλειο Πανεπιστήμιο Θεσσαλονίκης',
  },
  {
    nameEn: 'National Technical University of Athens',
    nameEl: 'Εθνικό Μετσόβιο Πολυτεχνείο',
  },
  {
    nameEn: 'University of Patras',
    nameEl: 'Πανεπιστήμιο Πατρών',
  },
  {
    nameEn: 'University of Crete',
    nameEl: 'Πανεπιστήμιο Κρήτης',
  },
  {
    nameEn: 'Athens University of Economics and Business',
    nameEl: 'Οικονομικό Πανεπιστήμιο Αθηνών',
  },
];

async function main(): Promise<void> {
  for (const u of universities) {
    // Idempotent by English name so re-running the seed is safe.
    const existing = await prisma.university.findFirst({
      where: { nameEn: u.nameEn },
    });
    if (existing) {
      continue;
    }
    await prisma.university.create({ data: u });
  }
  const count = await prisma.university.count();
  console.log(`Seed complete — ${count} universities present.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
