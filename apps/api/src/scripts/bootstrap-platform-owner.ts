function readEmail(args: string[]): string {
  const index = args.indexOf("--email");
  const email = index === -1 ? undefined : args[index + 1];
  if (!email || args.length !== 2) {
    throw new Error("Usage: bootstrap:platform-owner --email <email>");
  }
  return email;
}

async function main(): Promise<void> {
  if (process.env["NODE_ENV"] !== "production") {
    throw new Error("bootstrap:platform-owner requires NODE_ENV=production.");
  }

  const email = readEmail(process.argv.slice(2));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    throw new Error("--email must be a valid email address.");
  }

  const [{ connect, disconnect }, { bootstrapPlatformOwner }] = await Promise.all([
    import("../database"),
    import("../modules/platform/platform-bootstrap.service"),
  ]);
  await connect();
  try {
    const { created } = await bootstrapPlatformOwner(email);
    console.log(created ? "Platform owner bootstrapped." : "Platform owner already exists.");
  } finally {
    await disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Platform owner bootstrap failed.");
  process.exitCode = 1;
});
