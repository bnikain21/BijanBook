import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { AnimatedBar } from "../components/AnimatedBar";
import { useFocusEffect, useRouter } from "expo-router";
import { C } from "../utils/colors";
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
  groupName: string | null;
  groupColor: string | null;
  rule: "income" | "spending";
  spent: number;
  budgetAmount: number | null;
  pctUsed: number;
}

export default function OverviewScreen() {
  const router = useRouter();
  const { month } = useMonth();
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalSpending, setTotalSpending] = useState(0);
  const [totalBudgeted, setTotalBudgeted] = useState(0);
  const [spendingCategories, setSpendingCategories] = useState<CategoryBudgetData[]>([]);
  const [txCount, setTxCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

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

    for (const c of categories) {
      if (c.rule !== "spending") continue;
      const rawNet = spentByCategory[c.id] ?? 0;
      const spent = -rawNet;
      const catBudget = budgetMap[c.id] ?? null;
      if (spent === 0 && (catBudget === null || catBudget === 0)) continue;

      const hasBudget = catBudget !== null && catBudget > 0;
      const pctUsed = hasBudget ? (spent / catBudget!) * 100 : 0;
      if (hasBudget) budgeted += catBudget!;

      spendingCats.push({
        id: c.id,
        name: c.name,
        groupName: c.groupName ?? null,
        groupColor: c.groupColor ?? null,
        rule: c.rule,
        spent,
        budgetAmount: catBudget,
        pctUsed,
      });
    }

    // Sort: budgeted first (highest pct used / over first), then unbudgeted
    spendingCats.sort((a, b) => {
      const aHas = a.budgetAmount !== null && a.budgetAmount > 0;
      const bHas = b.budgetAmount !== null && b.budgetAmount > 0;
      if (aHas && !bHas) return -1;
      if (!aHas && bHas) return 1;
      if (aHas && bHas) {
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
    setTxCount(transactions.length);
  }, [month]);

  useFocusEffect(
    useCallback(() => {
      loadOverview();
    }, [loadOverview])
  );

  async function handleRefresh() {
    setRefreshing(true);
    await loadOverview();
    setRefreshing(false);
  }

  const net = totalIncome - totalSpending;
  const overallPct = totalBudgeted > 0 ? Math.min((totalSpending / totalBudgeted) * 100, 100) : 0;
  const overallOver = totalBudgeted > 0 && totalSpending > totalBudgeted;

  function getBarColor(pct: number): string {
    if (pct > 100) return C.negative;
    if (pct >= 75) return C.warning;
    return C.positive;
  }

  const budgetedCats = spendingCategories.filter(
    (c) => c.budgetAmount !== null && c.budgetAmount > 0
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={C.textTertiary} />}
    >
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
            <AnimatedBar
              pct={overallPct}
              color={overallOver ? C.negative : C.positive}
              height={8}
              trackStyle={styles.overallProgressTrack}
            />
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
                <View style={styles.chartLabelRow}>
                  <Text style={styles.chartLabel} numberOfLines={1}>
                    {cat.name}
                  </Text>
                </View>
                <View style={styles.chartBars}>
                  <AnimatedBar
                    pct={actualWidth}
                    color={over ? C.negative : getBarColor(cat.pctUsed)}
                    height={20}
                    trackStyle={styles.budgetTrack}
                  />
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

      {txCount === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No transactions this month.</Text>
          <Text style={styles.emptySubtext}>Add your first transaction to see your overview.</Text>
          <Pressable style={styles.emptyBtn} onPress={() => router.push("/add")}>
            <Text style={styles.emptyBtnText}>Add Transaction</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingBottom: 40 },
  summaryCard: {
    backgroundColor: C.cardElevated,
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: C.border,
  },
  summaryRow: { flexDirection: "row", justifyContent: "space-between" },
  summaryItem: { alignItems: "center", flex: 1 },
  summaryLabel: { fontSize: 12, color: C.textSecondary, marginBottom: 2 },
  summaryValue: { fontSize: 18, fontWeight: "700", color: C.textPrimary },
  positive: { color: C.positive },
  negative: { color: C.negative },
  overallProgressTrack: {
    height: 8,
    backgroundColor: C.separator,
    borderRadius: 4,
    marginTop: 14,
    overflow: "hidden",
  },
  overallProgressLabel: { fontSize: 12, color: C.textSecondary, marginTop: 6, textAlign: "center" },
  chartCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: C.border,
  },
  chartTitle: { fontSize: 16, fontWeight: "700", color: C.textPrimary, marginBottom: 14 },
  chartRow: { marginBottom: 12 },
  chartLabelRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  chartLabel: { fontSize: 13, fontWeight: "600", color: C.textPrimary, flex: 1 },
  chartBars: { flexDirection: "row", alignItems: "center", gap: 8 },
  budgetTrack: { flex: 1, backgroundColor: "rgba(59,130,246,0.2)" },
  chartPct: { fontSize: 13, fontWeight: "700", color: C.textPrimary, width: 42, textAlign: "right" },
  chartLegend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: C.separator,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 2 },
  legendText: { fontSize: 11, color: C.textSecondary },
  empty: { marginTop: 40, alignItems: "center", padding: 16 },
  emptyText: { fontSize: 16, color: C.textSecondary, fontWeight: "500", textAlign: "center" },
  emptySubtext: { fontSize: 14, color: C.textTertiary, marginTop: 6, textAlign: "center" },
  emptyBtn: { marginTop: 20, backgroundColor: C.accent, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 28 },
  emptyBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
