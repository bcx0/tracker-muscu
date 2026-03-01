CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE user_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sessions_per_week INT NOT NULL DEFAULT 5,
  training_days TEXT[] NOT NULL DEFAULT '{}',
  setup_complete BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE TABLE exercises (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  muscle_group TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('compound', 'isolation')),
  sets INT NOT NULL DEFAULT 3,
  rep_range_min INT NOT NULL DEFAULT 8,
  rep_range_max INT NOT NULL DEFAULT 12,
  last_weight NUMERIC(6,2) NOT NULL DEFAULT 0,
  last_reps INT NOT NULL DEFAULT 0,
  suggested_weight NUMERIC(6,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE workout_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_type TEXT NOT NULL,
  exercise_ids UUID[] NOT NULL DEFAULT '{}',
  day_position INT NOT NULL CHECK (day_position BETWEEN 1 AND 5)
);

CREATE TABLE weekly_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  week_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_id)
);

CREATE TABLE workout_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weekly_plan_id UUID NOT NULL REFERENCES weekly_plans(id) ON DELETE CASCADE,
  session_type TEXT NOT NULL,
  scheduled_date DATE NOT NULL,
  day_of_week TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'done', 'partial', 'abandoned', 'rest')),
  planned_exercise_ids UUID[] NOT NULL DEFAULT '{}',
  points_earned INT NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE exercise_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  performed_weight NUMERIC(6,2) NOT NULL,
  performed_reps INT NOT NULL,
  sets INT NOT NULL,
  rir INT NOT NULL DEFAULT 2 CHECK (rir BETWEEN 0 AND 3),
  e1rm NUMERIC(8,2) NOT NULL DEFAULT 0,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE muscle_volume_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_id TEXT NOT NULL,
  muscle_group TEXT NOT NULL,
  total_sets INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_id, muscle_group)
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE muscle_volume_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User owns data" ON user_settings FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "User owns data" ON exercises FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "User owns data" ON workout_templates FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "User owns data" ON weekly_plans FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "User owns data" ON workout_sessions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "User owns data" ON exercise_logs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "User owns data" ON muscle_volume_cache FOR ALL USING (auth.uid() = user_id);
