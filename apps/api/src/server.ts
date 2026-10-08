import "dotenv/config";
import app from "./app";
import { env, logger } from "./config";
import { createShutdownHandler } from "./server-shutdown";

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, "Server listening");
});

server.once("error", (err) => {
  logger.error({ err }, "Error listening on port");
  process.exit(1);
});

const shutdown = createShutdownHandler(server);
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
