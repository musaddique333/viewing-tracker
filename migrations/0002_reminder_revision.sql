-- Keep optimistic edit versions separate from reminder schedules.
ALTER TABLE viewings ADD COLUMN reminder_revision INTEGER NOT NULL DEFAULT 1;
