export type MuscleGroup = 'chest' | 'back' | 'legs' | 'shoulders' | 'biceps' | 'triceps' | 'arms' | 'abs' | 'other';
export type ExerciseType = 'compound' | 'isolation';
export type SessionType =
  | 'Push'
  | 'Pull'
  | 'Abs'
  | 'Rest'
  | 'Legs'
  | 'UpperChest_Shoulders'
  | 'Abs_Arms'
  | 'Full_Upper'
  | 'Push_A'
  | 'Pull_B';
export type SessionStatus = 'upcoming' | 'done' | 'partial' | 'abandoned' | 'rest';
export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
export type UserObjective = 'masse' | 'seche' | 'maintien';
export type UserLevel = 'debutant' | 'intermediaire' | 'avance';

export interface Exercise {
  id: string;
  user_id: string;
  name: string;
  muscle_group: MuscleGroup;
  type: ExerciseType;
  sets: number;
  rep_range_min: number;
  rep_range_max: number;
  last_weight: number;
  last_reps: number;
  suggested_weight: number;
  is_active: boolean;
  created_at: string;
}

export interface WorkoutTemplate {
  id: string;
  user_id: string;
  session_type: SessionType;
  exercise_ids: string[];
  day_position: number;
}

export interface WeeklyPlan {
  id: string;
  user_id: string;
  week_start: string;
  week_id: string;
  created_at: string;
}

export interface WorkoutSession {
  id: string;
  user_id: string;
  weekly_plan_id: string;
  session_type: SessionType;
  scheduled_date: string;
  day_of_week: DayOfWeek;
  status: SessionStatus;
  planned_exercise_ids: string[];
  points_earned: number;
  completed_at?: string;
  created_at: string;
}

export interface ExerciseLog {
  id: string;
  session_id: string;
  user_id: string;
  exercise_id: string;
  performed_weight: number;
  performed_reps: number;
  sets: number;
  rir: number;
  e1rm: number;
  logged_at: string;
}

export interface SetLog {
  id: string;
  exercise_log_id: string;
  user_id: string;
  set_number: number;
  weight: number;
  reps: number;
  rir: number;
  completed: boolean;
  logged_at: string;
}

export interface PersonalRecord {
  id: string;
  user_id: string;
  exercise_id: string;
  best_weight: number;
  best_reps: number;
  best_e1rm: number;
  achieved_at: string;
}

export interface MuscleVolumeCache {
  id: string;
  user_id: string;
  week_id: string;
  muscle_group: MuscleGroup;
  total_sets: number;
  updated_at: string;
}

export interface UserSettings {
  id: string;
  user_id: string;
  sessions_per_week: number;
  training_days: DayOfWeek[];
  setup_complete: boolean;
  objective: UserObjective;
  level: UserLevel;
  current_streak: number;
  longest_streak: number;
  total_sessions: number;
  rest_timer_duration: number;
  created_at: string;
}
