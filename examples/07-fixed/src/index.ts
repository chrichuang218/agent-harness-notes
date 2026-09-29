import { calculateTotal } from './price.ts';

const unitPrice = 10;
const quantity = 3;
const total = calculateTotal(unitPrice, quantity);

console.log(`单价：${unitPrice} 元`);
console.log(`数量：${quantity}`);
console.log(`总价：${total} 元`);
