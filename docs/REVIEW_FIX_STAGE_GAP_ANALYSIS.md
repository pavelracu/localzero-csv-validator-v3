# Review/Fix Stage — What’s Done vs Missing

Analysis of the current codebase against the review/fix UX list. Organized by the same themes as the spec.

---

## 1. Organize by issue type first (not only by column)

| Spec | Status | Current implementation |
|------|--------|------------------------|
| Group by issue type (e.g. “Trim whitespace”, “Invalid PhoneUS”) | **Missing** | Errors are stored as `Map<colIdx, Set<rowIdx>>` only. No notion of “issue kind” or grouping by validation type. |
| Primary grouping = “what’s wrong”; optional filter by column | **Missing** | No UI that groups by issue type. FixPanel and table are column-first. |
| “Open all errors of this type” / apply one bulk fix per type | **Missing** | Fixes are per column only. No “fix all PhoneUS errors” across columns. |

**Summary:** No issue-type layer. Everything is column-centric.

---

## 2. OpenRefine: pattern-first, then bulk apply

| Spec | Status | Current implementation |
|------|--------|------------------------|
| Facet by error kind (and optionally by column) | **Missing** | Only “View: All / Errors” (filter rows that have any error). No facet by “PhoneUS invalid”, “Email invalid”, etc. |
| One-click “Fix all like this” for facet | **Missing** | FixPanel applies one suggestion to one column. No “apply to current facet” or “apply to all cells matching this error type”. |
| Operations apply to subset, not “one column” only | **Missing** | All apply operations are column-scoped (`applySuggestion(colIdx, suggestion)`, `applyCorrection(colIdx, strategy)`). |

**Summary:** No facets by error kind. No pattern-first bulk apply.

---

## 3. Bulk changes as a single workflow

| Spec | Status | Current implementation |
|------|--------|------------------------|
| Flow: upload/specify → review → confirm → apply | **Partial** | User picks column → FixPanel → Apply. No explicit “review pending changes” or “confirm changeset” step. |
| Single changeset / revert | **Partial** | `TriageLogEntry` stores `{ at, colIdx, action, suggestion }` in workspace. No UI that shows a single “pending changeset” or “applied fixes” list. |
| Review → Fix → Approve | **Missing** | No “Approve” or “Confirm bulk action” step. Apply is immediate. |
| Summary of pending/applied actions; undo per action or per column | **Missing** | Triage log exists in DB but is not shown in UI. No “Applied fixes” list. FixPanel has “Reset Column” (revert) for one column only; no per-action undo. |

**Summary:** Log exists; no pipeline UI, no changeset summary, no per-action undo.

---

## 4. Error summary that drives action

| Spec | Status | Current implementation |
|------|--------|------------------------|
| Dedicated “Issues” or “Fix” summary (not only the table) | **Missing** | No dedicated Issues/Fix panel. Table + column badges + FixPanel are the only entry points. |
| List actionable issue types with counts and “Fix” actions | **Missing** | No list like “Invalid PhoneUS (67,534) — Fix”. Column headers show error count per column only. |
| “Jump to first occurrence” / “Show in table” | **Partial** | “View: Errors” shows only rows with errors; no “jump to first error of type X” or link from a summary to table. |
| Table supports the fix workflow instead of being the only start | **Missing** | Primary flow is: open table → click column badge → FixPanel. No summary-first flow. |

**Summary:** No Issues/Fix summary panel. Table is the primary (and only) place to start fixing.

---

## 5. Progressive disclosure: fix in order of impact

| Spec | Status | Current implementation |
|------|--------|------------------------|
| High-impact fixes first (e.g. “Fix 67,534 phone errors in 2 columns”) | **Missing** | FixPanel shows suggestions for one column, not ordered by total impact. No cross-column “67,534 errors, 2 columns” line. |
| “What should I do first?” / “How many errors will that clear?” | **Missing** | Per-column error count exists; no aggregate “by issue type” counts or suggested order. |

