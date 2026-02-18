import { useCallback, useMemo, useRef, useState } from "react";
import { Alert, Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { getTransactionsByMonth, getAllCategories, deleteTransaction, Transaction, Category } from "../db/queries";
import { useMonth } from "../utils/MonthContext";
import { useFilters } from "../utils/FilterContext";
import { getCategoryDotColor } from "../utils/categoryColors";
import { C } from "../utils/colors";

interface Section {
  title: string;
  data: Transaction[];
}

function formatSectionTitle(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (year === today.getFullYear() && month === today.getMonth() + 1 && day === today.getDate()) return "Today";
  if (year === yesterday.getFullYear() && month === yesterday.getMonth() + 1 && day === yesterday.getDate()) return "Yesterday";
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default function TransactionsScreen() {
  const router = useRouter();
  const { month } = useMonth();
  const { selectedCategory, selectedAccount } = useFilters();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categoryMap, setCategoryMap] = useState<Record<number, Category>>({});
  const [refreshing, setRefreshing] = useState(false);
  const swipeableRefs = useRef<Map<number, Swipeable>>(new Map());

  const loadData = useCallback(async () => {
    const [txs, cats] = await Promise.all([getTransactionsByMonth(month), getAllCategories()]);
    setTransactions(txs);
    const map: Record<number, Category> = {};
    for (const c of cats) map[c.id] = c;
    setCategoryMap(map);
  }, [month]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  async function handleRefresh() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (selectedCategory !== null && tx.categoryId !== selectedCategory) return false;
      if (selectedAccount !== null && tx.account !== selectedAccount) return false;
      return true;
    });
  }, [transactions, selectedCategory, selectedAccount]);

  const sections = useMemo((): Section[] => {
    const groups: Record<string, Transaction[]> = {};
    for (const tx of filteredTransactions) {
      const date = tx.date.slice(0, 10);
      if (!groups[date]) groups[date] = [];
      groups[date].push(tx);
    }
    return Object.entries(groups)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, data]) => ({ title: formatSectionTitle(date), data }));
  }, [filteredTransactions]);

  const activeFilterCount = (selectedCategory !== null ? 1 : 0) + (selectedAccount !== null ? 1 : 0);

  function handleDelete(tx: Transaction) {
    swipeableRefs.current.get(tx.id)?.close();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      "Delete Transaction",
      `Delete "${tx.description}" for $${tx.amount.toFixed(2)}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteTransaction(tx.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            loadData();
          },
        },
      ]
    );
  }

  function handleEdit(tx: Transaction) {
    router.push(`/edit?id=${tx.id}`);
  }

  function renderRightActions(tx: Transaction) {
    return (
      <Pressable style={styles.deleteAction} onPress={() => handleDelete(tx)}>
        <Text style={styles.deleteActionText}>Delete</Text>
      </Pressable>
    );
  }

  function renderItem({ item }: { item: Transaction }) {
    const cat = categoryMap[item.categoryId];
    const isIncome = item.isIncome === 1;
    return (
      <Swipeable
        ref={(ref) => {
          if (ref) swipeableRefs.current.set(item.id, ref);
          else swipeableRefs.current.delete(item.id);
        }}
        renderRightActions={() => renderRightActions(item)}
        overshootRight={false}
      >
        <Pressable style={styles.row} onPress={() => handleEdit(item)}>
          <View style={styles.rowTop}>
            <Text style={styles.description} numberOfLines={1}>{item.description}</Text>
            <Text style={[styles.amount, isIncome ? styles.incomeAmount : styles.spendingAmount]}>
              {isIncome ? "+" : "-"}${item.amount.toFixed(2)}
            </Text>
          </View>
          <View style={styles.rowBottom}>
            <View style={styles.metaRow}>
              {cat && <View style={[styles.catDot, { backgroundColor: getCategoryDotColor(cat.groupColor, cat.groupName) }]} />}
              <Text style={styles.meta}>{cat?.name ?? "Unknown"}</Text>
            </View>
            <Text style={styles.account}>{item.account}</Text>
          </View>
        </Pressable>
      </Swipeable>
    );
  }

  function renderSectionHeader({ section }: { section: Section }) {
    return (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>{section.title}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {transactions.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No transactions yet.</Text>
          <Text style={styles.emptySubtext}>Start tracking your spending below.</Text>
          <Pressable style={styles.emptyBtn} onPress={() => router.push("/add")}>
            <Text style={styles.emptyBtnText}>Add Transaction</Text>
          </Pressable>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={C.textTertiary} />}
          ListHeaderComponent={
            <Pressable
              style={[styles.filterBtn, activeFilterCount > 0 && styles.filterBtnActive]}
              onPress={() => router.push("/filters")}
            >
              <Text style={[styles.filterBtnText, activeFilterCount > 0 && styles.filterBtnTextActive]}>
                Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
              </Text>
            </Pressable>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  list: { padding: 16 },
  sectionHeader: {
    backgroundColor: C.bg,
    paddingVertical: 6,
    marginBottom: 4,
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: "700",
    color: C.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  row: {
    backgroundColor: C.card,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.separator,
  },
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  description: { fontSize: 16, fontWeight: "600", color: C.textPrimary, flex: 1, marginRight: 8 },
  amount: { fontSize: 16, fontWeight: "700" },
  incomeAmount: { color: C.positive },
  spendingAmount: { color: C.negative },
  rowBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  metaRow: { flexDirection: "row", alignItems: "center" },
  catDot: { width: 8, height: 8, borderRadius: 4, marginRight: 5 },
  meta: { fontSize: 13, color: C.textPrimary },
  account: { fontSize: 13, color: C.textTertiary },
  deleteAction: {
    backgroundColor: C.negative,
    justifyContent: "center",
    alignItems: "center",
    width: 80,
    borderRadius: 10,
    marginBottom: 10,
  },
  deleteActionText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  filterBtn: {
    alignSelf: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
    marginBottom: 12,
  },
  filterBtnActive: { backgroundColor: C.accent, borderColor: C.accent },
  filterBtnText: { fontSize: 14, fontWeight: "600", color: C.textSecondary },
  filterBtnTextActive: { color: "#fff" },
  empty: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  emptyText: { fontSize: 18, color: C.textSecondary, fontWeight: "500" },
  emptySubtext: { fontSize: 14, color: C.textTertiary, marginTop: 4, textAlign: "center" },
  emptyBtn: {
    marginTop: 20,
    backgroundColor: C.accent,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  emptyBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
