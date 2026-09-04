export const migration0021 = {
  id: '0021',
  sql: `
    CREATE TABLE IF NOT EXISTS wearable_daily (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL,
      date TEXT NOT NULL,
      hr_avg INTEGER,
      steps INTEGER,
      raw_provider_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(provider, date)
    );
  `
};
