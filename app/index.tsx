import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { C } from "../utils/colors";
import {
  getMonthOverviewData,
  hasMonthlyBudgets,
  getMostRecentMonthWithBudgets,
  copyBudgetsFromMonth,
  Category,
  Transaction,
} from "../db/queries";
import { getSignedAmount } from "../utils/signedAmount";
import { getCategoryDotColor } from "../utils/categoryColors";
import { useMonth } from "../utils/MonthContext";

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
function formatMonthLabel(month: string): string {
  const [year, mm] = month.split("-");
  return `${MONTH_NAMES[parseInt(mm, 10) - 1]} ${year}`;
}

interface CategorySpend {
  id: number;
  name: string;
  groupColor: string | null;
  groupName: string | null;
  spent: number;
}

interface RecentTx {
  id: number;
  description: string;
  amount: number;
  isIncome: boolean;
  date: string;
  categoryName: string;
  categoryColor: string | null;
  categoryGroupName: string | null;
}

function friendlyDate(dateStr: string): string {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
  if (dateStr === todayStr) return "Today";
  if (dateStr === yStr) return "Yesterday";
  const [, mm, dd] = dateStr.split("-");
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${monthNames[parseInt(mm) - 1]} ${parseInt(dd)}`;
}

export default function OverviewScreen() {
  const router = useRouter();
  const { month } = useMonth();
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalSpending, setTotalSpending] = useState(0);
  const [topCategories, setTopCategories] = useState<CategorySpend[]>([]);
  const [recentTxs, setRecentTxs] = useState<RecentTx[]>([]);
  const [txCount, setTxCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);

  const loadOverview = useCallback(async () => {
    const hasBudgets = await hasMonthlyBudgets(month);
    if (!hasBudgets) {
      const prevMonth = await getMostRecentMonthWithBudgets(month);
      if (prevMonth) await copyBudgetsFromMonth(prevMonth, month);
    }

    const { transactions, categories } = await getMonthOverviewData(month);

    const catMap: Record<number, Category> = {};
    for (const c of categories) catMap[c.id] = c;

    // Accumulate signed amounts per category
    const netByCategory: Record<number, number> = {};
    for (const tx of transactions) {
      const cat = catMap[tx.categoryId];
      if (!cat) continue;
      const signed = getSignedAmount(tx.amount, tx.isIncome === 1);
      netByCategory[tx.categoryId] = (netByCategory[tx.categoryId] ?? 0) + signed;
    }

    // Totals
    let income = 0;
    let spending = 0;
    for (const [catId, rawNet] of Object.entries(netByCategory)) {
      const cat = catMap[Number(catId)];
      if (!cat) continue;
      if (cat.rule === "income") income += rawNet;
      else spending += -rawNet;
    }

    // Top spending categories (by amount spent, descending)
    const catSpends: CategorySpend[] = [];
    for (const c of categories) {
      if (c.rule !== "spending") continue;
      const spent = -(netByCategory[c.id] ?? 0);
      if (spent === 0) continue;
      catSpends.push({
        id: c.id,
        name: c.name,
        groupColor: c.groupColor ?? null,
        groupName: c.groupName ?? null,
        spent,
      });
    }
    catSpends.sort((a, b) => b.spent - a.spent);

    // Recent transactions (latest 5)
    const recent: RecentTx[] = transactions.slice(0, 5).map((tx) => {
      const cat = catMap[tx.categoryId];
      return {
        id: tx.id,
        description: tx.description,
        amount: tx.amount,
        isIncome: tx.isIncome === 1,
        date: tx.date,
        categoryName: cat?.name ?? "Unknown",
        categoryColor: cat?.groupColor ?? null,
        categoryGroupName: cat?.groupName ?? null,
      };
    });

    setTotalIncome(income);
    setTotalSpending(spending);
    setTopCategories(catSpends);
    setRecentTxs(recent);
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
  const maxSpend = topCategories.length > 0 ? Math.max(...topCategories.map((c) => Math.abs(c.spent))) : 1;

  if (txCount === 0) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, styles.emptyContent]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={C.textTertiary} />}
      >
        <View style={styles.emptyState}>
          <Ionicons name="wallet-outline" size={48} color={C.textTertiary} />
          <Text style={styles.emptyTitle}>No transactions yet</Text>
          <Text style={styles.emptySubtext}>Add your first transaction to see your financial overview.</Text>
          <Pressable style={styles.emptyBtn} onPress={() => router.push("/add")}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.emptyBtnText}>Add Transaction</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={C.textTertiary} />}
    >
      {/* ── Hero net card ── */}
      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>Net Savings</Text>
        <Text style={[styles.heroAmount, net >= 0 ? styles.positive : styles.negative]}>
          {net >= 0 ? "+" : "-"}${Math.abs(net).toFixed(2)}
        </Text>
        <View style={styles.heroRow}>
          <View style={styles.heroItem}>
            <View style={styles.heroItemDot}>
              <Ionicons name="arrow-down-circle" size={14} color={C.positive} />
            </View>
            <View>
              <Text style={styles.heroItemLabel}>Income</Text>
              <Text style={[styles.heroItemValue, styles.positive]}>${totalIncome.toFixed(2)}</Text>
            </View>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroItem}>
            <View style={styles.heroItemDot}>
              <Ionicons name="arrow-up-circle" size={14} color={totalSpending < 0 ? C.positive : C.negative} />
            </View>
            <View>
              <Text style={styles.heroItemLabel}>Spending</Text>
              <Text style={[styles.heroItemValue, totalSpending < 0 ? styles.positive : styles.negative]}>
                ${Math.abs(totalSpending).toFixed(2)}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* ── Top spending categories ── */}
      {topCategories.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Spending Breakdown</Text>
            {topCategories.length > 4 && (
              <Pressable onPress={() => setShowAllCategories((p) => !p)}>
                <Text style={styles.seeAll}>{showAllCategories ? "Show less" : "See all"}</Text>
              </Pressable>
            )}
          </View>
          <View style={styles.card}>
            {(showAllCategories ? topCategories : topCategories.slice(0, 4)).map((cat, i) => {
              const color = getCategoryDotColor(cat.groupColor, cat.groupName);
              const barPct = Math.abs(cat.spent) / maxSpend;
              const isProfit = cat.spent < 0;
              return (
                <View key={cat.id}>
                  {i > 0 && <View style={styles.rowDivider} />}
                  <View style={styles.categoryRow}>
                    <View style={[styles.categoryDot, { backgroundColor: color }]} />
                    <Text style={styles.categoryName} numberOfLines={1}>{cat.name}</Text>
                    <Text style={[styles.categoryAmount, isProfit && styles.positive]}>
                      {isProfit ? `+$${Math.abs(cat.spent).toFixed(2)}` : `$${cat.spent.toFixed(2)}`}
                    </Text>
                  </View>
                  <View style={styles.categoryBarTrack}>
                    <View
                      style={[
                        styles.categoryBarFill,
                        { width: `${barPct * 100}%`, backgroundColor: isProfit ? C.positive : color },
                      ]}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* ── Recent transactions ── */}
      {recentTxs.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent</Text>
            <Pressable onPress={() => router.navigate("/transactions")}>
              <Text style={styles.seeAll}>See all</Text>
            </Pressable>
          </View>
          <View style={styles.card}>
            {recentTxs.map((tx, i) => {
              const color = getCategoryDotColor(tx.categoryColor, tx.categoryGroupName);
              return (
                <View key={tx.id}>
                  {i > 0 && <View style={styles.rowDivider} />}
                  <View style={styles.txRow}>
                    <View style={[styles.txIconWrap, { backgroundColor: color + "22" }]}>
                      <Ionicons
                        name={tx.isIncome ? "arrow-down" : "arrow-up"}
                        size={14}
                        color={tx.isIncome ? C.positive : color}
                      />
                    </View>
                    <View style={styles.txMeta}>
                      <Text style={styles.txDesc} numberOfLines={1}>{tx.description}</Text>
                      <Text style={styles.txSub}>{tx.categoryName} · {friendlyDate(tx.date)}</Text>
                    </View>
                    <Text style={[styles.txAmount, tx.isIncome ? styles.positive : styles.txSpend]}>
                      {tx.isIncome ? "+" : "-"}${tx.amount.toFixed(2)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingBottom: 40 },

  // Hero
  heroCard: {
    backgroundColor: C.cardElevated,
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  heroMonth: {
    fontSize: 13,
    fontWeight: "500",
    color: C.textTertiary,
    marginBottom: 12,
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: C.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  heroAmount: {
    fontSize: 48,
    fontWeight: "700",
    letterSpacing: -1,
    marginBottom: 20,
  },
  heroRow: {
    flexDirection: "row",
    width: "100%",
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
  },
  heroItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  heroItemDot: { width: 24, alignItems: "center" },
  heroItemLabel: { fontSize: 11, color: C.textTertiary, marginBottom: 2 },
  heroItemValue: { fontSize: 16, fontWeight: "700" },
  heroDivider: { width: 1, backgroundColor: C.separator, marginHorizontal: 12 },

  // Sections
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: C.textPrimary, marginBottom: 10 },
  seeAll: { fontSize: 14, fontWeight: "600", color: C.accent },
  card: {
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
  },
  rowDivider: { height: 1, backgroundColor: C.separator, marginLeft: 16 },

  // Category rows
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
    gap: 8,
  },
  categoryDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  categoryName: { flex: 1, fontSize: 14, fontWeight: "500", color: C.textPrimary },
  categoryAmount: { fontSize: 14, fontWeight: "700", color: C.textPrimary },
  categoryBarTrack: {
    height: 3,
    backgroundColor: C.separator,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 2,
    overflow: "hidden",
  },
  categoryBarFill: { height: 3, borderRadius: 2 },
  moreText: { fontSize: 13, color: C.textTertiary, textAlign: "center", paddingVertical: 10 },

  // Transaction rows
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  txIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  txMeta: { flex: 1 },
  txDesc: { fontSize: 14, fontWeight: "600", color: C.textPrimary },
  txSub: { fontSize: 12, color: C.textTertiary, marginTop: 1 },
  txAmount: { fontSize: 14, fontWeight: "700" },
  txSpend: { color: C.textPrimary },

  // Semantic
  positive: { color: C.positive },
  negative: { color: C.negative },

  // Empty state
  emptyContent: { flex: 1, justifyContent: "center" },
  emptyState: { alignItems: "center", padding: 32, gap: 8 },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: C.textPrimary, marginTop: 8 },
  emptySubtext: { fontSize: 14, color: C.textTertiary, textAlign: "center", lineHeight: 20 },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 16,
    backgroundColor: C.accent,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  emptyBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
