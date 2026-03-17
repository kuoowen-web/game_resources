# Asset Tracker — Design Spec

## Overview

A local webapp for recording and analyzing personal asset snapshots. Static point-in-time records, not real-time tracking. Includes a built-in calculator for inputting live market prices and saving computed values back to snapshots.

## Goals

1. Record asset snapshots at arbitrary points in time
2. Edit snapshots via web UI or directly in JSON files
3. Calculate current market values by inputting live prices, save results back
4. Compare any two snapshots (diff with amounts and percentages)
5. View total asset trends over time (line chart)
6. Support multi-currency display (TWD, USD, or original currency)

## Project Structure

```
game_resources/
  data/
    snapshots/
      2026-03-17.json
      2026-04-15.json
  server/
    app.py                # Flask API server
  web/
    index.html            # Single page application
    style.css
    app.js
  docs/
    2026-03-17-asset-tracker-design.md   # This file
```

## Data Format

Each snapshot is a single JSON file: `data/snapshots/YYYY-MM-DD.json`

```json
{
  "date": "2026-03-17",
  "note": "Q1 整理",
  "exchange_rates": {
    "USD_TWD": 32.5
  },
  "assets": {
    "deposits": [
      {
        "name": "台銀活存",
        "currency": "TWD",
        "amount": 500000
      }
    ],
    "insurance": [
      {
        "name": "XX人壽美元儲蓄險",
        "type": "savings",
        "currency": "USD",
        "surrender_value": 15000,
        "annual_premium": 3000,
        "paid_years": 3,
        "total_years": 6
      },
      {
        "name": "重大傷病險",
        "type": "health",
        "currency": "TWD",
        "annual_premium": 25000
      }
    ],
    "bonds": [
      {
        "name": "A銀行債券",
        "currency": "USD",
        "units": 10,
        "face_value_per_unit": 1000,
        "coupon_rate": 0.045,
        "purchase_year": 2024,
        "maturity_year": 2029,
        "current_price_per_unit": 980,
        "market_value": 9800
      }
    ],
    "structured_products": [
      {
        "name": "B銀行結構型商品",
        "currency": "USD",
        "principal": 20000,
        "account_value": 19500,
        "linked_to": "S&P500",
        "maturity_date": "2027-06"
      }
    ],
    "tw_stocks": [
      {
        "name": "2330 台積電",
        "currency": "TWD",
        "shares": 10,
        "avg_cost": 580,
        "current_price": 950,
        "market_value": 9500
      }
    ],
    "us_stocks": [
      {
        "name": "VOO",
        "currency": "USD",
        "shares": 5,
        "avg_cost": 480,
        "current_price": 510,
        "market_value": 2550
      }
    ]
  }
}
```

### Asset Types and Fields

**deposits** — Bank and postal savings
- `name`: Account identifier
- `currency`: TWD or USD
- `amount`: Balance

**insurance** — Insurance policies
- `name`: Policy identifier
- `type`: `"savings"` (asset) or `"health"` (expense only)
- `currency`: TWD or USD
- `surrender_value`: Current surrender value (savings type only, this is the asset value)
- `annual_premium`: Yearly premium
- `paid_years`: Years of premiums paid so far
- `total_years`: Total years of premium payments

**bonds** — Bank-purchased bonds
- `name`: Bond identifier
- `currency`: TWD or USD
- `units`: Number of units held
- `face_value_per_unit`: Par value per unit
- `coupon_rate`: Annual coupon rate (decimal, e.g. 0.045 = 4.5%)
- `purchase_year`: Year of purchase
- `maturity_year`: Year of maturity
- `current_price_per_unit`: User-input live price (nullable, filled via calculator)
- `market_value`: Computed: `units * current_price_per_unit` (nullable, saved back on calculate)

**structured_products** — Bank structured products
- `name`: Product identifier
- `currency`: TWD or USD
- `principal`: Original investment amount
- `account_value`: Current account value (user-input from bank statement)
- `linked_to`: Underlying asset description
- `maturity_date`: Maturity date (YYYY-MM format)

