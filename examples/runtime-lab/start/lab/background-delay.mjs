import { setTimeout } from 'node:timers/promises';
import { calculateTotal } from '../src/price.ts';
console.log('BACKGROUND_START ' + new Date().toISOString());
await setTimeout(35000);
console.log('BACKGROUND_TOTAL ' + calculateTotal(10, 3, 10));
console.log('BACKGROUND_DONE ' + new Date().toISOString());
