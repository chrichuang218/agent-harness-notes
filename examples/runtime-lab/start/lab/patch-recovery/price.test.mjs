import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateTotal } from './price.ts';
test('three items at ten yuan total thirty', () => {
  assert.equal(calculateTotal(10, 3), 30);
});
