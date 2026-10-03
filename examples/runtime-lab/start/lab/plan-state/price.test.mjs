import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateTotal } from './price.ts';
test('planned repair keeps the expected total', () => {
  assert.equal(calculateTotal(10, 3), 30);
});
