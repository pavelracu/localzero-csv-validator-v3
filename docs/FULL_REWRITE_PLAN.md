# Full Rewrite Plan: Validate & Fix UI + New Column Type Validations

This document is the single source of truth for:
1. **UI rewrite** — Validate & fix phase: issue-type–first flow, current process visibility, progress/speed, background processing.
2. **Rust backend** — New "standard" column types (Excel/Sheets–style) with validation and resolution.

Target scale: **up to 10M rows**. Performance and non-blocking UX are first-class.

---

# Part 1: Full UI Rewrite Plan

## 1.1 Current State (Reference)

### Components and flow
- **`app/src/App.tsx`** — Composes `Layout`, `Import` / `Mapping` / `VirtualizedTable` by stage; wires `useDataStream`, workspace, triage log.
- **`app/src/components/workspace/Layout.tsx`** — AppHeader, Sidebar, main (children), `SystemVitalsHeader` footer. Props: `stage`, `rowCount`, `pendingValidationCount`, `isValidating`, `onRunValidation`, `onExport`, `canExport`, `isPersisting`.
- **`app/src/components/layout/AppHeader.tsx`** — Pipeline steps (SCHEMA → INGESTION → TRIAGE → EXPORT); "Validate N" when `pendingValidationCount > 0`; "Export CSV" when `canExport`. No current-process or progress/speed.
- **`app/src/components/workspace/SystemVitalsHeader.tsx`** — Engine: Ready/Loading/Saving, RAM, "Latency: 0 MS", Core version. No progress or throughput.
- **`app/src/components/grid/VirtualizedTable.tsx`** — Data grid; "View: All | Errors (N)"; column headers with error badge → opens **FixPanel** for that column; row click → **RowDetailPanel**. State: `fixingColumn`, `selectedRow`, `filterMode` ('all' | 'errors').
- **`app/src/components/editor/FixPanel.tsx`** — Sheet; title "Fix errors — {column.name}"; Suggested Fixes (from `getSuggestions(colIdx)`), Find & Replace, Manual Actions (Clear Invalid, Reset Column). Column-centric only.
- **`app/src/components/editor/RowDetailPanel.tsx`** — Sheet; "Row N Details"; form per column with `getErrorMessage(value, columnType)`; Save/Cancel. Row-centric; no bulk suggestions.

### Data and worker
- **`app/src/hooks/useDataStream.ts`** — State: `stage`, `schema`, `rowCount`, `errors` (Map<colIdx, Set<rowIdx>>), `pendingValidation`, `isLoadingFile`, `dataVersion`. Worker message handler: `VALIDATION_UPDATE` (merge errors), `VALIDATION_COMPLETE` (set stage STUDIO). No `currentProcess` or progress (rows/s).
- **`app/src/workers/data.worker.ts`** — `START_VALIDATION` → chunked loop (50k rows/chunk, `setTimeout(0)`); posts `VALIDATION_UPDATE` (errors only) and `VALIDATION_COMPLETE`. Has `currentStart`, `totalRows`, `startTime` but does **not** post progress/speed. `FIND_REPLACE_ALL` chunked; only final `FIND_REPLACE_ALL_COMPLETE`. No progress messages for any long op.

### Gaps
- User does not see **what** is running (validating vs applying fix vs find/replace vs loading).
- User does not see **speed** (rows/s) or **progress** (rows processed / total).
- Fix flow is **column-only** (click column badge → FixPanel); no **issue-type–first** view ("fix all invalid US phone" across columns).
- Heavy ops (`apply_suggestion`, `apply_correction`) are single blocking Wasm calls; no progress.

---

## 1.2 Goals

1. **Current process always visible** — User always knows: loading file, validating, applying fix, find/replace, analyzing column.
2. **Progress and speed** — For validation and find/replace (and later apply_suggestion if chunked): show rows processed, total rows, rows/s (and cells replaced for find/replace).
3. **Issue-type–first fix flow** — Primary entry: "Issues" panel grouped by **issue kind** (e.g. "Invalid US phone", "Invalid email") with suggested bulk action and "Apply"/"Preview"; column and row panels remain for drill-down and spot-edit.
4. **Background processing** — Long work stays in worker; main thread stays responsive; progress posts so UI can update.
5. **Export readiness** — Clear indication when validation is done and when 0 errors (or "export with remaining issues" if product allows).

---

## 1.3 Current Process State (New)

### 1.3.1 Type and location

**File:** `app/src/types.ts` (add) or a dedicated `app/src/types/process.ts`.

