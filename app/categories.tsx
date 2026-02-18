import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { getCategoryDotColor } from "../utils/categoryColors";
import { useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import { C } from "../utils/colors";
import {
  getAllCategories, insertCategory, deleteCategory, getTransactionCountsByCategory,
  getCategoryGroups, insertCategoryGroup, deleteCategoryGroup, updateCategoryGroupId,
  Category, CategoryGroup,
} from "../db/queries";

export default function CategoriesScreen() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [txCounts, setTxCounts] = useState<Record<number, number>>({});
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [name, setName] = useState("");
  const [groupName, setGroupName] = useState("");

  const reload = useCallback(() => {
    Promise.all([getAllCategories(), getTransactionCountsByCategory(), getCategoryGroups()]).then(
      ([cats, counts, grps]) => { setCategories(cats); setTxCounts(counts); setGroups(grps); }
    );
  }, []);

  useFocusEffect(reload);

  async function handleAdd() {
    const trimmed = name.trim();
    if (!trimmed) { Alert.alert("Validation Error", "Category name is required."); return; }
    try {
      await insertCategory(trimmed, "spending");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setName(""); reload();
    } catch (e: any) {
      if (e.message?.includes("UNIQUE")) Alert.alert("Already Exists", `A category named "${trimmed}" already exists.`);
      else Alert.alert("Error", e.message);
    }
  }

  async function handleAddGroup() {
    const trimmed = groupName.trim();
    if (!trimmed) { Alert.alert("Validation Error", "Group name is required."); return; }
    try {
      await insertCategoryGroup(trimmed);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setGroupName(""); reload();
    } catch (e: any) {
      if (e.message?.includes("UNIQUE")) Alert.alert("Already Exists", `A group named "${trimmed}" already exists.`);
      else Alert.alert("Error", e.message);
    }
  }

  function handleDeleteGroup(group: CategoryGroup) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert("Delete Group", `Delete "${group.name}"? Its categories will move to Unassigned.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        await deleteCategoryGroup(group.id);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        reload();
      }},
    ]);
  }

  function handleDelete(cat: Category) {
    const count = txCounts[cat.id] ?? 0;
    if (count > 0) {
      Alert.alert("Cannot Delete", `"${cat.name}" has ${count} transaction${count === 1 ? "" : "s"}. Remove or reassign them first.`);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert("Delete Category", `Delete "${cat.name}"? Its monthly budgets will also be removed.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        await deleteCategory(cat.id);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        reload();
      }},
    ]);
  }

  function pickGroup(cat: Category) {
    const options: any[] = [
      ...groups.map((g) => ({ text: g.name, onPress: () => updateCategoryGroupId(cat.id, g.id).then(reload) })),
      { text: "Unassigned", onPress: () => updateCategoryGroupId(cat.id, null).then(reload) },
      { text: "Cancel", style: "cancel" },
    ];
    Alert.alert("Assign Group", cat.name, options);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Add Category</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Category name"
        placeholderTextColor={C.textTertiary}
      />
      <Pressable style={styles.addBtn} onPress={handleAdd}>
        <Text style={styles.addBtnText}>Add Category</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>Groups</Text>
      <View style={styles.groupInputRow}>
        <TextInput
          style={[styles.input, styles.groupInput]}
          value={groupName}
          onChangeText={setGroupName}
          placeholder="Group name"
          placeholderTextColor={C.textTertiary}
        />
        <Pressable style={styles.groupAddBtn} onPress={handleAddGroup}>
          <Text style={styles.groupAddBtnText}>Add</Text>
        </Pressable>
      </View>
      {groups.length === 0 ? (
        <Text style={styles.emptyText}>No groups yet. Groups help organize your categories on the Budget screen.</Text>
      ) : (
        groups.map((g) => (
          <View key={g.id} style={styles.groupRow}>
            <Text style={styles.groupRowName}>{g.name}</Text>
            <Pressable style={styles.deleteBtn} onPress={() => handleDeleteGroup(g)}>
              <Text style={styles.deleteBtnText}>Delete</Text>
            </Pressable>
          </View>
        ))
      )}

      <Text style={styles.sectionTitle}>Categories</Text>
      {categories.length === 0 && (
        <Text style={styles.emptyText}>No categories yet. Add your first category above.</Text>
      )}
      {categories.map((cat) => {
        const groupLabel = groups.find((g) => g.id === cat.groupId)?.name ?? "Unassigned";
        return (
          <View key={cat.id} style={styles.row}>
            <View style={styles.rowInfo}>
              <View style={styles.rowNameRow}>
                <View style={[styles.catDot, { backgroundColor: getCategoryDotColor(cat.groupColor, cat.groupName) }]} />
                <Text style={styles.rowName}>{cat.name}</Text>
              </View>
              <View style={styles.rowMeta}>
                {(txCounts[cat.id] ?? 0) > 0 && (
                  <Text style={styles.rowCount}>{txCounts[cat.id]} tx{txCounts[cat.id] === 1 ? "" : "s"} · </Text>
                )}
                {groups.length > 0 && (
                  <Pressable onPress={() => pickGroup(cat)}>
                    <Text style={styles.groupChip}>{groupLabel} ▾</Text>
                  </Pressable>
                )}
              </View>
            </View>
            <Pressable
              style={[styles.deleteBtn, (txCounts[cat.id] ?? 0) > 0 && styles.deleteBtnDisabled]}
              onPress={() => handleDelete(cat)}
            >
              <Text style={[styles.deleteBtnText, (txCounts[cat.id] ?? 0) > 0 && styles.deleteBtnTextDisabled]}>
                Delete
              </Text>
            </Pressable>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingBottom: 40 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: C.textPrimary, marginBottom: 12, marginTop: 20 },
  input: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    backgroundColor: C.card,
    color: C.textPrimary,
    marginBottom: 10,
  },
  addBtn: { backgroundColor: C.accent, borderRadius: 10, paddingVertical: 14, alignItems: "center", marginBottom: 8 },
  addBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  groupInputRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  groupInput: { flex: 1 },
  groupAddBtn: { backgroundColor: C.accent, borderRadius: 8, paddingHorizontal: 18, paddingVertical: 10, justifyContent: "center" },
  groupAddBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  groupRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: C.cardElevated,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: C.border,
  },
  groupRowName: { fontSize: 15, fontWeight: "600", color: C.textPrimary },
  emptyText: { fontSize: 14, color: C.textTertiary, marginBottom: 8, textAlign: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: C.card,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.separator,
  },
  rowInfo: { flex: 1 },
  rowNameRow: { flexDirection: "row", alignItems: "center" },
  catDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  rowName: { fontSize: 16, fontWeight: "600", color: C.textPrimary },
  rowMeta: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  rowCount: { fontSize: 12, color: C.textTertiary },
  groupChip: { fontSize: 12, color: C.accent, fontWeight: "600" },
  deleteBtn: {
    backgroundColor: "rgba(239,68,68,0.15)",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
  },
  deleteBtnDisabled: { backgroundColor: C.cardElevated, borderColor: C.border },
  deleteBtnText: { color: C.negative, fontWeight: "600", fontSize: 14 },
  deleteBtnTextDisabled: { color: C.textTertiary },
});
