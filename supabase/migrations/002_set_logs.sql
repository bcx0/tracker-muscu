CREATE TABLE set_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exercise_log_id UUID NOT NULL REFERENCES exercise_logs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  set_number INT NOT NULL,
  weight NUMERIC(6,2) NOT NULL,
  reps INT NOT NULL,
  rir INT NOT NULL DEFAULT 2,
  completed BOOLEAN NOT NULL DEFAULT false,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE set_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User owns data" ON set_logs FOR ALL USING (auth.uid() = user_id);

CREATE TABLE personal_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  best_weight NUMERIC(6,2) NOT NULL DEFAULT 0,
  best_reps INT NOT NULL DEFAULT 0,
  best_e1rm NUMERIC(8,2) NOT NULL DEFAULT 0,
  achieved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, exercise_id)
);

ALTER TABLE personal_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User owns data" ON personal_records FOR ALL USING (auth.uid() = user_id);

ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS current_streak INT NOT NULL DEFAULT 0;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS longest_streak INT NOT NULL DEFAULT 0;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS total_sessions INT NOT NULL DEFAULT 0;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS rest_timer_duration INT NOT NULL DEFAULT 90;