**Summary:** No impact-first ordering or cross-column impact summary.

---

## A. Dual focus: “Issues” surface + table

| Spec | Status | Current implementation |
|------|--------|------------------------|
| Left/top “Issues” panel as primary control | **Missing** | Sidebar shows pipeline steps (Schema, Ingestion, Triage, Export), not an Issues list. |
| Group by issue type (columns + counts inside) | **Missing** | No structure like “Invalid PhoneUS → Phone (US) (67,534), Phone (Home) (120)”. |
| Each line: issue type, columns+counts, suggested action, Apply/Preview | **Missing** | FixPanel has Apply (and before/after example) but only for one column; no issue-type lines. |
| “All columns” vs “Per column” toggle | **Missing** | No such toggle. Flow is per column only. |
| Table: View All/Errors, row click → RowDetailPanel | **Done** | VirtualizedTable has “View: All / Errors” and row click opens RowDetailPanel. |
| Column badge opens FixPanel (or drill-down from Issues) | **Done** | Column header “Fix” opens FixPanel for that column. |

**Summary:** Table + column FixPanel exist. No Issues panel; no issue-type grouping.

---

## B. Suggestions by issue type (backend/API shape)

| Spec | Status | Current implementation |
|------|--------|------------------------|
| getIssues() / getIssueGroups() by issue kind | **Missing** | Only `get_suggestions(col_idx)` in Rust; returns `Vec<SuggestionReport>` for one column. No API that returns `{ issueKind, columns: [{ colIdx, colName, errorCount, suggestedAction }] }`. |
| Issue type = validation result + column type | **Missing** | Validation returns row indices per column (`validate_column` → invalid indices). No aggregation by “PhoneUS invalid” vs “Email invalid” etc. in backend or app. |
| One “Apply” per issue kind (or per issue kind + column) | **Missing** | Apply is always per column; no “apply this suggestion to all columns that have this issue type”. |

**Summary:** Backend is column-only. No issue-type–first API or aggregation.

---

## C. One “Fix all” per issue type (or per issue type + column)

| Spec | Status | Current implementation |
|------|--------|------------------------|
| “67,534 errors in 2 columns. Suggested fix: …” with Preview / Apply to all | **Missing** | FixPanel shows “Apply” per suggestion per column. No cross-column “Apply to all” for an issue type. |
| “Apply to Phone (US) only” (column granularity) | **Partial** | User can open FixPanel for one column and Apply there; that’s “per column” only, not “per issue type + optional column”. |

**Summary:** No “Fix all of this type” or “Apply to all columns with this issue”.

---

## D. RowDetailPanel: “Suggest fix” for the cell

| Spec | Status | Current implementation |
|------|--------|------------------------|
| Per invalid field: “Suggest fix” / “Auto-fix” | **Missing** | RowDetailPanel shows error message and an editable Input; no “Suggest fix” or “Auto-fix” button. |
| Same logic as bulk fix (e.g. FormatPhoneUS), before → after | **Missing** | No per-cell suggestion or preview. User must edit manually and Save. |

**Summary:** Row detail is edit-only. No per-cell suggestion consistent with bulk actions.

---

## E. Find & Replace: global + scoped

| Spec | Status | Current implementation |
|------|--------|------------------------|
| “In whole dataset” | **Done** | FixPanel: “Replace across entire dataset” and `findReplaceAll(find, replace)` apply globally. |
| “Only in columns with errors” / “Only in selected columns” | **Missing** | No scope option. Find & Replace is always whole-dataset. |

**Summary:** Global Find & Replace exists; no scoped (e.g. selected columns / error columns) option.

---

## F. Progress toward export

