# Plan: 10 UI Upgrades (One at a Time)

## Context
The app has clean, functional styling but looks minimal. These upgrades add visual polish and modern interactions inspired by popular finance apps (Copilot, YNAB, Monarch). Each is implemented, tested, and committed separately.

## Current Dependencies (nothing UI-related installed yet)
- expo ~54.0.33, react-native 0.81.5, expo-router ~6.0.23
- No gesture handler, reanimated, SVG, haptics, or chart libraries

---

## Upgrade #1: Tab Bar Icons

**File:** `app/_layout.tsx`

Add `tabBarIcon` to each visible `Tabs.Screen` options. Use unicode characters in a `<Text>` element — no library needed.

| Tab | Label | Icon character |
|-----|-------|---------------|
| Overview | Overview | chart/bar emoji |
| Budget | Budget | target emoji |
| Transactions | Transactions | receipt/list emoji |
| Add | Add | plus emoji |

Implementation: add `tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>...</Text>` to the 4 visible screens in the `<Tabs>` block. Hidden screens (edit, settings, filters, categories) already have `href: null`.

**Verify:** 4 tabs show icons + labels, active = blue tint, inactive = gray. `npx tsc --noEmit`.

---

## Upgrade #2: Card Shadows & Depth

**Files:** `app/index.tsx`, `app/budget.tsx`, `app/transactions.tsx`, `app/categories.tsx`, `app/settings.tsx`

Add a shared shadow style to all card-like containers. On iOS use `shadowColor/shadowOffset/shadowOpacity/shadowRadius`. On Android use `elevation`.

Target style objects per file:
- `index.tsx`: `summaryCard`, `chartCard`, `catCard`
- `budget.tsx`: `summaryCard`, `catCard`
- `transactions.tsx`: `row`
- `categories.tsx`: `row`
- `settings.tsx`: `monthSelector`

Shadow values: `shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2`. Remove existing `borderWidth: 1` and `borderColor` on cards that get shadows (keeps it clean, not doubled).

**Verify:** cards have subtle lift on both iOS and Android. No border + shadow doubling. `npx tsc --noEmit`.

---

## Upgrade #3: Transaction Date Groups

**File:** `app/transactions.tsx`

Replace `FlatList` with `SectionList`. Group transactions by date.

Steps:
1. Build sections from `filteredTransactions`: group by `item.date`, convert to `{ title, data }[]`
2. Format section titles: "Today", "Yesterday", or formatted date (e.g. "January 14, 2026")
3. `renderSectionHeader` renders a sticky header with the date string
4. `renderItem` stays the same (existing card layout)
5. Keep the filter button as `ListHeaderComponent`

**Verify:** transactions grouped by date, sticky headers scroll correctly, filters still work. `npx tsc --noEmit`.

---

## Upgrade #4: Swipe-to-Delete

**Install:** `npx expo install react-native-gesture-handler react-native-reanimated`

**Files:** `app/transactions.tsx`, `app/_layout.tsx` (may need GestureHandlerRootView wrapper)

Steps:
1. Wrap each transaction row in `Swipeable` from `react-native-gesture-handler`
2. `renderRightActions` returns a red "Delete" action panel
3. Swipe left reveals delete, tap triggers the existing `handleDelete` with Alert confirmation
4. Remove the always-visible action buttons (`actions` container with Edit/Delete)
5. Make the whole row tappable — `onPress` navigates to edit screen (replaces the Edit button)
6. Wrap the root layout in `GestureHandlerRootView` if needed by the library

**Verify:** swipe left shows red delete, tap row opens edit, no visible buttons cluttering rows. `npx tsc --noEmit`.

---

## Upgrade #5: Category Color Dots

**Approach:** Derive a color from category name using a hash function (no DB change needed). Create a small utility function `getCategoryColor(name: string): string` that maps to a fixed palette of 10-12 distinct colors.

**Files:**
- `utils/categoryColors.ts` (new) — hash function + color palette
- `app/index.tsx` — colored dot next to category names in the detail cards and chart rows
- `app/budget.tsx` — colored dot next to category names
- `app/transactions.tsx` — colored dot in meta row next to category name
- `app/filters.tsx` — colored dot inside filter chips
- `app/categories.tsx` — colored dot next to each category in the list

Dot style: `width: 10, height: 10, borderRadius: 5, backgroundColor: color, marginRight: 6`

**Verify:** each category consistently gets the same color across all screens. Colors are distinct and readable. `npx tsc --noEmit`.

---

## Upgrade #6: Spending Donut Chart

**Install:** `npx expo install react-native-svg` (or use a lightweight chart lib like `react-native-gifted-charts`)

**Files:**
- `app/index.tsx` — add donut chart between summary card and budget bar chart
- Possibly `components/DonutChart.tsx` (new) if complex enough to extract

