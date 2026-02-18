import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { File, Paths } from "expo-file-system";
import { shareAsync } from "expo-sharing";
import { getDocumentAsync } from "expo-document-picker";
import { useMonth } from "../utils/MonthContext";
import { C } from "../utils/colors";
import {
  exportMonthData,
  importTransactions,
  countTransactionsByMonth,
  deleteTransactionsByMonth,
  deleteMonthlyBudgetsByMonth,
  hasMonthlyBudgets,
  getMostRecentMonthWithBudgets,
  copyBudgetsFromMonth,
  TransactionInput,
} from "../db/queries";
import Ionicons from '@expo/vector-icons/Ionicons';

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatLabel(month: string): string {
  const [year, mm] = month.split("-");
  return `${MONTH_NAMES[parseInt(mm, 10) - 1]} ${year}`;
}

function shiftMonth(month: string, delta: number): string {
  const [year, mm] = month.split("-").map(Number);
  const d = new Date(year, mm - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function SettingsScreen() {
  const router = useRouter();
  const { month, setMonth } = useMonth();
  const [busy, setBusy] = useState(false);

  async function changeMonth(delta: number) {
    const next = shiftMonth(month, delta);
    setMonth(next);
    const hasBudgets = await hasMonthlyBudgets(next);
    if (!hasBudgets) {
      const source = await getMostRecentMonthWithBudgets(next + "~");
      if (source) await copyBudgetsFromMonth(source, next);
    }
  }

  async function handleExport() {
    try {
      setBusy(true);
      const data = await exportMonthData(month);
      const json = JSON.stringify(data, null, 2);
      const filename = `budget-${month}.json`;
      const file = new File(Paths.cache, filename);
      if (file.exists) file.delete();
      file.create();
      file.write(json);
      await shareAsync(file.uri, { mimeType: "application/json", dialogTitle: `Export ${formatLabel(month)}` });
    } catch (e: any) {
      Alert.alert("Export Failed", e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleImport() {
    try {
      const result = await getDocumentAsync({ type: "application/json", copyToCacheDirectory: true });
      if (result.canceled) return;
      setBusy(true);
      const pickedFile = new File(result.assets[0].uri);
      const content = await pickedFile.text();
      const parsed = JSON.parse(content);
      if (!Array.isArray(parsed.transactions)) {
        Alert.alert("Invalid File", "The JSON file must contain a 'transactions' array.");
        setBusy(false);
        return;
      }
      const txs: TransactionInput[] = parsed.transactions.map((t: any) => ({
        date: t.date,
        description: t.description,
        account: t.account ?? "",
        isIncome: t.isIncome ?? 0,
        amount: t.amount,
        categoryId: t.categoryId,
        notes: t.notes ?? "",
      }));
      Alert.alert(
        "Import Transactions",
        `Import ${txs.length} transaction${txs.length === 1 ? "" : "s"}?\n\nNote: This may create duplicates if the data was already imported.`,
        [
          { text: "Cancel", style: "cancel", onPress: () => setBusy(false) },
          {
            text: "Import",
            onPress: async () => {
              try {
                const count = await importTransactions(txs);
                Alert.alert("Import Complete", `${count} transaction${count === 1 ? "" : "s"} imported.`);
              } catch (e: any) {
                Alert.alert("Import Failed", e.message);
              } finally {
                setBusy(false);
              }
            },
          },
        ]
      );
    } catch (e: any) {
      Alert.alert("Import Failed", e.message);
      setBusy(false);
    }
  }

  async function handleReset() {
    const txCount = await countTransactionsByMonth(month);
    if (txCount === 0) {
      Alert.alert("Nothing to Reset", `There are no transactions for ${formatLabel(month)}.`);
      return;
    }
    Alert.alert("Reset Month", `Are you sure you want to reset ${formatLabel(month)}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Continue",
        style: "destructive",
        onPress: () => {
          Alert.alert(
            "Confirm Reset",
            `This will permanently delete ${txCount} transaction${txCount === 1 ? "" : "s"} for ${formatLabel(month)}. This cannot be undone.`,
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Delete All",
                style: "destructive",
                onPress: async () => {
                  await deleteTransactionsByMonth(month);
                  await deleteMonthlyBudgetsByMonth(month);
                  Alert.alert("Reset Complete", `All data for ${formatLabel(month)} has been deleted.`);
                },
              },
            ]
          );
        },
      },
    ]);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Selected Month</Text>
      <View style={styles.monthSelector}>
        <Pressable style={styles.arrowBtn} onPress={() => changeMonth(-1)}>
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </Pressable>
        <Text style={styles.monthLabel}>{formatLabel(month)}</Text>
        <Pressable style={styles.arrowBtn} onPress={() => changeMonth(1)}>
          <Ionicons name="chevron-forward" size={20} color="#fff" />
        </Pressable>
      </View>
      <Text style={styles.hint}>All screens show data for the selected month.</Text>

      <Pressable style={styles.actionBtn} onPress={() => router.push("/categories")}>
        <Text style={styles.actionBtnText}>Manage Categories</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>Data</Text>
      <Pressable style={[styles.actionBtn, busy && styles.actionBtnDisabled]} onPress={handleExport} disabled={busy}>
        <Text style={styles.actionBtnText}>Export {formatLabel(month)} Data</Text>
      </Pressable>
      <Pressable style={[styles.actionBtn, busy && styles.actionBtnDisabled]} onPress={handleImport} disabled={busy}>
        <Text style={styles.actionBtnText}>Import Transactions</Text>
      </Pressable>

      <Text style={[styles.sectionTitle, { marginTop: 32 }]}>Danger Zone</Text>
      <Pressable style={styles.resetBtn} onPress={handleReset}>
        <Text style={styles.resetBtnText}>Reset {formatLabel(month)}</Text>
      </Pressable>
      <Text style={styles.resetHint}>
        Deletes all transactions and budgets for this month. Other months are not affected.
      </Text>
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
  monthSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.cardElevated,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  arrowBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.accent,
    justifyContent: "center",
    alignItems: "center",
  },
  monthLabel: {
    fontSize: 20,
    fontWeight: "700",
    color: C.textPrimary,
    marginHorizontal: 20,
    minWidth: 160,
    textAlign: "center",
  },
  hint: {
    fontSize: 13,
    color: C.textTertiary,
    marginTop: 8,
    textAlign: "center",
  },
  actionBtn: {
    backgroundColor: C.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  actionBtnDisabled: { opacity: 0.5 },
  actionBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  resetBtn: {
    backgroundColor: "rgba(239,68,68,0.15)",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.4)",
  },
  resetBtnText: { color: C.negative, fontSize: 16, fontWeight: "700" },
  resetHint: { fontSize: 13, color: C.textTertiary, marginTop: 8, textAlign: "center" },
});
