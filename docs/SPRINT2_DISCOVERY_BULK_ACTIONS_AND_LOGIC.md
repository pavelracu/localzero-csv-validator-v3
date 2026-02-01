# Sprint 2 Discovery: Bulk Actions & Logic

**Role:** CTO / Senior Architect  
**Scope:** Wasm–JS bridge, validation logic, rejection storage, and export path for Bulk Resolution.

---

## 1. Wasm Capabilities (Bulk Find & Replace / Regex Format)

### Current State

- **`core/src/lib.rs`** exposes:
  - `load_dataset`, `get_rows`, `validate_chunk`, `validate_column`, `get_suggestions`, `apply_suggestion`, `apply_correction`, `update_schema`, `update_cell`.
- **`app/src/workers/data.worker.ts`** wires:
  - `APPLY_SUGGESTION` → `apply_suggestion(colIdx, suggestion)` (single suggestion per column).
- **`core/src/engine/mechanic.rs`** defines **`Suggestion`** enum with:
  - `TrimWhitespace`, `RemoveChars { chars }`, `DigitsOnly`, phone/date/boolean/PII normalizers, `FuzzyMatchCategorical`, etc.
  - **No** generic “Find and Replace” (literal or regex) across a column.
  - Closest: `RemoveChars { chars }` (removes a fixed substring everywhere). No `(search, replace)` or regex-based transform.

**Conclusion:** The engine **cannot** today do “Find and Replace” or “Regex Format” across an entire column. All bulk edits are single-suggestion-per-column (e.g. TrimWhitespace, NormalizeDateToIso).

### Gap & Proposal: `BulkAction` (or extend `Suggestion`)

- **Gap:** No Wasm API that accepts:
  - Literal find/replace: `(search: string, replace: string)` for a column.
  - Regex-based replace: `(pattern: string, replacement: string)` for a column (with clear semantics: first match vs global, capture groups, etc.).
- **Proposal (minimal):**
  1. **Option A – New enum in Rust:** Add a `BulkAction` enum (or extend `Suggestion`) with:
     - `FindReplace { search: String, replace: String }` (literal, replace all).
     - `RegexReplace { pattern: String, replacement: String }` (use existing `regex` crate; e.g. replace all matches).
  2. **Rust:** Implement a single function that iterates the column (same pattern as `apply_suggestion`: iterate rows, get cell, transform, write to `patches`), e.g. `apply_bulk_action(col_idx, action) -> usize` (cells changed count).
  3. **lib.rs:** Export `apply_bulk_action(col_idx: usize, action_js: JsValue) -> Result<usize, JsValue>`.
  4. **Worker:** New message `APPLY_BULK_ACTION` with `{ colIdx, action, id }`; on completion post `BULK_ACTION_COMPLETE` with count.
  5. **UI:** Bulk-action UI (e.g. “Find & Replace”, “Regex format”) calls worker and refreshes grid/validation as needed.

**Regex safety:** Validate/limit pattern (e.g. length, avoid catastrophic backtracking) or run in a timeout; document that regex runs in Wasm on the main worker thread.

---

## 2. Validation Logic (Cross-Column / Conditional Rules)

### Current State

- **`core/src/rules/mod.rs`** only re-exports `ast` and `evaluator`; **`ast.rs` and `evaluator.rs` are empty.** There is no rule engine.
- **`core/src/engine/dataframe.rs`**:
  - `validate_range(start_row, limit)` and `validate_column_fast(col_idx, col_type)` only check **per-column type validity** (`column.detected_type.is_valid_fast(val)`). No cross-column or conditional logic.
  - Output is a flat list `[row, col, row, col, ...]` or a list of row indices for one column.

**Conclusion:** Cross-column dependencies (e.g. “If Col A is 'X', Col B must be 'Y'”) are **not** implemented. Validation is column-independent and type-only.

### Gap & Proposal: Minimal “Conditional Validation” in Rust

- **Gap:** No way to express or evaluate rules like: “If Col A == 'X' then Col B must match pattern/type/value.”
- **Proposal (minimal):**
  1. **Rule representation (AST):**
     - `Condition`: e.g. `ColEquals(col_idx, value)` or `ColMatches(col_idx, regex)` (or a small expression tree).
     - `Assertion`: e.g. `ColMustBeValid(col_idx)` or `ColEquals(col_idx, value)` or `ColMatches(col_idx, regex)`.
     - `Rule { when: Condition, then: Assertion }`.
  2. **Evaluator:** For each row in range, evaluate `when` (using current cell values from `get_cell`/row view). If true, evaluate `then`; if assertion fails, emit `(row_idx, col_idx)` into the same error shape the UI already uses.
  3. **Integration:**
     - **Option A:** Extend `validate_range` to accept an optional list of `Rule`s and append rule violations to the existing error list.
     - **Option B:** New Wasm function `validate_rules(start_row, limit, rules_js) -> Vec<(row, col)>` and run it after (or alongside) chunked type validation; worker merges both error sources.
  4. **Schema for rules:** Store rules in JS (e.g. workspace or session); pass rules into Wasm when validating. No need to persist rules in IndexedDB for MVP unless product requires it.

**Minimal first step:** One condition type (e.g. “Col A equals string”) and one assertion type (“Col B is valid for its type” or “Col B equals string”). Then add regex/match and more condition/assertion types as needed.

---

## 3. Rejection Storage (Permanently Rejected Rows)

### Current State

