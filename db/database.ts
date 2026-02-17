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

  // Create settings table
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Create monthly_budgets table
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS monthly_budgets (
      categoryId INTEGER NOT NULL,
      month TEXT NOT NULL,
      budgetAmount REAL NOT NULL,
      PRIMARY KEY (categoryId, month),
      FOREIGN KEY (categoryId) REFERENCES categories(id)
    );
  `);

  // Migrate existing categories.budgetAmount into monthly_budgets for current month
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const hasMonthlyBudgets = await database.getFirstAsync<{ cnt: number }>(
    "SELECT COUNT(*) as cnt FROM monthly_budgets"
  );
  if (hasMonthlyBudgets && hasMonthlyBudgets.cnt === 0) {
    await database.runAsync(
      `INSERT OR IGNORE INTO monthly_budgets (categoryId, month, budgetAmount)
       SELECT id, ?, budgetAmount FROM categories WHERE budgetAmount IS NOT NULL AND budgetAmount > 0`,
      currentMonth
    );
  }
}
