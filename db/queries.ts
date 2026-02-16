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
