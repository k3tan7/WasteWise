// CLI entry point: `npm run db:seed` (or `npm run db:reset`).
// The seeding logic lives in src/lib/demo/seed-campus.ts so the in-app
// "Reset demo data" action reuses exactly the same code path.
import { prisma } from "../src/lib/db";
import { seedDemoCampus } from "../src/lib/demo/seed-campus";

seedDemoCampus()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
