import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculateTotal } from '../src/price.ts';

test('单价 10 元、数量 3 时，总价应为 30 元', () => {
  assert.equal(calculateTotal(10, 3), 30);
});
