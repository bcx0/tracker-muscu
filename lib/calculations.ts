export function calculateE1RM(weight: number, reps: number): number {
  return Number((weight * (1 + reps / 30)).toFixed(2));
}

export function estimatedDuration(exerciseCount: number): number {
  return exerciseCount * 4;
}
