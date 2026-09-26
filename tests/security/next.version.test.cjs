const assert = require('node:assert/strict');
const test = require('node:test');
const pkg = require('../../package.json');

test('Next.js includes the September 2026 security fix', () => {
  const version = pkg.dependencies.next;
  const [major, minor, patch] = version.split('.').map(Number);

  assert.ok(
    major > 16 || (major === 16 && (minor > 3 || (minor === 3 && patch >= 6))),
    `Next.js ${version} predates the security fix in 16.3.6`
  );
  assert.equal(pkg.devDependencies['eslint-config-next'], version);
  assert.equal(pkg.pnpm.overrides.next, version);
});
