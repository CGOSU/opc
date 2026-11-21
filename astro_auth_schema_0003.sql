CREATE TABLE admins (
  id TEXT PRIMARY KEY NOT NULL,
  singleton INTEGER NOT NULL DEFAULT 1 UNIQUE CONSTRAINT admins_singleton CHECK (singleton = 1),
  username TEXT NOT NULL COLLATE BINARY UNIQUE
    CONSTRAINT admins_username_format
    CHECK (length(username) BETWEEN 4 AND 32 AND username NOT GLOB '*[^A-Za-z0-9_]*'),
  password_hash TEXT NOT NULL
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY NOT NULL,
  admin_id TEXT NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_admin_id_idx ON sessions (admin_id);
CREATE INDEX sessions_expires_at_idx ON sessions (expires_at);

CREATE TABLE admin_login_limits (
  client_key TEXT PRIMARY KEY NOT NULL,
  attempts INTEGER NOT NULL CONSTRAINT admin_login_limits_positive_attempts CHECK (attempts > 0),
  expires_at INTEGER NOT NULL
);
CREATE INDEX admin_login_limits_expires_at_idx ON admin_login_limits (expires_at);