```ts
export type ProcessPhase =
  | 'idle'
  | 'loading_file'
  | 'validating'
  | 'applying_fix'
  | 'find_replace'
  | 'analyzing_column'
  | 'validating_column';

export interface CurrentProcess {
  phase: ProcessPhase;
  /** User-visible label, e.g. "Validating…", "Applying fix to Email (Work)…" */
  label: string;
  /** Rows processed so far (for validating, find_replace, applying_fix) */
  rowsProcessed?: number;
  /** Total rows (when known) */
  totalRows?: number;
  /** Throughput: rows per second (computed in worker or main) */
  rowsPerSec?: number;
  /** For find_replace: total cells replaced so far */
  cellsReplaced?: number;
  /** Optional detail: file name, column name, etc. */
  detail?: string;
  /** When process started (ms); optional for ETA */
  startedAt?: number;
}
```

**Hook:** `useDataStream` holds `currentProcess: CurrentProcess | null` and setter. Initially `null`. Any long operation sets it before sending to worker and clears it (or sets to idle) on completion/error.

**UI:** When `currentProcess !== null`, show it in place of (or next to) "Engine: Ready" in **SystemVitalsHeader**. Optionally a slim progress bar (e.g. `rowsProcessed / totalRows`) and "150k rows/s". When null, show "Engine: Ready".

---

## 1.4 Worker Progress Messages (New)

### 1.4.1 Validation

**Current:** Worker posts `VALIDATION_UPDATE` (errors) and `VALIDATION_COMPLETE`.

**Add:** After each chunk (or every 2–5 chunks to throttle), post:

```ts
// Worker -> Main
{ type: 'VALIDATION_PROGRESS'; payload: { rowsProcessed: number; totalRows: number; rowsPerSec: number } }
```

- `rowsProcessed` = `currentStart + chunkSize` (capped by `totalRows`).
- `rowsPerSec` = `rowsProcessed / ((Date.now() - startTime) / 1000)`.

**Main:** In `useDataStream` worker `onmessage`, on `VALIDATION_PROGRESS`: set `currentProcess` to `{ phase: 'validating', label: 'Validating…', rowsProcessed, totalRows, rowsPerSec }`. On `VALIDATION_COMPLETE`: set `currentProcess` to `null`.

### 1.4.2 Find & replace

**Current:** Worker runs chunked loop; posts only `FIND_REPLACE_ALL_COMPLETE`.

**Add:** After each chunk:

```ts
{ type: 'FIND_REPLACE_PROGRESS'; payload: { rowsProcessed: number; totalRows: number; cellsReplaced: number; rowsPerSec?: number } }
```

**Main:** On `FIND_REPLACE_PROGRESS`: set `currentProcess` to `{ phase: 'find_replace', label: 'Find & replace…', ... }`. On `FIND_REPLACE_ALL_COMPLETE`: set `currentProcess` to `null`.

### 1.4.3 Load file

No chunking (single parse). Before `LOAD_FILE`: main sets `currentProcess` to `{ phase: 'loading_file', label: 'Loading file…', detail: file.name }`. On `LOAD_COMPLETE` or `ERROR`: clear.

### 1.4.4 Apply suggestion / apply correction

No progress messages in v1 (single Wasm call). Before request: set `currentProcess` to `{ phase: 'applying_fix', label: 'Applying fix to …', detail: columnName }`. On `SUGGESTION_COMPLETE` / `CORRECTION_COMPLETE` / `ERROR`: clear.

### 1.4.5 Get suggestions

Before `GET_SUGGESTIONS`: set `currentProcess` to `{ phase: 'analyzing_column', label: 'Analyzing column…', detail: columnName }`. On `GET_SUGGESTIONS_COMPLETE` / `ERROR`: clear.

---

## 1.5 SystemVitalsHeader and Layout

- **SystemVitalsHeader** (`app/src/components/workspace/SystemVitalsHeader.tsx`):
  - Accept `currentProcess: CurrentProcess | null` (from Layout).
  - When `currentProcess` non-null: show `currentProcess.label` and, if present, `rowsProcessed`, `totalRows`, `rowsPerSec` (e.g. "2.1M / 10M · 150k rows/s"). Optional: progress bar.
  - When null: show "Engine: Ready" (and RAM, Core as today).
- **Layout** receives `currentProcess` from parent (App); passes to SystemVitalsHeader.
- **App** reads `currentProcess` from `useDataStream` and passes to Layout.

---

## 1.6 Issues Panel (Issue-Type–First)

