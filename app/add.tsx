import { useEffect, useState } from "react";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import * as Haptics from "expo-haptics";
import { getAllCategories, insertTransaction, Category } from "../db/queries";
import { AutocompleteInput } from "../components/AutocompleteInput";
import { C } from "../utils/colors";

function formatDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function AddScreen() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [description, setDescription] = useState("");
  const [account, setAccount] = useState("");
  const [isIncome, setIsIncome] = useState(false);
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    getAllCategories().then((cats) => {
      setCategories(cats);
      if (cats.length > 0) setCategoryId(cats[0].id);
    });
  }, []);

  function handleCategorySelect(cat: Category) {
    setCategoryId(cat.id);
    setIsIncome(cat.rule === "income");
  }

  function onDateChange(_event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === "android") setShowDatePicker(false);
    if (selected) setDate(selected);
  }

  function validate(): string | null {
    if (!description.trim()) return "Description is required";
    if (!account.trim()) return "Account is required";
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) return "Amount must be a positive number";
    if (categoryId === null) return "Category is required";
    return null;
  }

  async function handleSubmit() {
    const error = validate();
    if (error) { Alert.alert("Validation Error", error); return; }

    await insertTransaction({
      date: formatDate(date),
      description: description.trim(),
      account: account.trim(),
      isIncome: isIncome ? 1 : 0,
      amount: parseFloat(amount),
      categoryId: categoryId!,
      notes: notes.trim(),
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setDate(new Date());
    setDescription("");
    setAccount("");
    setIsIncome(false);
    setAmount("");
    setNotes("");
    if (categories.length > 0) setCategoryId(categories[0].id);
    router.navigate("/transactions");
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <Text style={styles.label}>Date</Text>
          <Pressable style={styles.input} onPress={() => setShowDatePicker(!showDatePicker)}>
            <Text style={styles.dateText}>{formatDate(date)}</Text>
          </Pressable>
          {showDatePicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display={Platform.OS === "ios" ? "inline" : "default"}
              onChange={onDateChange}
            />
          )}

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={styles.input}
            value={description}
            onChangeText={setDescription}
            placeholder="e.g. Lunch at cafe"
            placeholderTextColor={C.textTertiary}
          />

          <Text style={styles.label}>Account</Text>
          <AutocompleteInput value={account} onChangeText={setAccount} placeholder="e.g. Apple Card, Amex Gold" />

          <Text style={styles.label}>Type</Text>
          <View style={styles.toggleRow}>
            <Pressable
              style={[styles.toggleChip, !isIncome && styles.toggleChipSelected]}
              onPress={() => setIsIncome(false)}
            >
              <Text style={[styles.toggleChipText, !isIncome && styles.toggleChipTextSelected]}>Spending</Text>
            </Pressable>
            <Pressable
              style={[styles.toggleChip, isIncome && styles.toggleChipSelectedIncome]}
              onPress={() => setIsIncome(true)}
            >
              <Text style={[styles.toggleChipText, isIncome && styles.toggleChipTextSelected]}>Income</Text>
            </Pressable>
          </View>

          <Text style={styles.label}>Amount</Text>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            placeholderTextColor={C.textTertiary}
            keyboardType="decimal-pad"
          />

          <Text style={styles.label}>Category</Text>
          <View style={styles.categoryRow}>
            {categories.map((cat) => (
              <Pressable
                key={cat.id}
                style={[styles.categoryChip, categoryId === cat.id && styles.categoryChipSelected]}
                onPress={() => handleCategorySelect(cat)}
              >
                <Text style={[styles.categoryChipText, categoryId === cat.id && styles.categoryChipTextSelected]}>
                  {cat.name}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Optional notes"
            placeholderTextColor={C.textTertiary}
            multiline
          />

          <Pressable style={styles.button} onPress={handleSubmit}>
            <Text style={styles.buttonText}>Add Transaction</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 16, paddingBottom: 120 },
  label: { fontSize: 14, fontWeight: "600", color: C.textPrimary, marginTop: 12, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    backgroundColor: C.card,
    color: C.textPrimary,
  },
  dateText: { fontSize: 16, color: C.textPrimary },
  notesInput: { minHeight: 60, textAlignVertical: "top" },
  toggleRow: { flexDirection: "row", gap: 8 },
  toggleChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
    alignItems: "center",
  },
  toggleChipSelected: { backgroundColor: C.accent, borderColor: C.accent },
  toggleChipSelectedIncome: { backgroundColor: C.positive, borderColor: C.positive },
  toggleChipText: { fontSize: 14, fontWeight: "600", color: C.textSecondary },
  toggleChipTextSelected: { color: "#fff" },
  categoryRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
  },
  categoryChipSelected: { backgroundColor: C.accent, borderColor: C.accent },
  categoryChipText: { fontSize: 14, color: C.textPrimary },
  categoryChipTextSelected: { color: "#fff" },
  button: {
    marginTop: 24,
    backgroundColor: C.accent,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
