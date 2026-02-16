import { useCallback, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import {
  getTransactionsByMonth,
  getAllCategories,
  deleteTransaction,
  Transaction,
  Category,
} from "../db/queries";
import { useMonth } from "../utils/MonthContext";

export default function TransactionsScreen() {
  const router = useRouter();
  const { month } = useMonth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categoryMap, setCategoryMap] = useState<Record<number, Category>>({});

  const loadData = useCallback(async () => {
    const [txs, cats] = await Promise.all([
      getTransactionsByMonth(month),
      getAllCategories(),
    ]);
    setTransactions(txs);
    const map: Record<number, Category> = {};
    for (const c of cats) map[c.id] = c;
    setCategoryMap(map);
  }, [month]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  function handleDelete(tx: Transaction) {
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
            loadData();
          },
        },
      ]
    );
  }

  function handleEdit(tx: Transaction) {
    router.push(`/edit?id=${tx.id}`);
  }

  function renderItem({ item }: { item: Transaction }) {
    const cat = categoryMap[item.categoryId];
    const isIncome = item.isIncome === 1;
    return (
      <View style={styles.row}>
        <View style={styles.rowTop}>
          <Text style={styles.description} numberOfLines={1}>
            {item.description}
          </Text>
          <Text style={[styles.amount, isIncome ? styles.incomeAmount : styles.spendingAmount]}>
            {isIncome ? "+" : "-"}${item.amount.toFixed(2)}
          </Text>
        </View>
        <View style={styles.rowBottom}>
          <Text style={styles.meta}>
            {item.date} &middot; {cat?.name ?? "Unknown"}
          </Text>
          <Text style={styles.account}>
            {item.account}
          </Text>
        </View>
        <View style={styles.actions}>
          <Pressable style={styles.editBtn} onPress={() => handleEdit(item)}>
            <Text style={styles.editBtnText}>Edit</Text>
          </Pressable>
          <Pressable style={styles.deleteBtn} onPress={() => handleDelete(item)}>
            <Text style={styles.deleteBtnText}>Delete</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {transactions.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No transactions yet.</Text>
          <Text style={styles.emptySubtext}>
            Tap the Add tab to create one.
          </Text>
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  list: { padding: 16 },
  row: {
    backgroundColor: "#f9fafb",
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  description: { fontSize: 16, fontWeight: "600", color: "#111827", flex: 1, marginRight: 8 },
  amount: { fontSize: 16, fontWeight: "700" },
  incomeAmount: { color: "#16a34a" },
  spendingAmount: { color: "#dc2626" },
  rowBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  meta: { fontSize: 13, color: "#6b7280" },
  account: { fontSize: 13, color: "#6b7280" },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  editBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#2563eb",
  },
  editBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  deleteBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#fee2e2",
  },
  deleteBtnText: { color: "#dc2626", fontSize: 13, fontWeight: "600" },
  empty: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { fontSize: 18, color: "#6b7280", fontWeight: "500" },
  emptySubtext: { fontSize: 14, color: "#9ca3af", marginTop: 4 },
});
