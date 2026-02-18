// Reserved for the hardcoded Income section — not in the user-selectable palette
export const INCOME_COLOR = "#16a34a";

// 6 distinct user-selectable group colors (green excluded — reserved for income)
export const PALETTE = [
  "#2563eb", // blue
  "#7c3aed", // violet
  "#db2777", // pink
  "#dc2626", // red
  "#d97706", // amber
  "#0891b2", // cyan
];

export function getCategoryColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

// Use the group's stored color, falling back to gray for Unassigned
export function getCategoryDotColor(
  groupColor: string | null | undefined,
  groupName?: string | null
): string {
  if (groupColor) return groupColor;
  if (groupName) return getCategoryColor(groupName);
  return "#9ca3af";
}
