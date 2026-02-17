# Bijan Bank

A personal budget tracking app built with React Native and Expo. Tracks income, spending, and budgets by month with everything stored locally on-device.

## What it does

- Add transactions with date, amount, category, and account
- Monthly budget tracking with per-category budgets that carry forward automatically
- Overview dashboard with income/spending breakdown and budget vs actual bar charts
- Custom categories — add and delete your own from Settings
- Filter transactions by category or account
- Export/import month data as JSON
- Native calendar date picker for adding/editing transactions

## How spending works

Categories are either `income` (like Wages) or `spending` (like Eating Out, Groceries, etc). Paybacks in spending categories (e.g. a friend paying you back for dinner) reduce that category's spending rather than counting as income. This keeps the totals accurate.

## Tech stack

- React Native + Expo (SDK 54)
- Expo Router (tab navigation)
- Expo SQLite (local database, no server)
- TypeScript

## Running locally

```bash
npm install
npx expo start
```

For a standalone build on a physical device:

```bash
npx expo run:ios --device --configuration Release
```

## Project structure

```
app/           → screens (overview, budget, transactions, add, edit, settings, filters)
db/            → database init and queries
components/    → reusable UI components
utils/         → shared contexts (month, filters) and helpers
assets/        → app icons
```
