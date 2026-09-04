export const migration0022 = {
  id: '0022',
  sql: `
    CREATE TABLE IF NOT EXISTS zepp_heart_rate (
      id TEXT PRIMARY KEY,
      ts TEXT NOT NULL,
      date TEXT NOT NULL,
      heart_rate INTEGER NOT NULL,
      resting_hr INTEGER,
      hr_min INTEGER,
      hr_max INTEGER,
      raw_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `
};