### 1.6.1 Purpose

Primary entry for "fix errors": group errors by **issue type** (e.g. "Invalid US phone format", "Invalid email", "Extra whitespace") and show one suggested bulk action per type with "Apply"/"Preview". User can fix by **issue kind** instead of opening one column at a time.

### 1.6.2 Data shape (derived)

From current `errors: Map<colIdx, Set<rowIdx>>` and `schema`, derive **issue groups**:

- **Issue kind** = validation failure reason. Today we only have column type; so "issue kind" = column type name (e.g. `PhoneUS`, `Email`, `Date`) plus a fixed label ("Invalid US phone", "Invalid email", "Invalid date").
- **Grouping:** For each `colIdx` with `errors.get(colIdx)?.size > 0`, we have column name and type. Group by `columnType` (and optionally column name for "Invalid email in Email (Work)" vs "Invalid email in Email (Personal)").

**Minimal v1:** List groups as: `{ issueLabel: string; columnType: ColumnType; columns: { colIdx: number; colName: string; errorCount: number }[] }`. Sort by total error count descending.

**Example:**
- "Invalid US phone" → columns: [{ colIdx: 5, colName: "Phone (US)", errorCount: 67534 }, { colIdx: 8, colName: "Phone (Home)", errorCount: 120 }].
- "Invalid email" → columns: [{ colIdx: 3, colName: "Email (Work)", errorCount: 1782 }, …].

### 1.6.3 UI component: IssuesPanel

- **Location:** New file `app/src/components/editor/IssuesPanel.tsx` (or under `workspace/`).
- **Surface:** Sheet or side panel, opened when user clicks "Errors (N)" in the table header (or a dedicated "Issues" button in AppHeader when in STUDIO). So two entry points: (1) "Errors" tab/badge in VirtualizedTable, (2) optional "Issues" in header.
- **Content:**
  - Title: "Issues" or "Fix errors".
  - List of issue groups. Each group:
    - **Issue label** (e.g. "Invalid US phone format").
    - **Columns:** "Phone (US) (67,534), Phone (Home) (120)" with error counts.
    - **Suggested action:** One line from existing suggestions (e.g. "Format as (XXX) XXX-XXXX"). For v1, when user clicks a group, either open FixPanel for the first column with suggestions, or add "Apply to all" that calls `applySuggestion` for each column that has that suggestion (same suggestion kind per type).
  - Optional "Preview" (show 5 before/after) per group.

**Implementation note:** Suggestions today are per-column (`getSuggestions(colIdx)`). So "Apply to all columns in this issue group" = for each column in the group, get suggestions, find the one matching the issue (e.g. FormatPhoneUS for PhoneUS), apply it. No Rust change required for v1; only UI aggregation and loop.

### 1.6.4 Wiring

- **VirtualizedTable:** "Errors (N)" click: open IssuesPanel instead of (or in addition to) keeping FixPanel on column. State: `issuesPanelOpen: boolean`. When IssuesPanel open, optionally pass `errors`, `schema`, and callbacks `getSuggestions`, `applySuggestion` so IssuesPanel can show groups and apply.
- **FixPanel:** Still opened from column header badge (drill-down). Can also be opened from IssuesPanel "Fix this column".

---

## 1.7 FixPanel and RowDetailPanel (Evolution)

- **FixPanel:** Keep as-is for column-centric flow. Optional: add "Also fix same issue in other columns" that discovers other columns with same type and same suggestion and applies (same as IssuesPanel "Apply to all" for one type).
- **RowDetailPanel:** Keep; add optional "Suggest fix" per invalid cell: call same suggestion logic (e.g. FormatPhoneUS for that cell) and show before/after; user applies or edits. Requires either a per-cell apply from Rust (e.g. `apply_suggestion_to_cell`) or JS-side "get suggestion for this column type + value" (could be a small helper that runs the same transform as Rust for one value — duplicate logic — or a worker message "suggest for cell" that returns one suggestion result). Defer to post-MVP if needed.

---

## 1.8 Export readiness

- **Header:** "Export CSV" enabled when `errors` total count is 0 (or when product allows "export with errors").
- Optional: "Resolved: X / Y errors" or "0 errors — ready to export" in AppHeader or next to Export button. Derive total error count from `errors` Map (sum of Set sizes).

---

## 1.9 Implementation Order (UI)

