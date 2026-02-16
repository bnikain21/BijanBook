import * as SQLite from "expo-sqlite";

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync("budget.db");
  return db;
}

export async function initDatabase(): Promise<void> {
  const database = await getDatabase();

  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      rule TEXT NOT NULL CHECK(rule IN ('income', 'spending'))
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      description TEXT NOT NULL,
      fromParty TEXT NOT NULL DEFAULT '',
      toParty TEXT NOT NULL DEFAULT '',
      amount REAL NOT NULL CHECK(amount > 0),
      categoryId INTEGER NOT NULL,
      notes TEXT,
      FOREIGN KEY (categoryId) REFERENCES categories(id)
    );
  `);

  // Add budgetAmount column if it doesn't exist (migration)
  try {
    await database.execAsync(
      "ALTER TABLE categories ADD COLUMN budgetAmount REAL"
    );
  } catch {
    // Column already exists — safe to ignore
  }

  // Add account column if it doesn't exist (migration)
  try {
    await database.execAsync(
      "ALTER TABLE transactions ADD COLUMN account TEXT NOT NULL DEFAULT ''"
    );
  } catch {
    // Column already exists — safe to ignore
  }

  // Add isIncome column if it doesn't exist (migration)
  try {
    await database.execAsync(
      "ALTER TABLE transactions ADD COLUMN isIncome INTEGER NOT NULL DEFAULT 0"
    );
  } catch {
    // Column already exists — safe to ignore
  }

  // Migrate existing data: populate account from fromParty/toParty
  await database.execAsync(`
    UPDATE transactions
    SET account = CASE
      WHEN fromParty = 'Outside' THEN toParty
      WHEN fromParty != '' THEN fromParty
      ELSE toParty
    END
    WHERE account = '';
  `);

  // Migrate existing data: set isIncome based on fromParty = 'Outside' + income category
  await database.execAsync(`
    UPDATE transactions
    SET isIncome = 1
    WHERE isIncome = 0
      AND fromParty = 'Outside'
      AND categoryId IN (SELECT id FROM categories WHERE rule = 'income');
  `);

  // Seed default categories — use INSERT OR IGNORE so new categories get added
  await database.execAsync(`
    INSERT OR IGNORE INTO categories (name, rule) VALUES ('Eating Out', 'spending');
    INSERT OR IGNORE INTO categories (name, rule) VALUES ('Groceries', 'spending');
    INSERT OR IGNORE INTO categories (name, rule) VALUES ('Drinking', 'spending');
    INSERT OR IGNORE INTO categories (name, rule) VALUES ('Uber/Uber Eats', 'spending');
    INSERT OR IGNORE INTO categories (name, rule) VALUES ('Hobbies', 'spending');
    INSERT OR IGNORE INTO categories (name, rule) VALUES ('Transportation', 'spending');
    INSERT OR IGNORE INTO categories (name, rule) VALUES ('Clothes', 'spending');
    INSERT OR IGNORE INTO categories (name, rule) VALUES ('Home', 'spending');
    INSERT OR IGNORE INTO categories (name, rule) VALUES ('Other', 'spending');
    INSERT OR IGNORE INTO categories (name, rule) VALUES ('Gambling', 'spending');
    INSERT OR IGNORE INTO categories (name, rule) VALUES ('Subscriptions', 'spending');
    INSERT OR IGNORE INTO categories (name, rule) VALUES ('Wages', 'income');
    INSERT OR IGNORE INTO categories (name, rule) VALUES ('Rent', 'spending');
  `);
}
