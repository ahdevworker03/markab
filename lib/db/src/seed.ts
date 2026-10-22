import { validateBenchmarkTarget } from "./benchmark-target";
import { formatBenchmarkSummary, seedBenchmark } from "./benchmark-seed";
import { seedE2e } from "./e2e-seed";
import { validateE2eTarget } from "./e2e-target";

async function seed(): Promise<void> {
  if (process.env["NODE_ENV"] === "e2e") {
    validateE2eTarget(process.env);
    const { default: prisma } = await import("./index");

    try {
      const result = await seedE2e(prisma);
      console.log(`E2E seed complete: owner=${result.ownerEmail}.`);
    } finally {
      await prisma.$disconnect();
    }

    return;
  }

  if (process.env["NODE_ENV"] === "benchmark") {
    const target = validateBenchmarkTarget(process.env);
    const { default: prisma } = await import("./index");

    try {
      console.log(
        formatBenchmarkSummary(
          await seedBenchmark(prisma, target.password, target.profile),
        ),
      );
    } finally {
      await prisma.$disconnect();
    }

    return;
  }

  const { default: prisma } = await import("./index");

  try {
    console.log("Seed: no records to seed yet.");
  } finally {
    await prisma.$disconnect();
  }
}

seed().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
