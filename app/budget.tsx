import { useCallback, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "expo-router";
import { INCOME_COLOR } from "../utils/categoryColors";
import { C } from "../utils/colors";
import { AnimatedBar } from "../components/AnimatedBar";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  getAllCategories,
  getTransactionsByMonth,
  getMonthlyBudgets,
  setMonthlyBudget,
  hasMonthlyBudgets,
  getMostRecentMonthWithBudgets,
  copyBudgetsFromMonth,
  getCategoryGroups,
  Category,
  CategoryGroup,
} from "../db/queries";
import { getSignedAmount } from "../utils/signedAmount";
import { useMonth } from "../utils/MonthContext";

interface BudgetRow {
  id: number;
  name: string;
  rule: "income" | "spending";
  budgetAmount: number | null;
  actual: number;
  groupId: number | null;
  groupName: string | null;
  groupColor: string | null;
}

interface GroupSection {
  key: string;
  label: string;
  budgeted: number;
  spent: number;
  rows: BudgetRow[];
  color: string | null;
}

function buildGroupSections(rows: BudgetRow[], groups: CategoryGroup[]): GroupSection[] {
  const groupMap: Record<string, GroupSection> = {};

  // Named groups
  for (const g of groups) {
    groupMap[String(g.id)] = {
      key: String(g.id),
      label: g.name,
      budgeted: 0,
      spent: 0,
      rows: [],
      color: g.color ?? null,
    };
  }
  // Unassigned bucket
  groupMap["unassigned"] = { key: "unassigned", label: "Unassigned", budgeted: 0, spent: 0, rows: [], color: null };
  // Income bucket — always green, always at top
  groupMap["income"] = { key: "income", label: "Income", budgeted: 0, spent: 0, rows: [], color: INCOME_COLOR };

  for (const row of rows) {
    if (row.rule === "income") {
      groupMap["income"].rows.push(row);
      if (row.budgetAmount) groupMap["income"].budgeted += row.budgetAmount;
      if (row.actual > 0) groupMap["income"].spent += row.actual;
    } else {
      const key = row.groupId !== null ? String(row.groupId) : "unassigned";
      const bucket = groupMap[key] ?? groupMap["unassigned"];
      bucket.rows.push(row);
      if (row.budgetAmount) bucket.budgeted += row.budgetAmount;
      if (row.actual > 0) bucket.spent += row.actual;
    }
  }

  // Income first, then named groups (sorted from DB), then Unassigned last
  const named = groups.map((g) => groupMap[String(g.id)]).filter((s) => s.rows.length > 0);
  const result: GroupSection[] = [];
  if (groupMap["income"].rows.length > 0) result.push(groupMap["income"]);
  result.push(...named);
  if (groupMap["unassigned"].rows.length > 0) result.push(groupMap["unassigned"]);
  return result;
}

