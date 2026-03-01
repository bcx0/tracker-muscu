import { MuscleGroup } from '@/types';

export const VOLUME_TARGETS: Record<MuscleGroup, { min: number; max: number }> = {
  chest: { min: 12, max: 16 },
  shoulders: { min: 12, max: 16 },
  back: { min: 10, max: 14 },
  biceps: { min: 8, max: 12 },
  triceps: { min: 8, max: 12 },
  abs: { min: 6, max: 10 },
  arms: { min: 8, max: 12 },
  legs: { min: 4, max: 6 },
  other: { min: 4, max: 8 },
};
