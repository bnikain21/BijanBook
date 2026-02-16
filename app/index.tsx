import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import {
  getMonthOverviewData,
  hasMonthlyBudgets,
  getMostRecentMonthWithBudgets,
  copyBudgetsFromMonth,
  Category,
  MonthlyBudget,
} from "../db/queries";
import { getSignedAmount } from "../utils/signedAmount";
import { useMonth } from "../utils/MonthContext";

interface CategoryBudgetData {
  id: number;
  name: string;
  rule: "income" | "spending";
  spent: number;
  budgetAmount: number | null;
  pctUsed: number;
}

export default function OverviewScreen() {
  const { month } = useMonth();
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalSpending, setTotalSpending] = useState(0);
  const [totalBudgeted, setTotalBudgeted] = useState(0);
  const [spendingCategories, setSpendingCategories] = useState<CategoryBudgetData[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<CategoryBudgetData[]>([]);
  const [txCount, setTxCount] = useState(0);

  const loadOverview = useCallback(async () => {
    // Auto-copy budgets from previous month if this month has none
    const hasBudgets = await hasMonthlyBudgets(month);
    if (!hasBudgets) {
      const prevMonth = await getMostRecentMonthWithBudgets(month);
      if (prevMonth) await copyBudgetsFromMonth(prevMonth, month);
    }

    const { transactions, categories, budgets } = await getMonthOverviewData(month);
    const catMap: Record<number, Category> = {};
    for (const c of categories) catMap[c.id] = c;

    // Build a budget lookup from monthly_budgets
    const budgetMap: Record<number, number> = {};
    for (const b of budgets) budgetMap[b.categoryId] = b.budgetAmount;

    // Accumulate per-category signed amounts
    const spentByCategory: Record<number, number> = {};
    for (const tx of transactions) {
      const cat = catMap[tx.categoryId];
      if (!cat) continue;
      const signed = getSignedAmount(tx.amount, tx.isIncome === 1);
      spentByCategory[tx.categoryId] = (spentByCategory[tx.categoryId] ?? 0) + signed;
    }

    // Derive income/spending from category aggregates
    let income = 0;
    let spending = 0;
    for (const [catId, rawNet] of Object.entries(spentByCategory)) {
      const cat = catMap[Number(catId)];
      if (!cat) continue;
      if (cat.rule === "income") {
        income += rawNet;           // positive = earned
      } else {
        spending += -rawNet;   // negative rawNet = money out, positive rawNet = profit (reduces spending)
      }
    }

    let budgeted = 0;
    const spendingCats: CategoryBudgetData[] = [];
    const incomeCats: CategoryBudgetData[] = [];

    for (const c of categories) {
      const rawNet = spentByCategory[c.id] ?? 0;
      const spent = c.rule === "spending" ? -rawNet : rawNet;
      const catBudget = budgetMap[c.id] ?? null;
      if (spent === 0 && (catBudget === null || catBudget === 0)) continue;

      const hasBudget = catBudget !== null && catBudget > 0;
      const pctUsed = hasBudget ? (spent / catBudget!) * 100 : 0;

      const row: CategoryBudgetData = {
        id: c.id,
        name: c.name,
        rule: c.rule,
        spent,
        budgetAmount: catBudget,
        pctUsed,
      };

      if (c.rule === "income") {
        incomeCats.push(row);
      } else {
        spendingCats.push(row);
        if (hasBudget) budgeted += catBudget!;
      }
    }

    spendingCats.sort((a, b) => {
      const aHasBudget = a.budgetAmount !== null && a.budgetAmount > 0;
      const bHasBudget = b.budgetAmount !== null && b.budgetAmount > 0;
      if (aHasBudget && !bHasBudget) return -1;
      if (!aHasBudget && bHasBudget) return 1;
      if (aHasBudget && bHasBudget) {
        const aOver = a.pctUsed > 100 ? 1 : 0;
        const bOver = b.pctUsed > 100 ? 1 : 0;
        if (aOver !== bOver) return bOver - aOver;
        return b.pctUsed - a.pctUsed;
      }
      return b.spent - a.spent;
    });

    setTotalIncome(income);
    setTotalSpending(spending);
    setTotalBudgeted(budgeted);
    setSpendingCategories(spendingCats);
    setIncomeCategories(incomeCats);
    setTxCount(transactions.length);
  }, [month]);

  useFocusEffect(
    useCallback(() => {
      loadOverview();
    }, [loadOverview])
  );

  const net = totalIncome - totalSpending;
  const overallPct = totalBudgeted > 0 ? Math.min((totalSpending / totalBudgeted) * 100, 100) : 0;
  const overallOver = totalBudgeted > 0 && totalSpending > totalBudgeted;

  function getBarColor(pct: number): string {
    if (pct > 100) return "#dc2626";
    if (pct >= 75) return "#f59e0b";
    return "#16a34a";
  }

  const budgetedCats = spendingCategories.filter(
    (c) => c.budgetAmount !== null && c.budgetAmount > 0
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Top Summary Card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Income</Text>
            <Text style={[styles.summaryValue, styles.positive]}>
              ${totalIncome.toFixed(2)}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Spending</Text>
            <Text style={[styles.summaryValue, styles.negative]}>
              ${totalSpending.toFixed(2)}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Net</Text>
            <Text style={[styles.summaryValue, net >= 0 ? styles.positive : styles.negative]}>
              {net >= 0 ? "+" : "-"}${Math.abs(net).toFixed(2)}
            </Text>
          </View>
        </View>
        {totalBudgeted > 0 && (
          <>
            <View style={styles.overallProgressTrack}>
              <View
                style={[
                  styles.overallProgressFill,
                  {
                    width: `${overallPct}%`,
                    backgroundColor: overallOver ? "#dc2626" : "#16a34a",
                  },
                ]}
              />
            </View>
            <Text style={styles.overallProgressLabel}>
              ${totalSpending.toFixed(2)} of ${totalBudgeted.toFixed(2)} budgeted
              {overallOver
                ? ` (over by $${(totalSpending - totalBudgeted).toFixed(2)})`
                : ` (${overallPct.toFixed(0)}%)`}
            </Text>
          </>
        )}
      </View>

      {/* Budget vs Actual Bar Chart */}
      {budgetedCats.length > 0 && (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Budget vs Actual</Text>
          {budgetedCats.map((cat) => {
            const actualWidth = cat.spent > 0 ? Math.min(cat.pctUsed, 100) : 0;
            const over = cat.pctUsed > 100;
            return (
              <View key={cat.id} style={styles.chartRow}>
                <Text style={styles.chartLabel} numberOfLines={1}>
                  {cat.name}
                </Text>
                <View style={styles.chartBars}>
                  <View style={styles.chartBarTrack}>
                    {/* Budget bar = always 100% */}
                    <View style={[styles.budgetBar, { width: "100%" }]} />
                    <View
                      style={[
                        styles.actualBar,
                        {
                          width: `${actualWidth}%`,
                          backgroundColor: over ? "#dc2626" : getBarColor(cat.pctUsed),
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.chartPct, over && styles.negative]}>
                    {cat.pctUsed.toFixed(0)}%
                  </Text>
                </View>
              </View>
            );
          })}
          <View style={styles.chartLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#dbeafe" }]} />
              <Text style={styles.legendText}>Budget</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#16a34a" }]} />
              <Text style={styles.legendText}>Actual</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#dc2626" }]} />
              <Text style={styles.legendText}>Over Budget</Text>
            </View>
          </View>
        </View>
      )}

      {/* Spending Category Detail Cards */}
      {spendingCategories.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Spending by Category</Text>
          {spendingCategories.map((cat) => {
            const hasBudget = cat.budgetAmount !== null && cat.budgetAmount > 0;
            const isProfit = cat.spent < 0;
            const displayPct = hasBudget && !isProfit ? Math.min(cat.pctUsed, 100) : 0;
            const over = hasBudget && cat.pctUsed > 100;
            const remaining = hasBudget ? cat.budgetAmount! - cat.spent : 0;

            return (
              <View key={cat.id} style={styles.catCard}>
                <View style={styles.catHeader}>
                  <Text style={styles.catName}>{cat.name}</Text>
                  <Text style={[styles.catAmounts, isProfit && styles.positive]}>
                    {isProfit ? "-" : ""}${Math.abs(cat.spent).toFixed(2)}
                    {hasBudget && (
                      <Text style={styles.catBudgetLabel}> / ${cat.budgetAmount!.toFixed(2)}</Text>
                    )}
                  </Text>
                </View>
                {hasBudget && (
                  <>
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${displayPct}%`,
                            backgroundColor: getBarColor(cat.pctUsed),
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.remainingText, over && styles.negative]}>
                      {over
                        ? `Over by $${Math.abs(remaining).toFixed(2)}`
                        : `$${remaining.toFixed(2)} remaining`}
                    </Text>
                  </>
                )}
              </View>
            );
          })}
        </>
      )}

      {/* Income Categories */}
      {incomeCategories.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Income</Text>
          {incomeCategories.map((cat) => (
            <View key={cat.id} style={styles.catCard}>
              <View style={styles.catHeader}>
                <Text style={styles.catName}>{cat.name}</Text>
                <Text style={[styles.catAmounts, styles.positive]}>
                  +${cat.spent.toFixed(2)}
                </Text>
              </View>
            </View>
          ))}
        </>
      )}

      {txCount === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            Add some transactions to see your overview.
          </Text>
        </View>
      )}
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
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  summaryItem: { alignItems: "center", flex: 1 },
  summaryLabel: { fontSize: 12, color: "#6b7280", marginBottom: 2 },
  summaryValue: { fontSize: 18, fontWeight: "700", color: "#111827" },
  positive: { color: "#16a34a" },
  negative: { color: "#dc2626" },
  overallProgressTrack: {
    height: 8,
    backgroundColor: "#e5e7eb",
    borderRadius: 4,
    marginTop: 14,
    overflow: "hidden",
  },
  overallProgressFill: {
    height: 8,
    borderRadius: 4,
  },
  overallProgressLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 6,
    textAlign: "center",
  },
  // Bar chart styles
  chartCard: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 14,
  },
  chartRow: {
    marginBottom: 12,
  },
  chartLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 4,
  },
  chartBars: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  chartBarTrack: {
    flex: 1,
    height: 20,
    backgroundColor: "#f3f4f6",
    borderRadius: 4,
    overflow: "hidden",
    position: "relative",
  },
  budgetBar: {
    position: "absolute",
    top: 0,
    left: 0,
    height: 20,
    backgroundColor: "#dbeafe",
    borderRadius: 4,
  },
  actualBar: {
    position: "absolute",
    top: 0,
    left: 0,
    height: 20,
    borderRadius: 4,
  },
  chartPct: {
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
    width: 42,
    textAlign: "right",
  },
  chartLegend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 11,
    color: "#6b7280",
  },
  // Category detail cards
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 10,
    marginTop: 4,
  },
  catCard: {
    backgroundColor: "#f9fafb",
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  catHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  catName: { fontSize: 15, fontWeight: "600", color: "#111827" },
  catAmounts: { fontSize: 15, fontWeight: "700", color: "#111827" },
  catBudgetLabel: { fontSize: 13, fontWeight: "400", color: "#6b7280" },
  progressTrack: {
    height: 6,
    backgroundColor: "#e5e7eb",
    borderRadius: 3,
    marginTop: 10,
    overflow: "hidden",
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
  },
  remainingText: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 6,
  },
  empty: { marginTop: 40, alignItems: "center" },
  emptyText: { fontSize: 15, color: "#9ca3af" },
});
