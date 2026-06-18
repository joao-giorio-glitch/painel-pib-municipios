export function calculateGrowth(currentValue: number, previousValue: number) {
  if (!previousValue) return 0;
  return currentValue / previousValue - 1;
}

export function calculateCAGR(initialValue: number, finalValue: number, numberOfYears: number) {
  if (!initialValue || numberOfYears <= 0) return 0;
  return (finalValue / initialValue) ** (1 / numberOfYears) - 1;
}

export function calculateShare(partValue: number, totalValue: number) {
  if (!totalValue) return 0;
  return partValue / totalValue;
}

export function calculateContributionToGrowth(previousShare: number, growthRate: number) {
  return previousShare * growthRate;
}
