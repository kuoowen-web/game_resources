# Hypothetical Comparison — Design Spec

## Overview

Extend the existing Compare view with (1) category subtotals and grand totals, and (2) hypothetical "what-if" strategy benchmarks. Users can compare their actual asset growth between two snapshots against alternative allocation strategies (e.g., fixed deposit, index tracking, or a mix).

## Motivation

The existing Compare view shows per-item deltas between two snapshots but lacks category-level and total-level summaries. Adding hypothetical strategies lets the user answer: "How did my actual allocation perform vs. if I had put everything into X?"

## Scope

### In Scope
- Category subtotal rows in the comparison table
- Grand total row (TWD-converted)
- Hypothetical strategy input UI (multiple strategies allowed)
- Three strategy types: fixed deposit, index tracking, mix
- Calculation engine for each strategy type
- Disguise mode compatibility

### Out of Scope
- Saving/persisting strategies (session-only)
- Per-category hypothetical comparison (only total assets)
- Forward-looking projections
- Real-time price fetching

## Design

### 1. Compare Page Structure

```
┌─────────────────────────────────────────────┐
│  Snapshot A [dropdown]  Snapshot B [dropdown]│
├─────────────────────────────────────────────┤
│  假設策略 (Hypothetical Strategies)          │
│  [+ 新增策略]                                │
│  ┌─ 策略 1: 定存 | 年利率: [2] % | [✕]  ─┐ │
│  ┌─ 策略 2: 指數追蹤 | S&P 500             │ │
│  │  起始價: [480] 結束價: [510] | [✕]  ────┘ │
├─────────────────────────────────────────────┤
│  [比較]                                      │
├─────────────────────────────────────────────┤
│  ... comparison results ...                  │
└─────────────────────────────────────────────┘
```

The strategy section appears between the snapshot selectors and the compare button. When no strategies are added, the compare page behaves exactly as before.

### 2. Strategy Types

#### Fixed Deposit (定存)
- **Input**: annual interest rate (%)
- **Formula**: `principal × (1 + rate/100) ^ (days/365)`
- `days` = calendar days between Snapshot A and Snapshot B dates
- `principal` = Snapshot A total assets converted to TWD

#### Index Tracking (指數追蹤)
- **Input**: index name (display only), start price, end price
- **Formula**: `principal × (end_price / start_price)`
- **Validation**: start price must be > 0, end price must be >= 0
- `principal` = same as above

#### Mix (混合)
- **Input**: list of sub-allocations, each with:
  - percentage (%)
  - sub-strategy type (fixed deposit or index tracking)
  - corresponding parameters
- **Formula**: `Σ (principal × pct/100 × sub_strategy_return)`
- **Validation**: percentages must sum to 100%. Show running total (e.g., "目前 70%，剩餘 30%"). Validate on clicking Compare, show inline error if not 100%.

### 3. Category Subtotal Rows

Each category table gets a bold subtotal row at the bottom:

```
| 名稱        | Snapshot A | Snapshot B | 變化      | %      |
|-------------|-----------|-----------|----------|--------|
| 台銀活存     | 500,000   | 520,000   | +20,000  | +4.0%  |
| 郵局活存     | 100,000   | 105,000   | +5,000   | +5.0%  |
| **小計**    | 600,000   | 625,000   | +25,000  | +4.2%  |
```

**Currency handling in subtotals:**
- In TWD or USD mode: single subtotal row, all values converted
- In original currency mode: separate subtotal rows for each currency present in the category (e.g., TWD subtotal + USD subtotal)

### 4. Grand Total Block

A distinct block after all category tables:

```
|              | Snapshot A   | Snapshot B   | 變化       | %      | 2% 定存      | S&P 500       |
|--------------|-------------|-------------|-----------|--------|-------------|--------------|
| **總計 (TWD)**| 1,200,000   | 1,280,000   | +80,000   | +6.7%  | 1,224,000 (+2.0%) | 1,320,000 (+10.0%) |
```

