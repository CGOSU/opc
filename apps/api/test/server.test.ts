import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

const entry = fileURLToPath(new URL('../src/server.ts', import.meta.url));

function launch(port: number) {
  const child = spawn(process.execPath, ['--import', 'tsx', entry], {
    env: {...process.env, PORT: String(port)}, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  let errors = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { errors += chunk; });
  const exited = once(child, 'exit');
  const timeout = setTimeout(() => child.kill('SIGKILL'), 8000);
  child.once('exit', () => clearTimeout(timeout));
  return {child, exited, output: () => output, errors: () => errors};
}

test('occupied loopback port fails startup instead of reporting success', {timeout: 10000}, async () => {
  const occupied = createServer();
  occupied.listen(0, '127.0.0.1');
  await once(occupied, 'listening');
  const address = occupied.address();
  assert.ok(address && typeof address !== 'string');
  const process = launch(address.port);
  try {
    const [code, signal] = await process.exited;
    assert.equal(code, 1, process.errors());
    assert.equal(signal, null);
    assert.match(process.errors(), /EADDRINUSE/);
    assert.equal(process.output().includes('API listening'), false);
  } finally {
    process.child.kill('SIGKILL');
    await new Promise<void>(resolve => occupied.close(() => resolve()));
  }
});

test('Node adapter serves HTTP and terminates gracefully', {timeout: 10000}, async () => {
  const reservation = createServer();
  reservation.listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const address = reservation.address();
  assert.ok(address && typeof address !== 'string');
  await new Promise<void>(resolve => reservation.close(() => resolve()));
  const process = launch(address.port);
  try {
    while (!process.output().includes('API listening')) {
      assert.equal(process.child.exitCode, null, process.errors());
      assert.equal(process.child.signalCode, null, process.errors());
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    const url = `http://127.0.0.1:${address.port}`;
    const response = await fetch(url + '/health', {signal: AbortSignal.timeout(2000)});
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {status: 'ok', service: 'opc-api', check: 'liveness'});
    assert.equal((await fetch(url + '/missing', {signal: AbortSignal.timeout(2000)})).status, 404);
    process.child.kill('SIGTERM');
    const [code, signal] = await process.exited;
    assert.equal(code, 0, process.errors());
    assert.equal(signal, null);
  } finally { process.child.kill('SIGKILL'); }
});
