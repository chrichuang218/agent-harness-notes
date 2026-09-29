import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculateTotal } from '../src/price.ts';

test('单价 10 元、数量 3 时，总价应为 30 元', () => {
  assert.equal(calculateTotal(10, 3), 30);
});

test('折扣为 undefined 或 0 时，总价应为 30 元', () => {
  assert.equal(calculateTotal(10, 3, undefined), 30);
  assert.equal(calculateTotal(10, 3, 0), 30);
});

test('减免 10% 时，总价应为 27 元', () => {
  assert.equal(calculateTotal(10, 3, 10), 27);
});

test('减免 100% 时，总价应为 0 元', () => {
  assert.equal(calculateTotal(10, 3, 100), 0);
});

test('减免 25% 时，总价应为 22.5 元', () => {
  assert.equal(calculateTotal(10, 3, 25), 22.5);
});

for (const discountPercent of [-1, 101, 1.5, NaN, Infinity, -Infinity]) {
  test(`折扣为 ${discountPercent} 时，应抛出 RangeError`, () => {
    assert.throws(() => calculateTotal(10, 3, discountPercent), {
      name: 'RangeError',
      message: 'discountPercent must be an integer between 0 and 100',
    });
  });
}
