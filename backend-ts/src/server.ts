import { buildApp } from "./app";
import { env } from "./config/env";

async function start(): Promise<void> {
  const app = await buildApp();

  try {
    await app.listen({
      port: env.PORT,
      host: env.HOST
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void start().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
