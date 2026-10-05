import { validateBenchmarkTarget } from "./benchmark-target";
import { rotateBenchmarkOwnerPassword } from "./benchmark-owner-password";

async function run(): Promise<void> {
  validateBenchmarkTarget(process.env);
  const { default: prisma } = await import("./index");

  try {
    await rotateBenchmarkOwnerPassword(prisma, process.env);
    console.log("Benchmark owner password rotated.");
  } finally {
    await prisma.$disconnect();
  }
}

run().catch(() => {
  console.error("Benchmark owner password rotation failed.");
  process.exit(1);
});
