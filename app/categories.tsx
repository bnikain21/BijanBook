import { useCallback, useState } from "react";
import {
  Alert,
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
  insertCategory,
  deleteCategory,
  getTransactionCountsByCategory,
  Category,
} from "../db/queries";

export default function CategoriesScreen() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [txCounts, setTxCounts] = useState<Record<number, number>>({});
  const [name, setName] = useState("");

  const reload = useCallback(() => {
    Promise.all([getAllCategories(), getTransactionCountsByCategory()]).then(
      ([cats, counts]) => {
        setCategories(cats);
        setTxCounts(counts);
      }
    );
  }, []);

  useFocusEffect(reload);

  async function handleAdd() {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert("Validation Error", "Category name is required.");
      return;
    }
    try {
      await insertCategory(trimmed, "spending");
      setName("");
      reload();
    } catch (e: any) {
      if (e.message?.includes("UNIQUE")) {
        Alert.alert("Already Exists", `A category named "${trimmed}" already exists.`);
      } else {
        Alert.alert("Error", e.message);
      }
    }
  }

  function handleDelete(cat: Category) {
    const count = txCounts[cat.id] ?? 0;
    if (count > 0) {
      Alert.alert(
        "Cannot Delete",
        `"${cat.name}" has ${count} transaction${count === 1 ? "" : "s"}. Remove or reassign them first.`
      );
      return;
    }
    Alert.alert(
      "Delete Category",
      `Delete "${cat.name}"? Its monthly budgets will also be removed.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteCategory(cat.id);
            reload();
          },
        },
      ]
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Add Category Form */}
      <Text style={styles.sectionTitle}>Add Category</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Category name"
      />
      <Pressable style={styles.addBtn} onPress={handleAdd}>
        <Text style={styles.addBtnText}>Add Category</Text>
      </Pressable>

      {/* Category List */}
      <Text style={styles.sectionTitle}>Categories</Text>
      {categories.length === 0 && <Text style={styles.emptyText}>No categories yet.</Text>}
      {categories.map((cat) => (
        <View key={cat.id} style={styles.row}>
          <View style={styles.rowInfo}>
            <Text style={styles.rowName}>{cat.name}</Text>
            {(txCounts[cat.id] ?? 0) > 0 && (
              <Text style={styles.rowCount}>
                {txCounts[cat.id]} tx{txCounts[cat.id] === 1 ? "" : "s"}
              </Text>
            )}
          </View>
          <Pressable
            style={[styles.deleteBtn, (txCounts[cat.id] ?? 0) > 0 && styles.deleteBtnDisabled]}
            onPress={() => handleDelete(cat)}
          >
            <Text
              style={[styles.deleteBtnText, (txCounts[cat.id] ?? 0) > 0 && styles.deleteBtnTextDisabled]}
            >
              Delete
            </Text>
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 16, paddingBottom: 40 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 12,
    marginTop: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    backgroundColor: "#f9fafb",
    marginBottom: 10,
  },
  addBtn: {
    backgroundColor: "#2563eb",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 8,
  },
  addBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  emptyText: { fontSize: 14, color: "#9ca3af", marginBottom: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f9fafb",
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 16, fontWeight: "600", color: "#111827" },
  rowCount: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  deleteBtn: {
    backgroundColor: "#fee2e2",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#fca5a5",
  },
  deleteBtnDisabled: {
    backgroundColor: "#f3f4f6",
    borderColor: "#d1d5db",
  },
  deleteBtnText: { color: "#dc2626", fontWeight: "600", fontSize: 14 },
  deleteBtnTextDisabled: { color: "#9ca3af" },
});
