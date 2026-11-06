import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));
const config = new URL('../astro.config.mjs', import.meta.url).href;

function loadConfig(cwd, database) {
  const env = {...process.env};
  delete env.CONTENT_DB;
  if (database !== undefined) env.CONTENT_DB = database;
  return spawnSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(config)}); console.log(process.env.CONTENT_DB);`], {cwd, env, encoding: 'utf8'});
}

test('default and relative database paths stay rooted at the repository from either workspace', () => {
  for (const cwd of [repositoryRoot, join(repositoryRoot, 'apps/web'), tmpdir()]) {
    for (const [input, expected] of [[undefined, join(repositoryRoot, 'data/content.sqlite')], ['data/alternate.sqlite', join(repositoryRoot, 'data/alternate.sqlite')], [join(tmpdir(), 'opc-explicit.sqlite'), join(tmpdir(), 'opc-explicit.sqlite')]]) {
      const result = loadConfig(cwd, input);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout.trim(), expected);
    }
  }
});

test('an explicit empty database configuration fails rather than selecting the sample', () => {
  const result = loadConfig(repositoryRoot, ' ');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /CONTENT_DB must not be empty/);
});
