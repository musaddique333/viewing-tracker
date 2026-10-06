CREATE TABLE viewings (
 id TEXT PRIMARY KEY, title TEXT NOT NULL, address TEXT NOT NULL,
 starts_at INTEGER NOT NULL, duration INTEGER NOT NULL DEFAULT 30,
 agent TEXT NOT NULL DEFAULT '', contact TEXT NOT NULL DEFAULT '',
 links TEXT NOT NULL DEFAULT '[]', notes TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','viewed','cancelled')),
 revision INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX viewings_schedule ON viewings(status, starts_at);
CREATE TABLE subscriptions (id TEXT PRIMARY KEY, endpoint TEXT UNIQUE NOT NULL, subscription TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE deliveries (
 viewing_id TEXT NOT NULL REFERENCES viewings(id) ON DELETE CASCADE,
 subscription_id TEXT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
 revision INTEGER NOT NULL, sent_at INTEGER, lease_until INTEGER NOT NULL DEFAULT 0,
 attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT,
 PRIMARY KEY(viewing_id, subscription_id, revision)
);
CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
CREATE TABLE login_attempts (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);
