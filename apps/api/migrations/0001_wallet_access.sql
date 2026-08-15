CREATE TABLE IF NOT EXISTS wallet_login_nonces (
  nonce TEXT PRIMARY KEY NOT NULL,
  wallet_address TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS wallet_sessions (
  token TEXT PRIMARY KEY NOT NULL,
  wallet_address TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS wallet_sessions_expiry_idx ON wallet_sessions (expires_at);

CREATE TABLE IF NOT EXISTS wallet_daily_usage (
  wallet_address TEXT NOT NULL,
  usage_day TEXT NOT NULL,
  task_count INTEGER NOT NULL DEFAULT 0,
  spent_milli_mon INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (wallet_address, usage_day)
);