**tw_stocks** — Taiwan stocks
- `name`: Ticker + name (e.g. "2330 台積電")
- `currency`: TWD
- `shares`: Number of shares
- `avg_cost`: Average cost per share (TWD)
- `current_price`: User-input live price (nullable, filled via calculator)
- `market_value`: Computed: `shares * current_price` (nullable, saved back on calculate)

**us_stocks** — US stocks / ETFs
- `name`: Ticker (e.g. "VOO", "AAPL")
- `currency`: USD
- `shares`: Number of shares
- `avg_cost`: Average cost per share (USD)
- `current_price`: User-input live price (nullable, filled via calculator)
- `market_value`: Computed: `shares * current_price` (nullable, saved back on calculate)

### Value Resolution

Each asset's "value" for totals is determined by:
- deposits → `amount`
- insurance → `surrender_value` if available (both savings and health types can have account value), else 0
- bonds → `market_value` if available, else `units * face_value_per_unit` (par value fallback)
- structured_products → `account_value`
- tw_stocks → `market_value` if available, else `shares * avg_cost` (cost basis fallback)
- us_stocks → `market_value` if available, else `shares * avg_cost` (cost basis fallback)

## API Design

Flask backend, serves static files and JSON API.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/snapshots` | List all snapshots (date + note) |
| GET | `/api/snapshots/<date>` | Get single snapshot |
| POST | `/api/snapshots` | Create new snapshot |
| PUT | `/api/snapshots/<date>` | Update snapshot (save calculator results, edit assets) |
| DELETE | `/api/snapshots/<date>` | Delete snapshot |

**Response format:**
- `GET /api/snapshots` returns `[{"date": "2026-03-17", "note": "Q1 整理"}, ...]`
- `GET /api/snapshots/<date>` returns the full snapshot JSON
- `POST /api/snapshots` returns the created snapshot. If a snapshot for that date already exists, it overwrites.
- `PUT /api/snapshots/<date>` returns the updated snapshot
- `DELETE /api/snapshots/<date>` returns `{"ok": true}`
- Errors return `{"error": "message"}` with appropriate HTTP status (400, 404, 500)

**Design constraint:** One snapshot per calendar day (filename = `YYYY-MM-DD.json`).

Static files (HTML/CSS/JS) served from `/web/`.

## Frontend Features

Single page application, pure HTML/CSS/JS + Chart.js.

### 1. Snapshot Overview

- Dropdown to select a snapshot by date
- Display all assets grouped by category
- Show subtotals per category
- Show grand total

### 2. Currency Display Modes

Three toggle modes:

| Mode | Per-asset display | Total |
|------|-------------------|-------|
| Original currency | TWD assets in TWD, USD assets in USD | Separate: total TWD + total USD |
| Convert to TWD | All converted to TWD | Single TWD total |
| Convert to USD | All converted to USD | Single USD total |

Conversion uses `exchange_rates.USD_TWD` from the snapshot.

### 3. Edit / Create Snapshot

- Form UI to add/edit/remove individual assets within a snapshot
- Create new snapshot (defaults to today's date, can copy from existing)
- Edit note and exchange_rates

### 4. Calculator (Inline)

- For bonds, tw_stocks, and us_stocks: input field for current price next to each item
- "Calculate" button computes market_value
- "Save" button writes current_price + market_value back to the snapshot JSON via PUT API

### 5. Snapshot Comparison

- Select two snapshots by date
- Side-by-side display per asset category
- Show delta (amount change) and percentage change
- Highlight new/removed assets
- **Asset matching**: assets are matched by `name` field within each category. Renamed assets appear as one removed + one added.

### 6. Time Series Chart

- Line chart (Chart.js) showing total asset value over all snapshots
- Toggle between TWD / USD / original currency mode
  - TWD mode: single line, all assets converted to TWD
  - USD mode: single line, all assets converted to USD
  - Original currency mode: two lines (total TWD assets + total USD assets), dual Y-axis
- Optional: breakdown by category (stacked area or multiple lines)

## Non-Goals

- Real-time price fetching (no external API calls)
- Authentication (local use only)
- Mobile-optimized layout (desktop-first, basic responsiveness is fine)
- Automated data import from banks
