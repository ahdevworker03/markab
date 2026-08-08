import prisma from "./index";

async function seed(): Promise<void> {
  console.log("Seed: no records to seed yet.");
}

seed()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