1. **Phase A — Current process & progress**
   - Add `CurrentProcess` type and `currentProcess` state in `useDataStream`.
   - Worker: add `VALIDATION_PROGRESS` and `FIND_REPLACE_PROGRESS`; post them each chunk (or every N chunks).
   - useDataStream: handle these messages; set/clear `currentProcess` for validation, find/replace, load file, apply suggestion, apply correction, get suggestions.
   - SystemVitalsHeader: accept `currentProcess`; show label + rows/s + progress when non-null.
   - Layout + App: pass `currentProcess` through.

2. **Phase B — Issues panel**
   - Derive issue groups from `errors` + `schema` (by column type, then by column).
   - Add `IssuesPanel` component; open from "Errors (N)" or header "Issues".
   - For each group, show suggested action; "Apply" = apply same suggestion to each column in group (using existing `getSuggestions` + `applySuggestion`).

3. **Phase C — Polish**
   - Optional progress bar in footer.
   - Optional "Suggest fix" in RowDetailPanel (per cell).
   - Export readiness copy ("0 errors — ready to export").

---

# Part 2: New Validations (Rust Backend)

## 2.1 Design Principles

- **Performance:** No heavy regex in hot path where avoidable. Prefer fixed-format checks, length, character set loops, and existing crates (e.g. chrono for date/time).
- **Scale:** Validation already chunked in `validate_range`; new types must use the same `is_valid_fast` contract (single value, no allocation where possible).
- **Standard types:** Align with Excel/Google Sheets number formats and data types: Number (Integer, Float), Currency, Percentage, Date, Time, Boolean, Text, and identifiers (UUID).

---

## 2.2 New Column Types (Canonical List)

| ColumnType  | Description                | Validation (precise) | Resolution / suggestions |
|------------|----------------------------|----------------------|---------------------------|
| **Uuid**   | RFC 4122–style UUID        | 8-4-4-4-12 hex, optional hyphens; or 32 hex | NormalizeUuid (lowercase, add hyphens if 32 hex) |
| **Time**   | Time only                  | HH:MM or HH:MM:SS (24h); optional 12h with AM/PM | NormalizeTimeToIso (HH:MM:SS) |
| **Currency** | Numeric + optional symbol | Parse: strip $€£ , and spaces; then valid float | NormalizeCurrency (strip symbols, optional 2 decimals) |
| **Percentage** | Numeric, optional trailing % | Strip %; then valid float in [0,100] or [0,1] per policy | NormalizePercentage (e.g. 0.5 → "50%" or "50" per format) |
| **DateTime** (optional) | Date + time | Date part + time part (chrono NaiveDateTime) | NormalizeDateTimeIso |

**Existing:** Text, Integer, Float, Boolean, Email, PhoneUS, Date — unchanged.

---

## 2.3 Rust Changes (File-by-File)

### 2.3.1 `core/src/engine/schema.rs`

**Add enum variants:**

```rust
pub enum ColumnType {
    Text,
    Integer,
    Float,
    Boolean,
    Email,
    PhoneUS,
    Date,
    // NEW:
    Uuid,
    Time,
    Currency,
    Percentage,
    // Optional: DateTime,
}
```

**Validation rules (no regex for Uuid; fast path):**

- **Uuid**
  - **With hyphens:** Length 36; positions 8, 13, 18, 23 are `'-'`; others hex. Version nibble (position 15) in 1–5; variant nibble (position 20) in 8,9,a,b (case-insensitive). Implement with a simple loop over bytes (no regex).
  - **Without hyphens:** Length 32; all chars in `0-9a-fA-F`.
  - Empty string = valid.

- **Time**
  - Accept:
    - `HH:MM` (24h): 2 digits, `:`, 2 digits; HH 00–23, MM 00–59.
    - `HH:MM:SS`: same + `:SS` 00–59.
    - Optional 12h: same with HH 01–12 and trailing ` AM`/` PM` (case-insensitive).
  - Use chrono where possible (e.g. `NaiveTime::parse_from_str` with formats) or simple byte checks.

- **Currency**
  - Strip leading/trailing whitespace; strip one of `$`, `€`, `£`, `¥` at start; strip `,` (thousands separator); then `trim`. Parse remainder as f64. Valid if parse succeeds (and optionally range checks).

- **Percentage**
  - Strip trailing `%` and trim; parse as f64. Valid if parse succeeds and value in [0, 100] (or [0, 1] if we treat 0.5 as 50%; choose one policy and document).

**Implementation:** Add `lazy_static` or const for any shared pattern only if needed (e.g. time format). Prefer `chrono::NaiveTime::parse_from_str` for Time with a small list of formats to avoid regex.

