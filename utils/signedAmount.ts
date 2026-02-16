export function getSignedAmount(amount: number, isIncome: boolean): number {
  return isIncome ? amount : -amount;
}
