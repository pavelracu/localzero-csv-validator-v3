# Full Rewrite Plan — Implementation Checklist

This checklist tracks implementation status against `docs/FULL_REWRITE_PLAN.md`.  
**Last updated:** from plan verification pass (parse slowdown fix, validation progress bar, checklist).

---

## Part 1: Full UI Rewrite Plan

### 1.3 Current Process State
| Item | Status | Notes |
|------|--------|--------|
| `ProcessPhase` and `CurrentProcess` in `types.ts` | ✅ | Done |
| `useDataStream` holds `currentProcess`, set/clear on long ops | ✅ | load, validate, find/replace, apply suggestion, apply correction, get suggestions |
| UI shows current process in SystemVitalsHeader | ✅ | Label + progress bar + rows/s when non-null |

### 1.4 Worker Progress Messages
| Item | Status | Notes |
|------|--------|--------|
| `VALIDATION_PROGRESS` (rowsProcessed, totalRows, rowsPerSec) | ✅ | Posted after each chunk |
| Main: set currentProcess on VALIDATION_PROGRESS; clear on VALIDATION_COMPLETE | ✅ | useDataStream |
| `FIND_REPLACE_PROGRESS` after each chunk | ✅ | cellsReplaced, rowsPerSec |
| Main: set/clear currentProcess for find/replace | ✅ | useDataStream |
| Load file: set currentProcess before LOAD_FILE; clear on LOAD_COMPLETE/ERROR | ✅ | useDataStream |
| Apply suggestion / correction: set before request; clear on _COMPLETE/ERROR | ✅ | useDataStream |
| Get suggestions: set (analyzing_column); clear on GET_SUGGESTIONS_COMPLETE/ERROR | ✅ | useDataStream |

### 1.5 SystemVitalsHeader and Layout
| Item | Status | Notes |
|------|--------|--------|
| SystemVitalsHeader accepts `currentProcess` | ✅ | Shows label, rows/total, rows/s, progress bar |
| Layout receives currentProcess from App; passes to SystemVitalsHeader | ✅ | LayoutProps + pass-through |
| App reads currentProcess from useDataStream and passes to Layout | ✅ | App.tsx |

### 1.6 Issues Panel (Issue-Type–First)
| Item | Status | Notes |
|------|--------|--------|
| Derive issue groups from errors + schema (by type, then column) | ❌ | Phase B — not implemented |
| New `IssuesPanel.tsx` (Sheet/side panel) | ❌ | Phase B |
| Open from "Errors (N)" in VirtualizedTable or "Issues" in header | ❌ | Phase B |
| Per-group Apply (getSuggestions + applySuggestion per column) | ❌ | Phase B |

### 1.7 FixPanel and RowDetailPanel
| Item | Status | Notes |
|------|--------|--------|
| FixPanel: keep column-centric | ✅ | As-is |
| Optional "Also fix same issue in other columns" | ❌ | Deferred |
| RowDetailPanel: keep | ✅ | As-is |
| Optional "Suggest fix" per invalid cell | ❌ | Phase C / deferred |

### 1.8 Export Readiness
| Item | Status | Notes |
|------|--------|--------|
| "Export CSV" enabled when 0 errors (or product policy) | ⚠️ | Currently `canExport={stage === 'STUDIO' && rowCount > 0}` — not gated on error count |
| Optional "Resolved: X / Y" or "0 errors — ready to export" | ❌ | Phase C |

### 1.9 Implementation Order (UI)
| Phase | Status | Notes |
|-------|--------|--------|
| **Phase A** — Current process & progress | ✅ | currentProcess, VALIDATION_PROGRESS, FIND_REPLACE_PROGRESS, load progress bar (Import), footer progress bar (SystemVitalsHeader) |
| **Phase B** — Issues panel | ❌ | Not started |
| **Phase C** — Polish | ❌ | Optional progress bar done; rest deferred |

### Load / Parse Performance
| Item | Status | Notes |
|------|--------|--------|
| Progress callback for load (bytes scanned) | ✅ | `load_dataset_with_progress`; Import shows determinate bar |
| Parse overhead minimized | ✅ | `PROGRESS_INTERVAL` increased to 1MB to reduce WASM↔JS callbacks |

---

## Part 2: New Validations (Rust Backend)

### 2.3 Rust Changes
| File | Item | Status | Notes |
|------|------|--------|--------|
| **schema.rs** | Uuid, Time, Currency, Percentage enum variants | ✅ | Done |
| **schema.rs** | is_valid_fast for new types (no regex for Uuid) | ✅ | Done |
| **parser.rs** | infer_column_type candidates (Uuid, Time, Currency, Percentage) | ✅ | Done |
| **parser.rs** | Optional header-based hints | ❌ | Deferred |
| **mechanic.rs** | NormalizeUuid, NormalizeTimeToIso, NormalizeCurrency, NormalizePercentage | ✅ | Done (per earlier work) |
| **mechanic.rs** | analyze_column branches for new types | ✅ | Done |
| **lib.rs** | validate_column match arms for new type names | ✅ | Done |
| **lib.rs** | apply_suggestion match arms + should_apply for new suggestions | ✅ | Done |

### 2.4 TypeScript / App
| Item | Status | Notes |
|------|--------|--------|
| **types.ts** — ColumnType: Uuid, Time, Currency, Percentage | ✅ | Done |
| **types.ts** — Suggestion: NormalizeUuid, NormalizeTimeToIso, NormalizeCurrency, NormalizePercentage | ✅ | Done |
| **columnNameHints.ts** — uuid/guid, time/duration, currency/amount/…, percent/percentage/pct | ✅ | Done |
| **Mapping.tsx** — type dropdown (Uuid, Time, Currency, Percentage) | ✅ | TYPES + TYPE_ICONS |
| **RowDetailPanel** — getErrorMessage for Uuid, Time, Currency, Percentage | ✅ | Done |
| **schemas.ts** — columnHints may use new types | ✅ | Can use; no change required |

### 2.5 UUID Validation (No Regex)
| Item | Status | Notes |
|------|--------|--------|
| 36-char hyphenated + 32-char hex; version/variant nibbles | ✅ | schema.rs |

---

## Summary

- **Part 1 Phase A:** Complete (current process, validation/find-replace progress, load progress bar, footer progress bar).
- **Part 1 Phase B (Issues panel):** Not implemented.
- **Part 1 Phase C (polish):** Export readiness copy and optional “Suggest fix” not done.
- **Part 2 (new validations):** Rust and TS sides complete for Uuid, Time, Currency, Percentage.
- **Parse performance:** Progress callback interval increased to 1MB to reduce slowdown from WASM↔JS calls.
