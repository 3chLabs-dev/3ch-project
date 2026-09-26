ALTER TABLE tournaments ADD COLUMN application_deadline_at TIMESTAMPTZ;
ALTER TABLE tournaments ADD CONSTRAINT tournament_application_deadline_before_start
  CHECK (application_deadline_at IS NULL OR application_deadline_at < starts_at);
