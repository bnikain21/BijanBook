// Deep Navy theme — single source of truth for all colors
export const C = {
  // Backgrounds
  bg: "#0f172a",           // main screen background
  card: "#1e293b",         // standard card surface
  cardElevated: "#243447", // summary/header cards (slightly lighter)

  // Text
  textPrimary: "#f1f5f9",
  textSecondary: "#94a3b8",
  textTertiary: "#64748b",

  // Accent
  accent: "#3b82f6",

  // Semantic
  positive: "#22c55e",
  negative: "#ef4444",
  warning: "#f59e0b",

  // Structural
  separator: "rgba(255,255,255,0.08)",
  border: "rgba(255,255,255,0.12)",

  // Navigation
  header: "#0f172a",
  tabBar: "#1e293b",
} as const;
