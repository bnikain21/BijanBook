import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import Ionicons from "@expo/vector-icons/Ionicons";
import { getCategoryGroups, insertCategoryGroup, deleteCategoryGroup, updateGroupSortOrders, updateGroupColor, CategoryGroup } from "../db/queries";
import { PALETTE } from "../utils/categoryColors";
import { C } from "../utils/colors";

export default function GroupsScreen() {
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [newName, setNewName] = useState("");

  const reload = useCallback(async () => { setGroups(await getCategoryGroups()); }, []);
  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  async function handleAdd() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    try {
      await insertCategoryGroup(trimmed);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setNewName(""); reload();
    } catch (e: any) {
      if (e.message?.includes("UNIQUE")) Alert.alert("Already Exists", `A group named "${trimmed}" already exists.`);
      else Alert.alert("Error", e.message);
    }
  }

  async function move(index: number, direction: "up" | "down") {
    const next = [...groups];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= next.length) return;
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    const updates = next.map((g, i) => ({ id: g.id, sortOrder: i }));
    const updated = next.map((g, i) => ({ ...g, sortOrder: i }));
    setGroups(updated);
    await updateGroupSortOrders(updates);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  async function handleColorSelect(group: CategoryGroup, color: string) {
    const newColor = group.color === color ? null : color;
    setGroups(groups.map((g) => g.id === group.id ? { ...g, color: newColor } : g));
    await updateGroupColor(group.id, newColor);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  function handleDelete(group: CategoryGroup) {
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Add Group</Text>
      <View style={styles.addRow}>
        <TextInput
          style={styles.input}
          value={newName}
          onChangeText={setNewName}
          placeholder="Group name"
          placeholderTextColor={C.textTertiary}
          onSubmitEditing={handleAdd}
          returnKeyType="done"
        />
        <Pressable style={styles.addBtn} onPress={handleAdd}>
          <Text style={styles.addBtnText}>Add</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>Groups</Text>
      {groups.length === 0 ? (
        <Text style={styles.emptyText}>No groups yet. Add one above.</Text>
      ) : (
        groups.map((group, index) => (
          <View key={group.id} style={styles.row}>
            <View style={styles.reorderCol}>
              <Pressable
                style={[styles.arrowBtn, index === 0 && styles.arrowBtnDisabled]}
                onPress={() => move(index, "up")}
                disabled={index === 0}
              >
                <Ionicons name="chevron-up" size={18} color={index === 0 ? C.textTertiary : C.textSecondary} />
              </Pressable>
              <Pressable
                style={[styles.arrowBtn, index === groups.length - 1 && styles.arrowBtnDisabled]}
                onPress={() => move(index, "down")}
                disabled={index === groups.length - 1}
              >
                <Ionicons name="chevron-down" size={18} color={index === groups.length - 1 ? C.textTertiary : C.textSecondary} />
              </Pressable>
            </View>

            <View style={styles.groupInfo}>
              <View style={styles.groupNameRow}>
                <Text style={styles.groupName}>{group.name}</Text>
              </View>
              <View style={styles.swatchRow}>
                {PALETTE.map((color) => {
                  const selected = group.color === color;
                  return (
                    <Pressable
                      key={color}
                      style={[styles.swatchChip, { backgroundColor: color }, selected && styles.swatchChipSelected]}
                      onPress={() => handleColorSelect(group, color)}
                    >
                      {selected && <Ionicons name="checkmark" size={15} color="#fff" />}
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <Pressable style={styles.deleteBtn} onPress={() => handleDelete(group)}>
              <Ionicons name="trash-outline" size={18} color={C.negative} />
            </Pressable>
          </View>
        ))
      )}

      <Text style={styles.hint}>
        Assign categories to groups from the Categories screen (Settings → Manage Categories).
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingBottom: 40 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: C.textPrimary, marginBottom: 12, marginTop: 20 },
  addRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    backgroundColor: C.card,
    color: C.textPrimary,
  },
  addBtn: { backgroundColor: C.accent, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 },
  addBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.card,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.separator,
    gap: 12,
  },
  reorderCol: { gap: 2 },
  arrowBtn: { padding: 4, borderRadius: 6, backgroundColor: C.cardElevated },
  arrowBtnDisabled: { backgroundColor: "transparent" },
  groupInfo: { flex: 1, gap: 8 },
  groupNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  groupName: { fontSize: 16, fontWeight: "600", color: C.textPrimary },
  swatchRow: { flexDirection: "row", gap: 6 },
  swatchChip: {
    flex: 1,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  swatchChipSelected: {
    borderWidth: 2.5,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },
  deleteBtn: { padding: 6, borderRadius: 6, backgroundColor: "rgba(239,68,68,0.15)" },
  emptyText: { fontSize: 14, color: C.textTertiary, textAlign: "center", marginTop: 8 },
  hint: { fontSize: 13, color: C.textTertiary, textAlign: "center", marginTop: 28, lineHeight: 18 },
});
