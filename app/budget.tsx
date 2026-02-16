import { useCallback, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import {
  getAllCategories,
  getAllTransactions,
  updateCategoryBudget,
  Category,
} from "../db/queries";
import { getSignedAmount } from "../utils/signedAmount";

interface BudgetRow {
  id: number;
  name: string;
  rule: "income" | "spending";
  budgetAmount: number | null;
  actual: number;
}

export default function BudgetScreen() {
  const [rows, setRows] = useState<BudgetRow[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [totalBudget, setTotalBudget] = useState(0);
  const [totalSpent, setTotalSpent] = useState(0);

  const loadData = useCallback(async () => {
    const [categories, transactions] = await Promise.all([
      getAllCategories(),
      getAllTransactions(),
    ]);

    const catMap: Record<number, Category> = {};
    for (const c of categories) catMap[c.id] = c;

    const actuals: Record<number, number> = {};
    for (const tx of transactions) {
      const cat = catMap[tx.categoryId];
      if (!cat) continue;
      const signed = getSignedAmount(tx.amount, tx.isIncome === 1);
      actuals[tx.categoryId] = (actuals[tx.categoryId] ?? 0) + signed;
    }

    const budgetRows: BudgetRow[] = categories.map((c) => {
      const rawNet = actuals[c.id] ?? 0;
      return {
        id: c.id,
        name: c.name,
        rule: c.rule,
        budgetAmount: c.budgetAmount,
        actual: c.rule === "spending" ? -rawNet : rawNet,
      };
    });

    let tBudget = 0;
    let tSpent = 0;
    for (const r of budgetRows) {
      if (r.budgetAmount !== null && r.budgetAmount > 0) {
        tBudget += r.budgetAmount;
      }
      tSpent += r.actual;
    }

    setRows(budgetRows);
    setTotalBudget(tBudget);
    setTotalSpent(tSpent);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  function startEdit(row: BudgetRow) {
    setEditingId(row.id);
    setEditValue(row.budgetAmount !== null ? String(row.budgetAmount) : "");
  }

  async function saveEdit(id: number) {
    const trimmed = editValue.trim();
    const budget = trimmed ? parseFloat(trimmed) : null;
    if (trimmed && (isNaN(budget!) || budget! < 0)) {
      setEditingId(null);
      return;
    }
    await updateCategoryBudget(id, budget);
    setEditingId(null);
    loadData();
  }

  const overallPct = totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0;
  const overallOver = totalBudget > 0 && totalSpent > totalBudget;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Overall Budget</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Budgeted</Text>
            <Text style={styles.summaryValue}>${totalBudget.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Spent</Text>
            <Text style={[styles.summaryValue, overallOver && styles.negative]}>
              ${totalSpent.toFixed(2)}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Remaining</Text>
            <Text
              style={[
                styles.summaryValue,
                totalBudget - totalSpent >= 0 ? styles.positive : styles.negative,
              ]}
            >
              ${(totalBudget - totalSpent).toFixed(2)}
            </Text>
          </View>
        </View>
        {totalBudget > 0 && (
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${overallPct}%`,
                  backgroundColor: overallOver ? "#dc2626" : "#16a34a",
                },
              ]}
            />
          </View>
        )}
      </View>

      <Text style={styles.sectionTitle}>Category Budgets</Text>

      {rows.map((row) => {
        const hasBudget = row.budgetAmount !== null && row.budgetAmount > 0;
        const isProfit = row.actual < 0;
        const pct = hasBudget && !isProfit ? Math.min((row.actual / row.budgetAmount!) * 100, 100) : 0;
        const over = hasBudget && row.actual > row.budgetAmount!;
        const isEditing = editingId === row.id;

        return (
          <View key={row.id} style={styles.catCard}>
            <View style={styles.catHeader}>
              <View>
                <Text style={styles.catName}>{row.name}</Text>
                <Text style={styles.catRule}>{row.rule}</Text>
              </View>
              {isEditing ? (
                <View style={styles.editRow}>
                  <Text style={styles.dollarSign}>$</Text>
                  <TextInput
                    style={styles.budgetInput}
                    value={editValue}
                    onChangeText={setEditValue}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    autoFocus
                    onBlur={() => saveEdit(row.id)}
                    onSubmitEditing={() => saveEdit(row.id)}
                  />
                </View>
              ) : (
                <Pressable onPress={() => startEdit(row)} style={styles.budgetDisplay}>
                  <Text style={styles.budgetText}>
                    {hasBudget ? `$${row.budgetAmount!.toFixed(2)}` : "Set budget"}
                  </Text>
                </Pressable>
              )}
            </View>

            {hasBudget && (
              <>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${pct}%`,
                        backgroundColor: over ? "#dc2626" : "#16a34a",
                      },
                    ]}
                  />
                </View>
                <Text style={styles.spentLabel}>
                  {isProfit
                    ? `Profit $${Math.abs(row.actual).toFixed(2)} of ${row.budgetAmount!.toFixed(2)} budget`
                    : `Spent $${row.actual.toFixed(2)} of $${row.budgetAmount!.toFixed(2)}${
                        over
                          ? ` (over by $${(row.actual - row.budgetAmount!).toFixed(2)})`
                          : ` (${pct.toFixed(0)}%)`
                      }`}
                </Text>
              </>
            )}
            {!hasBudget && row.actual !== 0 && (
              <Text style={styles.spentLabel}>
                {row.actual < 0
                  ? `Profit $${Math.abs(row.actual).toFixed(2)}`
                  : `Spent $${row.actual.toFixed(2)}`}
              </Text>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 16, paddingBottom: 40 },
  summaryCard: {
    backgroundColor: "#f0f4ff",
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#c7d2fe",
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e3a5f",
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  summaryItem: { alignItems: "center", flex: 1 },
  summaryLabel: { fontSize: 12, color: "#6b7280", marginBottom: 2 },
  summaryValue: { fontSize: 18, fontWeight: "700", color: "#111827" },
  positive: { color: "#16a34a" },
  negative: { color: "#dc2626" },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 10,
  },
  catCard: {
    backgroundColor: "#f9fafb",
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  catHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  catName: { fontSize: 15, fontWeight: "600", color: "#111827" },
  catRule: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  budgetDisplay: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#e5e7eb",
  },
  budgetText: { fontSize: 14, fontWeight: "600", color: "#374151" },
  editRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  dollarSign: { fontSize: 16, fontWeight: "600", color: "#374151", marginRight: 2 },
  budgetInput: {
    borderWidth: 1,
    borderColor: "#2563eb",
    borderRadius: 8,
    padding: 6,
    fontSize: 16,
    width: 90,
    backgroundColor: "#fff",
    textAlign: "right",
  },
  progressTrack: {
    height: 8,
    backgroundColor: "#e5e7eb",
    borderRadius: 4,
    marginTop: 10,
    overflow: "hidden",
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
  },
  spentLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 6,
  },
});
