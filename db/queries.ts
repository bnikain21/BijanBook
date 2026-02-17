import { getDatabase } from "./database";

export interface Category {
  id: number;
  name: string;
  rule: "income" | "spending";
  budgetAmount: number | null;
}

export interface Transaction {
  id: number;
  date: string;
  description: string;
  account: string;
  isIncome: number;
  amount: number;
  categoryId: number;
  notes: string | null;
}

export interface TransactionInput {
  date: string;
  description: string;
  account: string;
  isIncome: number;
  amount: number;
  categoryId: number;
  notes: string;
}

export async function insertTransaction(tx: TransactionInput): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "INSERT INTO transactions (date, description, fromParty, toParty, account, isIncome, amount, categoryId, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    tx.date,
    tx.description,
    "",
    "",
    tx.account,
    tx.isIncome,
    tx.amount,
    tx.categoryId,
    tx.notes || null
  );
}

export async function getAllTransactions(): Promise<Transaction[]> {
  const db = await getDatabase();
  return db.getAllAsync<Transaction>(
    "SELECT id, date, description, account, isIncome, amount, categoryId, notes FROM transactions ORDER BY date DESC, id DESC"
  );
}

export async function getAllCategories(): Promise<Category[]> {
  const db = await getDatabase();
  return db.getAllAsync<Category>("SELECT * FROM categories ORDER BY name ASC");
}

export async function getOverviewData(): Promise<{
  transactions: Transaction[];
  categories: Category[];
}> {
  const [transactions, categories] = await Promise.all([
    getAllTransactions(),
    getAllCategories(),
  ]);
  return { transactions, categories };
}

export async function updateCategoryBudget(
  categoryId: number,
  budgetAmount: number | null
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE categories SET budgetAmount = ? WHERE id = ?",
    budgetAmount,
    categoryId
  );
}

export async function deleteTransaction(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM transactions WHERE id = ?", id);
}

export async function updateTransaction(
  id: number,
  tx: TransactionInput
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE transactions SET date = ?, description = ?, fromParty = ?, toParty = ?, account = ?, isIncome = ?, amount = ?, categoryId = ?, notes = ? WHERE id = ?",
    tx.date,
    tx.description,
    "",
    "",
    tx.account,
    tx.isIncome,
    tx.amount,
    tx.categoryId,
    tx.notes || null,
    id
  );
}

export async function getTransactionById(
  id: number
): Promise<Transaction | null> {
  const db = await getDatabase();
  return db.getFirstAsync<Transaction>(
    "SELECT id, date, description, account, isIncome, amount, categoryId, notes FROM transactions WHERE id = ?",
    id
  );
}

// --- Settings ---

export async function getSelectedMonth(): Promise<string> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM settings WHERE key = 'selectedMonth'"
  );
  if (row) return row.value;
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export async function setSelectedMonth(month: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "INSERT OR REPLACE INTO settings (key, value) VALUES ('selectedMonth', ?)",
    month
  );
}

// --- Monthly Budgets ---

export interface MonthlyBudget {
  categoryId: number;
  budgetAmount: number;
}

export async function getMonthlyBudgets(month: string): Promise<MonthlyBudget[]> {
  const db = await getDatabase();
  return db.getAllAsync<MonthlyBudget>(
    "SELECT categoryId, budgetAmount FROM monthly_budgets WHERE month = ?",
    month
  );
}

export async function setMonthlyBudget(
  categoryId: number,
  month: string,
  budgetAmount: number | null
): Promise<void> {
  const db = await getDatabase();
  if (budgetAmount === null || budgetAmount <= 0) {
    await db.runAsync(
      "DELETE FROM monthly_budgets WHERE categoryId = ? AND month = ?",
      categoryId,
      month
    );
  } else {
    await db.runAsync(
      "INSERT OR REPLACE INTO monthly_budgets (categoryId, month, budgetAmount) VALUES (?, ?, ?)",
      categoryId,
      month,
      budgetAmount
    );
  }
}

