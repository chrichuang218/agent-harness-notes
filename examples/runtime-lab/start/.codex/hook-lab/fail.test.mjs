import test from 'node:test';
import assert from 'node:assert/strict';
// Intentional failing fixture; do not fix it during the observation experiment.
test('hook-lab failing control', () => assert.equal(10 + 3, 30));
