import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { parseListenOptions } from '../src/config.js';

test('health reports only liveness and unknown business routes return 404', async () => {
  const app = createApp();
  const health = await app.handle(new Request('http://localhost/health'));
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), {status: 'ok', service: 'opc-api', check: 'liveness'});
  const missing = await app.handle(new Request('http://localhost/articles'));
  assert.equal(missing.status, 404);
  const write = await app.handle(new Request('http://localhost/health', {
    method: 'POST', headers: {'content-type': 'application/json'},
    body: JSON.stringify({title: 'not a write endpoint'}),
  }));
  assert.equal(write.status, 404);
});

test('listen config defaults to loopback and validates explicit ports without silent fallback', () => {
  assert.deepEqual(parseListenOptions(undefined), {ok: true, value: {host: '127.0.0.1', port: 3001}});
  for (const port of ['1', ' 3002 ', '65535']) {
    assert.deepEqual(parseListenOptions(port), {ok: true, value: {host: '127.0.0.1', port: Number(port)}});
  }
  const cases = [
    ['', 'PORT_EMPTY'], ['  ', 'PORT_EMPTY'], ['3.5', 'PORT_FORMAT'], ['3001abc', 'PORT_FORMAT'],
    ['-1', 'PORT_FORMAT'], ['0', 'PORT_RANGE'], ['65536', 'PORT_RANGE'], ['99999999999999999999', 'PORT_RANGE'],
  ];
  for (const [port, code] of cases) {
    const result = parseListenOptions(port);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, code);
  }
});
