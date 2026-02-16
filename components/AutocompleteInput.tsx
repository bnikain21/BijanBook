import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

export const ACCOUNT_SUGGESTIONS = [
  "Apple Card",
  "Amex Gold",
  "Prime Visa",
  "BoFA Checking",
  "Venmo",
  "Savings",
  "Trading"
];

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  suggestions?: string[];
}

export function AutocompleteInput({
  value,
  onChangeText,
  placeholder,
  suggestions = ACCOUNT_SUGGESTIONS,
}: Props) {
  const [showSuggestions, setShowSuggestions] = useState(false);

  const filtered = value.trim()
    ? suggestions.filter(
        (s) =>
          s.toLowerCase().includes(value.toLowerCase()) &&
          s.toLowerCase() !== value.toLowerCase()
      )
    : suggestions;

  return (
    <View>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={(text) => {
          onChangeText(text);
          setShowSuggestions(true);
        }}
        placeholder={placeholder}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
      />
      {showSuggestions && filtered.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          style={styles.chipRow}
          contentContainerStyle={styles.chipContent}
        >
          {filtered.map((item) => (
            <Pressable
              key={item}
              style={styles.chip}
              onPress={() => {
                onChangeText(item);
                setShowSuggestions(false);
              }}
            >
              <Text style={styles.chipText}>{item}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    backgroundColor: "#f9fafb",
  },
  chipRow: {
    marginTop: 6,
    marginBottom: 2,
    maxHeight: 36,
  },
  chipContent: {
    gap: 6,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#e5e7eb",
  },
  chipText: {
    fontSize: 13,
    color: "#374151",
  },
});