- **`app/src/types.ts`** – `WorkspaceMeta`: `id`, `createdAt`, `updatedAt`, `fileMetadata`, `schemaSnapshot`, `triageLog`.
- **`app/src/lib/workspaceDb.ts`** – get/put workspace, `addTriageLogEntry`, `updateFileMetadata`, `updateSchemaSnapshot`. No API for “rejected rows.”

**Conclusion:** There is no storage for “permanently rejected” row indices. The UI cannot persist which rows the user has rejected across sessions or use them for export/validation filtering.

### Proposal: Schema and API for Rejected Rows

- **Schema change (WorkspaceMeta):**
  - Add **`rejectedRowIndices?: number[]`** (optional for backward compatibility). Simple and sufficient for moderate numbers of rejected rows (e.g. hundreds to low thousands).
  - **Alternative for very large reject sets:** Add **`rejectedRowSet?: Record<number, true>`** (object as set) or a **bitset** (e.g. base64-encoded bit string or `Uint8Array` stored in a blob). For Sprint 2, an array is likely enough; bitset can be added later if needed for memory/serialization.
- **IndexedDB:** No migration needed; new optional fields are backward compatible. Existing `putWorkspace`/`getWorkspace` continue to work.
- **workspaceDb API:**
  - `setRejectedRows(workspaceId: string, indices: number[]): Promise<void>` (replace full set), and/or
  - `addRejectedRows(workspaceId: string, indices: number[]): Promise<void>`, `removeRejectedRows(workspaceId: string, indices: number[]): Promise<void>` if you need incremental updates.
  - Implementation: `getWorkspace` → clone, set `rejectedRowIndices` (or merge for add/remove), `putWorkspace`.
- **Usage:** Triage/Studio UI marks rows “Permanently Rejected” → update `rejectedRowIndices`; export and validation can exclude these rows (export filters them out; validation may skip or gray them depending on product).

---

## 4. Streaming ZIP Export

### Current State

- **`app/src/App.tsx` – `handleExportCSV`:**
  - Fetches rows in chunks (e.g. 1000) via `fetchRows`, accumulates full CSV in memory (`rows: string[]`), then builds one blob and triggers download. No ZIP; no streaming to disk; no use of rejected rows.
- No ZIP library or streaming export in the repo.

**Conclusion:** Export is single-CSV, in-memory. There is no streaming ZIP export.

### Gaps to Close for “Streaming ZIP Export”

1. **ZIP packaging (JS):** Use a streaming ZIP library (e.g. JSZip, or a streaming writer if available) so that:
   - One or more files (e.g. `data.csv`, optional `manifest.json` or `rejected.csv`) can be added to a ZIP without holding the whole ZIP in memory if the library supports streaming.
2. **Streaming source of CSV:** Instead of accumulating all rows in a single array:
   - Keep chunked `get_rows(start, limit)` (or equivalent) and write each chunk’s CSV segment to the ZIP or to a writable stream that feeds the ZIP. That way memory stays bounded by chunk size.
3. **Rejected rows:** Use `rejectedRowIndices` (once implemented) to:
   - Option A: Write only non-rejected rows to `data.csv` inside the ZIP.
   - Option B: Write full dataset to `data.csv` and a separate `rejected.csv` (or manifest listing rejected indices) for audit.
4. **Wasm:** No strict requirement for Wasm to “stream” if the worker already exposes chunked `get_rows`. If a future design moves export into a worker, the worker can call `get_rows` in a loop and pass chunks to a streaming ZIP writer. No change to Rust is required for “streaming” per se; the gap is on the JS side (streaming ZIP writer + chunked read).

**Summary:** Close the gap by (1) adding a JS streaming ZIP solution, (2) feeding it from chunked `get_rows` (and optionally filtering by `rejectedRowIndices`), and (3) persisting rejected rows in `WorkspaceMeta` as above.

---

## 5. High-Level Summary: Wasm–JS Gaps for Sprint 2

| Capability | Current state | Gap | Direction |
|------------|----------------|-----|-----------|
| **Bulk Find & Replace** | Only column-wide single-suggestion (e.g. Trim, RemoveChars). No generic find/replace or regex. | Add Rust `BulkAction` (or extend `Suggestion`) with `FindReplace` and `RegexReplace`; export `apply_bulk_action`; worker message `APPLY_BULK_ACTION`; UI for bulk action. | Rust + Worker + UI |
| **Cross-column “If-Then” rules** | Rules AST/evaluator are empty. Validation is per-column type-only. | Implement minimal `Rule { when, then }` in `rules/ast.rs`, evaluator in `rules/evaluator.rs`, and either extend `validate_range` or add `validate_rules`; pass rules from JS. | Rust (rules + dataframe integration) + JS (pass rules, merge errors) |
| **Rejected rows persistence** | Not stored. | Add `rejectedRowIndices?: number[]` to `WorkspaceMeta`; implement `setRejectedRows` (and optionally add/remove) in `workspaceDb.ts`; use in UI and export. | types.ts + workspaceDb + UI + export |
| **Streaming ZIP export** | Single CSV export in memory; no ZIP. | Add JS streaming ZIP; feed from chunked `get_rows`; optionally exclude or separate rejected rows using `rejectedRowIndices`. | JS (ZIP lib + export flow) |

These are the Wasm–JS and schema gaps to close to support **Bulk Find & Replace**, **cross-column conditional validation**, and **streaming ZIP export**, with **rejected rows** persisted and used in export and triage.