Implementation with `react-native-svg`:
1. Calculate spending per category (already computed in overview as `catDetails`)
2. Draw SVG `<Circle>` arcs using `strokeDasharray` and `strokeDashoffset` for each category slice
3. Center text shows total spending amount
4. Legend below with colored dots (reuse category colors from #5) + category name + amount
5. Only show spending categories (income excluded from donut)

**Verify:** donut renders correctly, slices sum to 100%, colors match category dots, tapping legend does nothing (static). `npx tsc --noEmit`.

---

## Upgrade #7: Better Empty States

**Files:** `app/transactions.tsx`, `app/index.tsx`, `app/budget.tsx`, `app/categories.tsx`

For each screen's empty state:
- `transactions.tsx`: current "No transactions yet" → add "Add Transaction" button that navigates to `/add`
- `index.tsx`: if no transactions for the month → centered message + "Add Transaction" button
- `budget.tsx`: if no categories → "Set up categories first" + button to `/categories`
- `categories.tsx`: "No categories yet" → slightly larger text with hint "Add your first category above"

Style: centered container, 16px text, muted color, action button styled like the primary blue button.

**Verify:** empty states show on fresh data, buttons navigate correctly. `npx tsc --noEmit`.

---

## Upgrade #8: Haptic Feedback

**Install:** `npx expo install expo-haptics`

**Files:** all screens with interactive actions

Add `Haptics.impactAsync(ImpactFeedbackStyle.Light)` on:
- Tab switches (optional, may be too much)
- Button presses: Add Transaction, Save Changes, Add Category
- Delete confirmation (use `Haptics.notificationAsync(NotificationFeedbackType.Warning)`)
- Successful save/delete (use `Haptics.notificationAsync(NotificationFeedbackType.Success)`)
- Swipe-to-delete threshold (if #4 is done)

Keep it subtle — only on meaningful actions, not every tap.

**Verify:** feel haptics on real device (simulator won't vibrate). No haptics on passive navigation. `npx tsc --noEmit`.

---

## Upgrade #9: Pull-to-Refresh

**Files:** `app/transactions.tsx`, `app/index.tsx`, `app/budget.tsx`

Add `refreshing` state + `onRefresh` handler to list/scroll components:
- `transactions.tsx`: `SectionList` (or FlatList) already supports `refreshing` + `onRefresh` props
- `index.tsx`: wrap ScrollView content with `RefreshControl`
- `budget.tsx`: wrap ScrollView content with `RefreshControl`

Each `onRefresh` re-fetches the data (calls the existing load functions).

**Verify:** pull down shows spinner, data reloads, spinner dismisses. `npx tsc --noEmit`.

---

## Upgrade #10: Animated Progress Bars

**Requires:** `react-native-reanimated` (already installed if #4 was done, otherwise install it)

**Files:** `app/index.tsx`, `app/budget.tsx`

Steps:
1. Create an `AnimatedBar` component (or inline) that animates width from 0% to target% on mount
2. Use `useSharedValue` + `useAnimatedStyle` + `withTiming` from reanimated
3. Replace all static progress bar `View` fills with the animated version
4. Duration: ~600ms with easing
5. Target bars:
   - `index.tsx`: overall progress bar (height 8), chart bars (height 20), category progress bars (height 6)
   - `budget.tsx`: overall progress bar (height 8), per-category progress bars (height 8)

**Verify:** bars animate smoothly on screen load, no jank on fast navigation. `npx tsc --noEmit`.

---

## Implementation Order Summary

| # | Upgrade | New packages | Files touched |
|---|---------|-------------|---------------|
| 1 | Tab Bar Icons | none | `_layout.tsx` |
| 2 | Card Shadows | none | `index`, `budget`, `transactions`, `categories`, `settings` |
| 3 | Date Groups | none | `transactions.tsx` |
| 4 | Swipe-to-Delete | gesture-handler, reanimated | `transactions.tsx`, possibly `_layout.tsx` |
| 5 | Category Colors | none | new `utils/categoryColors.ts`, `index`, `budget`, `transactions`, `filters`, `categories` |
| 6 | Donut Chart | react-native-svg | `index.tsx`, possibly new component |
| 7 | Empty States | none | `transactions`, `index`, `budget`, `categories` |
| 8 | Haptic Feedback | expo-haptics | all action screens |
| 9 | Pull-to-Refresh | none | `transactions`, `index`, `budget` |
| 10 | Animated Bars | reanimated (from #4) | `index.tsx`, `budget.tsx` |

## Progress Tracking

- [ ] #1 Tab Bar Icons
- [ ] #2 Card Shadows & Depth
- [ ] #3 Transaction Date Groups
- [ ] #4 Swipe-to-Delete
- [ ] #5 Category Color Dots
- [ ] #6 Spending Donut Chart
- [ ] #7 Better Empty States
- [ ] #8 Haptic Feedback
- [ ] #9 Pull-to-Refresh
- [ ] #10 Animated Progress Bars
