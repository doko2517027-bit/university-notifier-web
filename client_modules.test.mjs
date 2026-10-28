import { execFileSync } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';
test('every client import resolves to an existing export before any page runs', () => {
  const output = execFileSync(process.execPath, ['--experimental-vm-modules', 'scripts/check_client_modules.mjs'], {
    cwd: new URL('.', import.meta.url), encoding: 'utf8', timeout: 30000,
  });
  assert.match(output, /client modules successfully/);
});