export default function BudgetScreen() {
  const router = useRouter();
  const { month } = useMonth();
  const [rows, setRows] = useState<BudgetRow[]>([]);
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [totalBudget, setTotalBudget] = useState(0);
  const [totalSpent, setTotalSpent] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    const hasBudgets = await hasMonthlyBudgets(month);
    if (!hasBudgets) {
      const prevMonth = await getMostRecentMonthWithBudgets(month);
      if (prevMonth) await copyBudgetsFromMonth(prevMonth, month);
    }

    const [categories, transactions, budgets, grps] = await Promise.all([
      getAllCategories(),
      getTransactionsByMonth(month),
      getMonthlyBudgets(month),
      getCategoryGroups(),
    ]);

    const catMap: Record<number, Category> = {};
    for (const c of categories) catMap[c.id] = c;

    const budgetMap: Record<number, number> = {};
    for (const b of budgets) budgetMap[b.categoryId] = b.budgetAmount;

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
        budgetAmount: budgetMap[c.id] ?? null,
        actual: c.rule === "spending" ? -rawNet : rawNet,
        groupId: c.groupId ?? null,
        groupName: c.groupName ?? null,
        groupColor: c.groupColor ?? null,
      };
    });

    let tBudget = 0;
    let tSpent = 0;
    for (const r of budgetRows) {
      if (r.rule === "spending" && r.budgetAmount !== null && r.budgetAmount > 0) tBudget += r.budgetAmount;
      if (r.rule === "spending" && r.actual > 0) tSpent += r.actual;
    }

    setRows(budgetRows);
    setGroups(grps);
    setTotalBudget(tBudget);
    setTotalSpent(tSpent);
  }, [month]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  async function handleRefresh() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }

  function toggleGroup(key: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

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
    await setMonthlyBudget(id, month, budget);
    setEditingId(null);
    loadData();
  }

  function renderCatCard(row: BudgetRow) {
    const hasBudget = row.budgetAmount !== null && row.budgetAmount > 0;
    const isProfit = row.actual < 0;
    const pct = hasBudget && !isProfit ? Math.min((row.actual / row.budgetAmount!) * 100, 100) : 0;
    const over = hasBudget && row.actual > row.budgetAmount!;
    const isEditing = editingId === row.id;
    const accentColor = row.rule === "income" ? INCOME_COLOR : (row.groupColor ?? null);
    const cardBg = accentColor ? accentColor + "33" : C.card;

    return (
      <View key={row.id} style={[styles.catCard, { backgroundColor: cardBg }]}>
        <View style={styles.catHeader}>
          <View style={styles.catNameCol}>
            <View style={styles.catNameRow}>
              <Text style={styles.catName}>{row.name}</Text>
            </View>
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
                placeholderTextColor={C.textTertiary}
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
            <AnimatedBar
              pct={pct}
              color={over ? "#dc2626" : "#16a34a"}
              height={8}
              trackStyle={styles.progressTrack}
            />
            <Text style={styles.spentLabel}>
              {isProfit
                ? `Profit $${Math.abs(row.actual).toFixed(2)} of $${row.budgetAmount!.toFixed(2)} budget`
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
  }

  const overallPct = totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0;
  const overallOver = totalBudget > 0 && totalSpent > totalBudget;
  const sections = buildGroupSections(rows, groups);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={C.textTertiary} />}
    >
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
            <Text style={[styles.summaryValue, totalBudget - totalSpent >= 0 ? styles.positive : styles.negative]}>
              ${(totalBudget - totalSpent).toFixed(2)}
            </Text>
          </View>
        </View>
        {totalBudget > 0 && (
          <AnimatedBar
            pct={overallPct}
            color={overallOver ? "#dc2626" : "#16a34a"}
            height={8}
            trackStyle={styles.progressTrack}
          />
        )}
      </View>

      <Text style={styles.sectionTitle}>Category Budgets</Text>

      {rows.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No categories set up yet.</Text>
          <Text style={styles.emptySubtext}>Set up categories first to start budgeting.</Text>
          <Pressable style={styles.emptyBtn} onPress={() => router.push("/categories")}>
            <Text style={styles.emptyBtnText}>Manage Categories</Text>
          </Pressable>
        </View>
      )}

      {sections.map((section) => {
            const expanded = expandedGroups.has(section.key);
            const isIncome = section.key === "income";
            const pct = section.budgeted > 0
              ? Math.min((section.spent / section.budgeted) * 100, 100)
              : 0;
            const over = !isIncome && section.budgeted > 0 && section.spent > section.budgeted;
            const remaining = section.budgeted - section.spent;
            const barColor = section.color ?? (over ? "#dc2626" : "#16a34a");

            const headerBg = section.color ? section.color + "33" : C.cardElevated;

            return (
              <View key={section.key} style={styles.groupBlock}>
                {/* Single connected card */}
                <Pressable
                  style={[styles.groupHeader, { backgroundColor: headerBg }]}
                  onPress={() => toggleGroup(section.key)}
                >
                  <View style={styles.groupHeaderTop}>
                    <Text style={styles.groupName}>{section.label}</Text>
                    <Ionicons
                      name={expanded ? "chevron-up" : "chevron-down"}
                      size={16}
                      color="#9ca3af"
                    />
                  </View>
                  <View style={styles.groupSummary}>
                    <View style={styles.groupSummaryItem}>
                      <Text style={styles.groupSummaryLabel}>Expected</Text>
                      <Text style={styles.groupSummaryValue}>${section.budgeted.toFixed(0)}</Text>
                    </View>
                    <View style={styles.groupSummaryItem}>
                      <Text style={styles.groupSummaryLabel}>Actual</Text>
                      <Text style={[styles.groupSummaryValue, over ? styles.negative : styles.positive]}>
                        ${section.spent.toFixed(0)}
                      </Text>
                    </View>
                    <View style={styles.groupSummaryItem}>
                      <Text style={styles.groupSummaryLabel}>Difference</Text>
                      <Text style={[
                        styles.groupSummaryValue,
                        remaining < 0 ? styles.negative : remaining > 0 ? styles.positive : styles.neutral,
                      ]}>
                        {remaining >= 0 ? "+" : "-"}${Math.abs(remaining).toFixed(0)}
                      </Text>
                    </View>
                  </View>
                  {section.budgeted > 0 && (
                    <AnimatedBar
                      pct={pct}
                      color={barColor}
                      height={6}
                      trackStyle={styles.groupProgressTrack}
                    />
                  )}
                </Pressable>
                {expanded && section.rows.map((row) => renderCatCard(row))}
              </View>
            );
          })}
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
  summaryTitle: { fontSize: 18, fontWeight: "700", color: C.textPrimary, marginBottom: 12 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between" },
  summaryItem: { alignItems: "center", flex: 1 },
  summaryLabel: { fontSize: 12, color: C.textSecondary, marginBottom: 2 },
  summaryValue: { fontSize: 18, fontWeight: "700", color: C.textPrimary },
  positive: { color: C.positive },
  negative: { color: C.negative },
  neutral: { color: C.textPrimary },
  sectionTitle: { fontSize: 16, fontWeight: "600", color: C.textSecondary, marginBottom: 10 },
  groupBlock: {
    marginBottom: 12,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  groupHeader: { padding: 14 },
  groupHeaderTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  groupName: { fontSize: 16, fontWeight: "700", color: C.textPrimary },
  groupSummary: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  groupSummaryItem: { alignItems: "center", flex: 1 },
  groupSummaryLabel: { fontSize: 11, color: C.textSecondary, marginBottom: 2 },
  groupSummaryValue: { fontSize: 14, fontWeight: "700", color: C.textPrimary },
  groupProgressTrack: { height: 6, backgroundColor: C.separator, borderRadius: 3, overflow: "hidden" },
  catCard: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: C.separator,
  },
  catHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  catNameCol: {},
  catNameRow: { flexDirection: "row", alignItems: "center" },
  catName: { fontSize: 15, fontWeight: "600", color: C.textPrimary },
  budgetDisplay: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: C.cardElevated },
  budgetText: { fontSize: 14, fontWeight: "600", color: C.textPrimary },
  editRow: { flexDirection: "row", alignItems: "center" },
  dollarSign: { fontSize: 16, fontWeight: "600", color: C.textPrimary, marginRight: 2 },
  budgetInput: {
    borderWidth: 1,
    borderColor: C.accent,
    borderRadius: 8,
    padding: 6,
    fontSize: 16,
    width: 90,
    backgroundColor: C.card,
    color: C.textPrimary,
    textAlign: "right",
  },
  progressTrack: { height: 8, backgroundColor: C.separator, borderRadius: 4, marginTop: 10, overflow: "hidden" },
  spentLabel: { fontSize: 12, color: C.textSecondary, marginTop: 6 },
  empty: { marginTop: 40, alignItems: "center", padding: 16 },
  emptyText: { fontSize: 16, color: C.textSecondary, fontWeight: "500", textAlign: "center" },
  emptySubtext: { fontSize: 14, color: C.textTertiary, marginTop: 6, textAlign: "center" },
  emptyBtn: { marginTop: 20, backgroundColor: C.accent, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 28 },
  emptyBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