**`is_valid_fast`:** Add `match` arms for `Uuid`, `Time`, `Currency`, `Percentage` calling the above rules.

---

### 2.3.2 `core/src/engine/parser.rs`

**`infer_column_type`:**
- Add `ColumnType::Uuid`, `ColumnType::Time`, `ColumnType::Currency`, `ColumnType::Percentage` to the `candidates` array. Order: put Uuid and Time before Date (so "2024-01-15 10:30" could be DateTime; for now Time is time-only). Example order: Boolean, Integer, Float, **Uuid**, **Time**, Date, Email, PhoneUS, **Currency**, **Percentage**.
- For Uuid: require high match rate (e.g. 90% of non-empty) and length/config checks so we don't misclassify.
- For Currency: values that parse after stripping $€£, (e.g. 1,234.56).
- For Percentage: values that parse after stripping % and are in [0, 100] or [0, 1].

**Optional:** Add `infer_column_type_with_hints(name: &str, sample: &[String])` that uses header name (e.g. "uuid", "guid", "time", "amount", "percent") to bias or override inference. Called from `parse_csv` if we pass header names into inference (currently we don't; can add in a follow-up).

---

### 2.3.3 `core/src/engine/mechanic.rs`

**New suggestion variants:**

```rust
pub enum Suggestion {
    // ... existing ...
    NormalizeUuid,           // 32 hex -> 8-4-4-4-12 lowercase; or already hyphenated -> lowercase
    NormalizeTimeToIso,      // HH:MM or 12h -> HH:MM:SS 24h
    NormalizeCurrency,       // Strip $€£,, trim; optional format to 2 decimals
    NormalizePercentage,     // 0.5 -> "50" or "50%" per format
}
```

**`analyze_column`:**
- For `col_type == ColumnType::Uuid`: count invalid values that would become valid after NormalizeUuid (e.g. 32 hex, or hyphenated but wrong case); push `SuggestionReport { suggestion: NormalizeUuid, ... }`.
- For `col_type == ColumnType::Time`: count invalid that parse after NormalizeTimeToIso; push NormalizeTimeToIso report.
- For `col_type == ColumnType::Currency`: count invalid that parse after stripping symbols; push NormalizeCurrency.
- For `col_type == ColumnType::Percentage`: count invalid that parse after stripping %; push NormalizePercentage.

**Resolution functions (new):**
- `normalize_uuid(s: &str) -> String`: if 32 hex chars, insert hyphens at 8,12,16,20 and lowercase; else if 36 chars with hyphens, lowercase; else return as-is.
- `normalize_time_to_iso(s: &str) -> Option<String>`: parse with chrono (HH:MM, HH:MM:SS, 12h); return Some(HH:MM:SS).
- `normalize_currency(s: &str) -> String`: strip $€£, and spaces, parse f64, format to 2 decimals (or keep as canonical string).
- `normalize_percentage(s: &str) -> String`: strip %, parse f64; format as "50%" or "50" (choose one).

Wire these in the single-cell branch of `apply_suggestion` (see lib.rs).

---

### 2.3.4 `core/src/lib.rs`

**`validate_column`:** In the `match type_name` add:

```rust
"Uuid" => ColumnType::Uuid,
"Time" => ColumnType::Time,
"Currency" => ColumnType::Currency,
"Percentage" => ColumnType::Percentage,
```

**`apply_suggestion`:** In the big `match &suggestion` add arms:

```rust
mechanic::Suggestion::NormalizeUuid => (mechanic::normalize_uuid(&old_val), false),
mechanic::Suggestion::NormalizeTimeToIso => (
    mechanic::normalize_time_to_iso(&old_val).unwrap_or_else(|| old_val.clone()),
    false,
),
mechanic::Suggestion::NormalizeCurrency => (mechanic::normalize_currency(&old_val), false),
mechanic::Suggestion::NormalizePercentage => (mechanic::normalize_percentage(&old_val), false),
```

**`apply_suggestion` — `should_apply`:** For these four, use "apply if new_val != old_val" (same as other normalizers). No special redaction branch.

**`update_schema`:** If schema is deserialized from JS with type names, ensure new type names are accepted (usually already via `ColumnSchema` with `detected_type` enum).

---

### 2.3.5 `core/src/engine/dataframe.rs`

No change if validation is only via `column.detected_type.is_valid_fast(val)` in `validate_range` and `validate_column_fast`. New types are handled once they're in `ColumnType` and `is_valid_fast`.

---

## 2.4 TypeScript / App Side

### 2.4.1 `app/src/types.ts`

**ColumnType:** Extend union:

```ts
export type ColumnType =
  | 'Text' | 'Integer' | 'Float' | 'Boolean' | 'Email' | 'PhoneUS' | 'Date'
  | 'Uuid' | 'Time' | 'Currency' | 'Percentage';
```

**Suggestion:** Add:

```ts
| 'NormalizeUuid'
| 'NormalizeTimeToIso'
| 'NormalizeCurrency'
| 'NormalizePercentage';
```

(Exact shape must match Rust serialization: string or object form per existing Suggestion style.)

---

### 2.4.2 `app/src/lib/columnNameHints.ts`

Add rules (before or after existing):

- `uuid`, `guid`, `id` (when we want UUID; avoid conflicting with Integer `id`) → `'Uuid'`. E.g. if tokens include `uuid` or `guid`, return `'Uuid'`; else if tokens include `id` and not `guid`, keep Integer or leave as-is.
- `time`, `created time`, `updated time`, `duration` → `'Time'`.
- `currency`, `amount`, `price`, `cost`, `revenue`, `salary`, `balance` → `'Currency'` (or keep `amount`/`price` as Float and add Currency as separate; document choice).
- `percent`, `percentage`, `pct`, `rate` (if not currency) → `'Percentage'`.

Return type already `ColumnType | null`; add new types to the union.

---

### 2.4.3 `app/src/components/wizard/Mapping.tsx`

Column type dropdown: add options for Uuid, Time, Currency, Percentage (same list as elsewhere: TYPES array or from a single constant list).

---

### 2.4.4 `app/src/components/grid/ColumnHeader.tsx`

No change (uses `ColumnType` for display; new types just appear).

---

### 2.4.5 `app/src/components/editor/RowDetailPanel.tsx`

**`getErrorMessage`:** Add cases:

- `'Uuid'`: e.g. `"${value}" is not a valid UUID. Expected format: 550e8400-e29b-41d4-a716-446655440000 (with or without hyphens)."`
- `'Time'`: e.g. `"${value}" is not a valid time. Expected HH:MM or HH:MM:SS (24h or 12h with AM/PM)."`
- `'Currency'`: e.g. `"${value}" is not a valid currency value. Expected a number, optionally with $, €, or commas."`
- `'Percentage'`: e.g. `"${value}" is not a valid percentage. Expected a number, optionally with %."`

---

### 2.4.6 Schema registry and presets

**`app/src/lib/schemas.ts`:** In `SchemaDefinition.columnHints`, allow new types as values. Example for GDPR-PII or KYC: add `'uuid'`/`'id'` → `'Uuid'` if needed.

---

## 2.5 Implementation Order (Rust + TS)

1. **Schema + validation** — schema.rs (enum + is_valid_fast for Uuid, Time, Currency, Percentage); no regex for Uuid (manual loop).
2. **Parser** — parser.rs infer_column_type: add candidates and logic for new types.
3. **lib.rs** — validate_column match; ensure update_schema/JS schema roundtrip.
4. **Mechanic** — mechanic.rs: NormalizeUuid, NormalizeTimeToIso, NormalizeCurrency, NormalizePercentage; analyze_column branches; resolution helpers.
5. **lib.rs apply_suggestion** — new match arms and should_apply for new suggestions.
6. **TS types** — types.ts ColumnType and Suggestion.
7. **columnNameHints** — new hints.
8. **Mapping** — dropdown options.
9. **RowDetailPanel** — getErrorMessage for new types.
10. **FixPanel** — no change (suggestions come from Rust; new types get new suggestions automatically).
11. **Optional:** IssuesPanel issue labels for new types ("Invalid UUID", "Invalid time", etc.).

---

## 2.6 UUID Validation (No Regex) — Precise Spec

- **Hyphenated (36 chars):**
  - Length exactly 36.
  - Bytes at 8, 13, 18, 23 must be `b'-'`.
  - All other bytes in `0-9a-fA-F`.
  - Byte 14 (version nibble): must be in `[1,2,3,4,5]` (ASCII 0x31–0x35 or hex).
  - Byte 19 (variant nibble): must be in `8,9,a,b,A,B` (hex).
- **Non-hyphenated (32 chars):** All 32 in `0-9a-fA-F`.
- Empty = valid.

---

# Document History

- Created: Full UI rewrite plan + new validations (Rust + TS). Target: 10M rows; performance and current-process visibility; issue-type–first fixes; standard column types with validation and resolution.
