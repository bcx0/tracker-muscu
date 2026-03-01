ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS objective TEXT DEFAULT 'masse'
    CHECK (objective IN ('masse', 'seche', 'maintien')),
  ADD COLUMN IF NOT EXISTS level TEXT DEFAULT 'intermediaire'
    CHECK (level IN ('debutant', 'intermediaire', 'avance'));
