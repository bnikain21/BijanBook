import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { getCategoryDotColor } from "../utils/categoryColors";
import { useFocusEffect } from "expo-router";
import { getTransactionsByMonth, getAllCategories, Transaction, Category } from "../db/queries";
import { useMonth } from "../utils/MonthContext";
import { useFilters } from "../utils/FilterContext";
import { C } from "../utils/colors";

export default function FiltersScreen() {
  const { month } = useMonth();
  const { selectedCategory, selectedAccount, setSelectedCategory, setSelectedAccount } = useFilters();
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<string[]>([]);

  useFocusEffect(
    useCallback(() => {
      async function load() {
        const [cats, txs] = await Promise.all([getAllCategories(), getTransactionsByMonth(month)]);
        setCategories(cats);
        const acctSet = new Set(txs.map((tx: Transaction) => tx.account));
        setAccounts(Array.from(acctSet).sort());
      }
      load();
    }, [month])
  );

  const activeCount = (selectedCategory !== null ? 1 : 0) + (selectedAccount !== null ? 1 : 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Category</Text>
      <View style={styles.chipRow}>
        <Pressable
          style={[styles.chip, selectedCategory === null && styles.chipSelected]}
          onPress={() => setSelectedCategory(null)}
        >
          <Text style={[styles.chipText, selectedCategory === null && styles.chipTextSelected]}>All</Text>
        </Pressable>
        {categories.map((cat) => (
          <Pressable
            key={cat.id}
            style={[styles.chip, selectedCategory === cat.id && styles.chipSelected]}
            onPress={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
          >
            <View style={[styles.chipDot, { backgroundColor: getCategoryDotColor(cat.groupColor, cat.groupName) }]} />
            <Text style={[styles.chipText, selectedCategory === cat.id && styles.chipTextSelected]}>
              {cat.name}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Account</Text>
      <View style={styles.chipRow}>
        <Pressable
          style={[styles.chip, selectedAccount === null && styles.chipSelected]}
          onPress={() => setSelectedAccount(null)}
        >
          <Text style={[styles.chipText, selectedAccount === null && styles.chipTextSelected]}>All</Text>
        </Pressable>
        {accounts.map((acct) => (
          <Pressable
            key={acct}
            style={[styles.chip, selectedAccount === acct && styles.chipSelected]}
            onPress={() => setSelectedAccount(selectedAccount === acct ? null : acct)}
          >
            <Text style={[styles.chipText, selectedAccount === acct && styles.chipTextSelected]}>{acct}</Text>
          </Pressable>
        ))}
      </View>

      {activeCount > 0 && (
        <Pressable
          style={styles.clearBtn}
          onPress={() => { setSelectedCategory(null); setSelectedAccount(null); }}
        >
          <Text style={styles.clearBtnText}>Clear All Filters</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingBottom: 40 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: C.textSecondary,
    marginBottom: 12,
    marginTop: 20,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
  },
  chipDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  chipSelected: { backgroundColor: C.accent, borderColor: C.accent },
  chipText: { fontSize: 14, color: C.textSecondary },
  chipTextSelected: { color: "#fff" },
  clearBtn: {
    marginTop: 32,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: "rgba(239,68,68,0.15)",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.4)",
  },
  clearBtnText: { color: C.negative, fontSize: 16, fontWeight: "600" },
});
