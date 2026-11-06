import { createApp } from './app.js';
import { parseListenOptions } from './config.js';

const config = parseListenOptions(process.env.PORT);
if (!config.ok) throw new Error(config.error.code + ': ' + config.error.message);

const app = createApp();
try {
  app.listen({ hostname: config.value.host, port: config.value.port, reusePort: false });
  // The pinned Node adapter exposes srvx as `raw`; its listen callback runs
  // before the socket is ready. Await readiness so bind errors fail startup.
  const transport = app.server as unknown as { raw: { ready(): Promise<unknown> } };
  await transport.raw.ready();
  console.info(`API listening on http://${config.value.host}:${config.value.port}`);
} catch (error) {
  console.error(error);
  await app.stop();
  process.exitCode = 1;
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, async () => {
    try { await app.stop(); }
    catch (error) { console.error(error); process.exitCode = 1; }
  });
}
