export function calculateTotal(
  unitPrice: number,
  quantity: number,
  discountPercent: number = 0
): number {
  if (!Number.isInteger(discountPercent) || discountPercent < 0 || discountPercent > 100) {
    throw new RangeError('discountPercent must be an integer between 0 and 100');
  }

  return (unitPrice * quantity) * ((100 - discountPercent) / 100);
}