| Spec | Status | Current implementation |
|------|--------|------------------------|
| Header: “68,107 errors → 0” or “Resolved: 12,000 / 68,107” | **Missing** | App passes `errorCount={errors.size}` to Layout but Layout does not use it. AppHeader shows “Validate N” (pending columns) and “Export CSV”; no total error count or “resolved” count. |
| “Ready to export” when errors = 0 | **Missing** | Export is shown when `canExport` (stage === STUDIO, rowCount > 0). No explicit “0 errors — ready to export” state. |
| “Applied fixes” list with per-action undo | **Missing** | Triage log is stored (`triageLog` in workspace) but not displayed. No list of “Normalized US phones (67,534), Trimmed whitespace (500)” or per-action undo. |
| Phase feels like pipeline of fixes | **Missing** | No single “fix pipeline” UI; fixing is done column-by-column in FixPanel. |

**Summary:** Pipeline steps and Export button exist. No error-count/resolved summary in header, no “Applied fixes” list, no per-action undo.

---

## Summary table

| Area | Done | Partial | Missing |
|------|------|---------|---------|
| 1. Issue-type first | — | — | Grouping by issue type; “all errors of this type” |
| 2. Pattern-first / facets | — | View All/Errors | Facet by error kind; “Fix all like this” for facet |
| 3. Bulk workflow | — | Triage log in DB | Changeset UI; review→confirm→apply; per-action undo |
| 4. Error summary | — | View Errors; row click | Issues/Fix summary panel; “Jump to first”; Fix from summary |
| 5. Progressive disclosure | — | — | High-impact first; “what to do first” |
| A. Issues panel + table | Table; column FixPanel | — | Issues panel; group by issue type; Apply/Preview per type |
| B. Backend by issue type | — | — | getIssues() / getIssueGroups(); issue-type aggregation |
| C. Fix all per type | — | Apply per column | “Fix all this type”; Preview/Apply to all |
| D. RowDetailPanel | Edit + Save; error message | — | “Suggest fix” / “Auto-fix” per cell; before→after |
| E. Find & Replace | Global replace | — | Scope: selected columns / columns with errors |
| F. Progress to export | Pipeline steps; Export button | — | “X errors → 0”; Applied fixes list; per-action undo |

---

## What exists today (concise)

- **Table:** VirtualizedTable with View All/Errors, column headers with type + error count, “Fix” opens FixPanel for that column.
- **FixPanel (per column):** Suggested fixes (from `get_suggestions(colIdx)`), Apply per suggestion, before/after example; Find & Replace (whole dataset); Clear invalid cells; Reset column.
- **RowDetailPanel:** Row fields, error message per cell, edit and Save; no “Suggest fix”.
- **Backend:** `get_suggestions(col_idx)`, `apply_suggestion(col_idx, suggestion)`, `validate_column(col_idx, type)`; errors are column → set of row indices; no issue-type API.
- **Header:** Pipeline steps, “Validate N” (pending columns), “Export CSV”; no total/resolved error count.
- **Sidebar:** Pipeline (Schema, Ingestion, Triage, Export); no Issues list.
- **Persistence:** Workspace with `triageLog` (at, colIdx, action, suggestion); not shown in UI.

---

## Suggested implementation order

1. **Backend:** Add or derive issue-type aggregation (e.g. from validation + column type) and expose `getIssueGroups()` (or equivalent) with issue kind, columns, counts, suggested action.
2. **UI:** Add an Issues panel (left or top) that consumes that API: group by issue type, show columns+counts, Apply/Preview per type (and optionally per column).
3. **Flow:** “Fix all of this type” that applies the same suggestion to all columns in that issue group (reusing existing `apply_suggestion` per column under the hood).
4. **Progress:** Show total error count (and optionally “resolved”) in header; optionally “Applied fixes” from triage log with per-action undo.
5. **RowDetailPanel:** Add “Suggest fix” per invalid cell using same suggestion logic as bulk, with before/after.
6. **Find & Replace:** Add scope (e.g. “whole dataset” vs “selected columns” or “columns with errors”).

This keeps the current column/table flow working while adding the issue-type–first path and progress toward export.
