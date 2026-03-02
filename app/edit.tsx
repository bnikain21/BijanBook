import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { useLocalSearchParams, useRouter } from "expo-router";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import * as Haptics from "expo-haptics";
import Ionicons from "@expo/vector-icons/Ionicons";
import { getAllCategories, getTransactionById, updateTransaction, Category } from "../db/queries";
import { AutocompleteInput } from "../components/AutocompleteInput";
import { C } from "../utils/colors";
import { INCOME_COLOR, getCategoryDotColor } from "../utils/categoryColors";

function formatDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function friendlyDate(d: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export default function EditScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const descRef = useRef<TextInput>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [description, setDescription] = useState("");
  const [account, setAccount] = useState("");
  const [isIncome, setIsIncome] = useState(false);
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [descFocused, setDescFocused] = useState(false);
  const [accountFocused, setAccountFocused] = useState(false);
  const [notesFocused, setNotesFocused] = useState(false);

  useEffect(() => {
    async function load() {
      const [cats, tx] = await Promise.all([getAllCategories(), getTransactionById(Number(id))]);
      setCategories(cats);
      if (tx) {
        setDate(parseDate(tx.date));
        setDescription(tx.description);
        setAccount(tx.account);
        setIsIncome(tx.isIncome === 1);
        setAmount(String(tx.amount));
        setCategoryId(tx.categoryId);
        setNotes(tx.notes ?? "");
      }
      setLoading(false);
    }
    load();
  }, [id]);

  function handleCategorySelect(cat: Category) {
    setCategoryId(cat.id);
    setIsIncome(cat.rule === "income");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  function handleTypeToggle(income: boolean) {
    setIsIncome(income);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  function onDateChange(_event: DateTimePickerEvent, selected?: Date) {
    if (selected) {
      setDate(selected);
      setShowDatePicker(false);
    }
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
    await updateTransaction(Number(id), {
      date: formatDate(date),
      description: description.trim(),
      account: account.trim(),
      isIncome: isIncome ? 1 : 0,
      amount: parseFloat(amount),
      categoryId: categoryId!,
      notes: notes.trim(),
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.navigate("/transactions");
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={C.accent} />
      </View>
    );
  }

  const accentColor = isIncome ? INCOME_COLOR : C.accent;
  const amountColor = amount ? (isIncome ? INCOME_COLOR : C.textPrimary) : C.textTertiary;
  const spendingCats = categories.filter((c) => c.rule === "spending");
  const incomeCats = categories.filter((c) => c.rule === "income");
  const displayCats = isIncome ? incomeCats : spendingCats;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Hero: Amount + Type ── */}
          <View style={[styles.heroCard, { borderColor: accentColor + "55" }]}>
            <Text style={styles.heroLabel}>Amount</Text>
            <Pressable style={styles.amountRow}>
              <Text style={[styles.currencySymbol, { color: amountColor }]}>$</Text>
              <TextInput
                style={[styles.amountInput, { color: amountColor }]}
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor={C.textTertiary}
                keyboardType="decimal-pad"
                returnKeyType="next"
                onSubmitEditing={() => descRef.current?.focus()}
              />
            </Pressable>

            {/* Type toggle */}
            <View style={[styles.typeToggleTrack, { backgroundColor: C.card }]}>
              <Pressable
                style={[styles.typeToggleBtn, !isIncome && { backgroundColor: C.accent }]}
                onPress={() => handleTypeToggle(false)}
              >
                <Ionicons name="arrow-down-circle" size={15} color={!isIncome ? "#fff" : C.textTertiary} />
                <Text style={[styles.typeToggleText, !isIncome && styles.typeToggleTextActive]}>Spending</Text>
              </Pressable>
              <Pressable
                style={[styles.typeToggleBtn, isIncome && { backgroundColor: INCOME_COLOR }]}
                onPress={() => handleTypeToggle(true)}
              >
                <Ionicons name="arrow-up-circle" size={15} color={isIncome ? "#fff" : C.textTertiary} />
                <Text style={[styles.typeToggleText, isIncome && styles.typeToggleTextActive]}>Income</Text>
              </Pressable>
            </View>
          </View>

          {/* ── Date + Description card ── */}
          <View style={styles.fieldCard}>
            <Pressable style={styles.fieldRow} onPress={() => setShowDatePicker(!showDatePicker)}>
              <View style={styles.fieldIconWrap}>
                <Ionicons name="calendar-outline" size={18} color={C.textSecondary} />
              </View>
              <Text style={styles.fieldText}>{friendlyDate(date)}</Text>
              <Ionicons name="chevron-forward" size={14} color={C.textTertiary} style={styles.fieldChevron} />
            </Pressable>

            {showDatePicker && (
              <DateTimePicker
                value={date}
                mode="date"
                display={Platform.OS === "ios" ? "inline" : "default"}
                onChange={onDateChange}
                style={styles.datePicker}
                themeVariant="dark"
                accentColor={C.accent}
              />
            )}

            <View style={styles.fieldDivider} />

            <View style={[styles.fieldRow, descFocused && styles.fieldRowFocused]}>
              <View style={styles.fieldIconWrap}>
                <Ionicons name="pencil-outline" size={18} color={descFocused ? accentColor : C.textSecondary} />
              </View>
              <TextInput
                ref={descRef}
                style={styles.fieldInput}
                value={description}
                onChangeText={setDescription}
                placeholder="Description"
                placeholderTextColor={C.textTertiary}
                returnKeyType="next"
                onFocus={() => setDescFocused(true)}
                onBlur={() => setDescFocused(false)}
              />
            </View>
          </View>

          {/* ── Account card ── */}
          <View style={[styles.fieldCard, accountFocused && styles.fieldCardFocused]}>
            <View style={styles.fieldRow}>
              <View style={styles.fieldIconWrap}>
                <Ionicons name="card-outline" size={18} color={accountFocused ? accentColor : C.textSecondary} />
              </View>
              <View style={{ flex: 1 }}>
                <AutocompleteInput
                  value={account}
                  onChangeText={setAccount}
                  placeholder="Account"
                  onFocusChange={setAccountFocused}
                />
              </View>
            </View>
          </View>

          {/* ── Category card ── */}
          <View style={styles.fieldCard}>
            <View style={styles.fieldRow}>
              <View style={styles.fieldIconWrap}>
                <Ionicons name="grid-outline" size={18} color={C.textSecondary} />
              </View>
              <Text style={styles.fieldLabel}>Category</Text>
            </View>
            {displayCats.length === 0 ? (
              <Text style={styles.emptyCatText}>No {isIncome ? "income" : "spending"} categories yet.</Text>
            ) : (
              <View style={styles.categoryGrid}>
                {displayCats.map((cat) => {
                  const selected = categoryId === cat.id;
                  const color = getCategoryDotColor(cat.groupColor, cat.groupName);
                  return (
                    <Pressable
                      key={cat.id}
                      style={[
                        styles.categoryCard,
                        { borderColor: selected ? color : C.border },
                        selected && { backgroundColor: color + "22" },
                      ]}
                      onPress={() => handleCategorySelect(cat)}
                    >
                      <View style={[styles.categoryDot, { backgroundColor: color }]} />
                      <Text
                        style={[styles.categoryCardText, selected && { color: color, fontWeight: "700" }]}
                        numberOfLines={1}
                      >
                        {cat.name}
                      </Text>
                      {selected && (
                        <Ionicons name="checkmark-circle" size={14} color={color} style={{ marginLeft: "auto" }} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          {/* ── Notes card ── */}
          <View style={[styles.fieldCard, notesFocused && styles.fieldCardFocused]}>
            <View style={styles.fieldRow}>
              <View style={styles.fieldIconWrap}>
                <Ionicons name="document-text-outline" size={18} color={notesFocused ? accentColor : C.textSecondary} />
              </View>
              <TextInput
                style={[styles.fieldInput, styles.notesInput]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Notes (optional)"
                placeholderTextColor={C.textTertiary}
                multiline
                onFocus={() => setNotesFocused(true)}
                onBlur={() => setNotesFocused(false)}
              />
            </View>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      </TouchableWithoutFeedback>

      {/* ── Sticky submit button ── */}
      <View style={styles.stickyFooter}>
        <Pressable
          style={[styles.submitBtn, { backgroundColor: accentColor }]}
          onPress={handleSubmit}
        >
          <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
          <Text style={styles.submitBtnText}>Save Changes</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 16, paddingBottom: 16 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: C.bg },

  // Hero
  heroCard: {
    backgroundColor: C.cardElevated,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  heroLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: C.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  currencySymbol: {
    fontSize: 36,
    fontWeight: "300",
    marginRight: 4,
    marginTop: 4,
  },
  amountInput: {
    fontSize: 52,
    fontWeight: "300",
    minWidth: 120,
    textAlign: "center",
  },

  // Type toggle
  typeToggleTrack: {
    flexDirection: "row",
    borderRadius: 20,
    padding: 4,
    gap: 4,
    width: "100%",
  },
  typeToggleBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 16,
  },
  typeToggleText: {
    fontSize: 14,
    fontWeight: "600",
    color: C.textTertiary,
  },
  typeToggleTextActive: {
    color: "#fff",
  },

  // Field cards
  fieldCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
  },
  fieldCardFocused: {
    borderColor: C.accent,
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  fieldRowFocused: {},
  fieldIconWrap: {
    width: 28,
    alignItems: "center",
    marginRight: 10,
  },
  fieldText: {
    flex: 1,
    fontSize: 16,
    color: C.textPrimary,
  },
  fieldLabel: {
    fontSize: 16,
    color: C.textSecondary,
    fontWeight: "500",
  },
  fieldInput: {
    flex: 1,
    fontSize: 16,
    color: C.textPrimary,
    padding: 0,
  },
  fieldChevron: {
    marginLeft: 4,
  },
  fieldDivider: {
    height: 1,
    backgroundColor: C.separator,
    marginLeft: 52,
  },
  datePicker: {
    alignSelf: "stretch",
  },

  // Category grid
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    padding: 12,
    paddingTop: 4,
  },
  categoryCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.cardElevated,
    minWidth: "44%",
    flexShrink: 1,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  categoryCardText: {
    fontSize: 14,
    color: C.textPrimary,
    fontWeight: "500",
    flexShrink: 1,
  },
  emptyCatText: {
    fontSize: 14,
    color: C.textTertiary,
    padding: 12,
    paddingTop: 4,
  },

  // Notes
  notesInput: {
    minHeight: 48,
    textAlignVertical: "top",
  },

  // Sticky footer
  stickyFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 32 : 16,
    backgroundColor: C.bg,
    borderTopWidth: 1,
    borderTopColor: C.separator,
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 16,
  },
  submitBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