- Always displayed in TWD (since strategy principal is TWD total)
- Each strategy column shows: hypothetical end value, delta from principal, and return percentage (e.g., `1,224,000 (+24,000, +2.0%)`)
- When no strategies are defined, no strategy columns appear

### 5. Disguise Mode

- Strategy input section: **hidden** when disguised (same as edit buttons)
- Strategy result columns in grand total: **hidden** when disguised
- Subtotal and grand total rows: **visible** in both modes (numbers are already displayed; only labels are disguised)
- Subtotal label: "Subtotal" when disguised, "小計" when real
- Grand total label: "Grand Total" when disguised, "總計 (TWD)" when real

### 6. Calculation Details

**TWD conversion for principal:**
Uses Snapshot A's `exchange_rates` to convert all assets to TWD, then sums. This is the same logic used by the overview's TWD currency mode. If any required exchange rate is missing from Snapshot A (e.g., JPY assets exist but no `JPY_TWD` rate), show an error message below the strategy section (e.g., "缺少匯率: JPY_TWD") and skip strategy results. The rest of the comparison (per-item deltas, subtotals) still renders normally.

**Note on exchange rate asymmetry:** The actual Snapshot B total uses Snapshot B's exchange rates for TWD conversion, while hypothetical strategies use Snapshot A's rates for the principal. This is intentional — strategies model what would have happened to the TWD-denominated starting capital, while Snapshot B reflects actual current market rates.

**Day count:**
```javascript
const days = (new Date(b.date) - new Date(a.date)) / (1000 * 60 * 60 * 24);
```
**Edge case:** If `days <= 0` (same date or A is after B), strategy calculations are skipped and a warning is shown: "Snapshot A 必須早於 Snapshot B 才能計算假設策略". Subtotals and grand total still display normally.

**Compound interest (fixed deposit):**
```javascript
const result = principal * Math.pow(1 + rate / 100, days / 365);
```

**Index return:**
```javascript
const result = principal * (endPrice / startPrice);
```

**Mix:**
```javascript
const result = allocations.reduce((sum, alloc) => {
    const subPrincipal = principal * alloc.pct / 100;
    const subResult = calculateStrategy(subPrincipal, alloc.type, alloc.params, days);
    return sum + subResult;
}, 0);
```

### 7. UI Interactions

- **"+ 新增策略" button**: adds a new strategy row with type selector defaulting to "定存"
- **Type selector change**: swaps the parameter inputs for that row
- **"✕" button**: removes the strategy row
- **Mix sub-allocations**: "+ 新增配置" within the mix row to add sub-lines; each has its own "✕"
- **Compare button**: runs both the existing comparison AND strategy calculations
- Strategies are session-only; refreshing the page clears them

### 8. Currency Mode Integration

The compare view currently doesn't have currency toggle buttons (unlike overview). The subtotals need a currency context:

- Add currency toggle buttons (TWD / USD / Original) to the compare view, matching the overview's existing pattern
- The currency toggle affects all values in the compare table: per-item values, category subtotals, and the grand total row
- Grand total and strategy results always use TWD regardless of toggle (since that's the strategy principal basis)
- Category subtotals respect the selected currency mode
- In original currency mode for mixed-currency categories: show separate subtotal rows per currency (e.g., deposits with both TWD and USD items show a TWD subtotal + USD subtotal)
- All 7 asset categories (including crypto) get subtotals automatically

## Files to Modify

| File | Changes |
|------|---------|
| `web/app.js` | Strategy UI logic, subtotal/total calculation, `compareSnapshots()` rewrite, currency toggle for compare |
| `web/index.html` | Strategy input section HTML, currency toggle buttons for compare view |
| `web/style.css` | Styling for subtotal rows, total block, strategy inputs, strategy result columns |

## Non-Goals

- No backend changes needed (all calculation is client-side)
- No persistence of strategies
- No per-category hypothetical (only grand total)
- No forward projections