export async function copyBudgetsFromMonth(
  sourceMonth: string,
  targetMonth: string
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR IGNORE INTO monthly_budgets (categoryId, month, budgetAmount)
     SELECT categoryId, ?, budgetAmount FROM monthly_budgets WHERE month = ?`,
    targetMonth,
    sourceMonth
  );
}

export async function hasMonthlyBudgets(month: string): Promise<boolean> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ cnt: number }>(
    "SELECT COUNT(*) as cnt FROM monthly_budgets WHERE month = ?",
    month
  );
  return (row?.cnt ?? 0) > 0;
}

export async function getMostRecentMonthWithBudgets(beforeMonth: string): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ month: string }>(
    "SELECT DISTINCT month FROM monthly_budgets WHERE month < ? ORDER BY month DESC LIMIT 1",
    beforeMonth
  );
  return row?.month ?? null;
}

// --- Month-filtered queries ---

export async function getTransactionsByMonth(month: string): Promise<Transaction[]> {
  const db = await getDatabase();
  return db.getAllAsync<Transaction>(
    "SELECT id, date, description, account, isIncome, amount, categoryId, notes FROM transactions WHERE date LIKE ? ORDER BY date DESC, id DESC",
    `${month}%`
  );
}

export async function getMonthOverviewData(month: string): Promise<{
  transactions: Transaction[];
  categories: Category[];
  budgets: MonthlyBudget[];
}> {
  const [transactions, categories, budgets] = await Promise.all([
    getTransactionsByMonth(month),
    getAllCategories(),
    getMonthlyBudgets(month),
  ]);
  return { transactions, categories, budgets };
}

export async function deleteTransactionsByMonth(month: string): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    "DELETE FROM transactions WHERE date LIKE ?",
    `${month}%`
  );
  return result.changes;
}

export async function deleteMonthlyBudgetsByMonth(month: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM monthly_budgets WHERE month = ?", month);
}

// --- Export/Import ---

export async function exportMonthData(month: string): Promise<object> {
  const [transactions, categories, budgets] = await Promise.all([
    getTransactionsByMonth(month),
    getAllCategories(),
    getMonthlyBudgets(month),
  ]);
  return {
    month,
    exportedAt: new Date().toISOString(),
    categories: categories.map((c) => ({ id: c.id, name: c.name, rule: c.rule })),
    budgets: budgets.map((b) => ({
      categoryId: b.categoryId,
      budgetAmount: b.budgetAmount,
    })),
    transactions: transactions.map((t) => ({
      date: t.date,
      description: t.description,
      account: t.account,
      isIncome: t.isIncome,
      amount: t.amount,
      categoryId: t.categoryId,
      notes: t.notes,
    })),
  };
}

export async function importTransactions(data: TransactionInput[]): Promise<number> {
  const db = await getDatabase();
  let count = 0;
  for (const tx of data) {
    await db.runAsync(
      "INSERT INTO transactions (date, description, fromParty, toParty, account, isIncome, amount, categoryId, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      tx.date,
      tx.description,
      "",
      "",
      tx.account,
      tx.isIncome,
      tx.amount,
      tx.categoryId,
      tx.notes || null
    );
    count++;
  }
  return count;
}

// --- Category Management ---

export async function insertCategory(
  name: string,
  rule: "income" | "spending"
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "INSERT INTO categories (name, rule) VALUES (?, ?)",
    name,
    rule
  );
}

export async function deleteCategory(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM monthly_budgets WHERE categoryId = ?", id);
  await db.runAsync("DELETE FROM categories WHERE id = ?", id);
}

export async function categoryHasTransactions(
  id: number
): Promise<{ hasTransactions: boolean; count: number }> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ cnt: number }>(
    "SELECT COUNT(*) as cnt FROM transactions WHERE categoryId = ?",
    id
  );
  const count = row?.cnt ?? 0;
  return { hasTransactions: count > 0, count };
}

export async function getTransactionCountsByCategory(): Promise<
  Record<number, number>
> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ categoryId: number; cnt: number }>(
    "SELECT categoryId, COUNT(*) as cnt FROM transactions GROUP BY categoryId"
  );
  const result: Record<number, number> = {};
  for (const row of rows) {
    result[row.categoryId] = row.cnt;
  }
  return result;
}

export async function countTransactionsByMonth(month: string): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ cnt: number }>(
    "SELECT COUNT(*) as cnt FROM transactions WHERE date LIKE ?",
    `${month}%`
  );
  return row?.cnt ?? 0;
}
