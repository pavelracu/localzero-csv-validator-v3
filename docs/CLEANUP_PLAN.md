# Codebase Cleanup Plan

**Scope:** App (`app/src`) and Core (`core/src`). Identifies **unused** and **duplicated** components/elements and proposes a cleanup order.

**Status (latest pass):** ComplianceStepper removed. Orphaned Rust `core/src/rules/` removed. IssuesPanel is **in use** (App.tsx). auditGenerator, useTriageLog, listWorkspaces, updateFileMetadata, setRejectedRows kept and documented as reserved for future use.

---

## 1. Unused components & modules

| Item | Location | Notes |
|------|----------|--------|
| **StepIndicator** | `components/layout/StepIndicator.tsx` | **Removed.** Never imported; duplicate of ComplianceStepper. |
| **ComplianceStepper** | `components/workspace/ComplianceStepper.tsx` | **Removed.** Never imported; redundant with Sidebar as pipeline indicator. |
| **IssuesPanel** | `components/editor/IssuesPanel.tsx` | **In use.** Imported and rendered in `App.tsx`. Renders columns with errors and "Clear Cells" / "Revert Column"; used alongside FixPanel. |
| **useTriageLog** | `hooks/useTriageLog.ts` | Exported but **never called**. Kept and documented for Triage/Export view; wire when building that view. |
| **dropdown-menu** | `components/ui/dropdown-menu.tsx` | **Removed.** Never imported. |
| **generateAuditSummary** | `lib/auditGenerator.ts` | Exported but **never imported**. Kept and documented for future audit/export. |
| **listWorkspaces**, **updateFileMetadata**, **setRejectedRows** | `lib/workspaceDb.ts` | Exported but **never called**. Kept and documented for future workspace list / file metadata / "Permanently Reject" UI. |

**Recommendation**

- **In use (do not remove):** IssuesPanel, FixPanel, VirtualizedTable.
- **Keep but document:** `useTriageLog`, `auditGenerator.ts`, `listWorkspaces`, `updateFileMetadata`, `setRejectedRows` — reserved for future features.

---

## 2. Duplicated patterns

### 2.1 Redundant pipeline UI (header stepper vs sidebar) ✅ Done

**ComplianceStepper** (header: 1 Ingest, 2 Standard, 3 Triage, 4 Export) duplicated the **Sidebar** “Compliance Pipeline” (01 UPLOAD, 02 MAP & TRIAGE, 03 VALIDATE). **Removed** `ComplianceStepper.tsx` (was never imported). The Sidebar is now the single pipeline progress indicator; the header keeps only “LocalZero” + current stage label + actions (Validate, Export).

### 2.2 Stage → step index / labels

Two places still map `AppStage` to a step index or label:

| Location | What it does |
|----------|----------------|
| **Sidebar** | `stageToActiveIndex(stage)` → 0..1 (IMPORT→0; SCHEMA/PROCESSING/STUDIO→1); labels from `PIPELINE_STEPS`. |
| **AppHeader** | Inline `stage === 'IMPORT' && 'Import'`, etc. (Import, Schema, Validating, Triage). |

**Duplication:** Same enum (`AppStage`) mapped in two places; stage display labels are repeated (e.g. "Import", "Triage") and can get out of sync.

**Recommendation:** Add a single source of truth, e.g. `lib/stageHelpers.ts` or constants in `useDataStream.ts`:

- `STAGE_LABELS: Record<AppStage, string>` (e.g. for header subtitle).
- `getStepIndexForSidebar(stage): number` for Sidebar.

Then have Sidebar and AppHeader use these. Optional: one shared “step config” (label + optional sublabel) if you want ComplianceStepper and Sidebar to share structure.

### 2.3 Loading spinner (Loader2 + animate-spin)

Used in: `Layout.tsx` (persisting overlay), `App.tsx` (PROCESSING), `AppHeader.tsx` (Validate button), `FixPanel.tsx` (apply suggestion, refresh), `RowDetailPanel.tsx` (save), `Import.tsx` (loading file).

**Duplication:** Same pattern (Loader2 + `animate-spin`), not a shared component.

**Recommendation:** Low priority. Optionally add `components/ui/spinner.tsx` (or reuse a small `Loader` in layout) and replace repeated `<Loader2 className="animate-spin" />` for consistency and easier styling changes.

---

## 3. Cleanup plan (ordered)

### Phase 1: Remove clearly dead code (low risk) ✅ Done

1. **Delete `app/src/components/layout/StepIndicator.tsx`** — **Done.** No references.

2. **Delete `app/src/components/workspace/ComplianceStepper.tsx`** — **Done.** Not imported anywhere; redundant with Sidebar.

3. **Delete `core/src/rules/`** (mod.rs, ast.rs, evaluator.rs) — **Done.** Orphaned; not included in crate (`lib.rs` has no `mod rules`).

### Phase 2: Decide on useTriageLog and dropdown-menu ✅ Done

3. **useTriageLog**  
   — **Kept.** Triage log hook retained for Triage/Export view when needed; wire `useTriageLog(activeWorkspaceId)` in that view when building it.

4. **dropdown-menu**  
   — **Removed.** Unused; deleted `app/src/components/ui/dropdown-menu.tsx`. Re-add from shadcn if a column or export menu is added later.  

### Phase 3: Consolidate stage logic (optional, refactor)

5. **Introduce `lib/stageHelpers.ts`** (optional):  
   - Export `STAGE_LABELS`, `getSidebarStepIndex(stage)`.  
   - Refactor `Sidebar` and `AppHeader` to use these.

6. **(Optional)** Add a shared `Spinner` (or `Loader`) component and replace repeated Loader2+animate-spin usages.

### Phase 4: Leave as-is (document only) ✅ Done

7. **auditGenerator.ts**, **useTriageLog**, **listWorkspaces**, **updateFileMetadata**, **setRejectedRows**: Kept; file-level or JSDoc comments added. Wire when implementing audit report, Triage/Export view, workspace list, file metadata, and “Permanently Reject” UI.

**WASM surface:** `find_replace_all` and `load_dataset` (sync) are exposed from core but not called from the app (worker uses chunked `find_replace_range` and `load_dataset_with_progress`). Left as-is for optional external/sync use.

---

## 4. Summary

| Category | Items | Action |
|----------|--------|--------|
| **Dead – removed** | StepIndicator, ComplianceStepper, dropdown-menu, core/src/rules/ | Deleted. |
| **In use** | IssuesPanel, FixPanel, VirtualizedTable | Do not remove. |
| **Unused – keep and document** | auditGenerator, useTriageLog, listWorkspaces, updateFileMetadata, setRejectedRows | Documented; wire when building those features. |
| **Unused WASM** | find_replace_all, load_dataset (sync) | Left as-is; optional minimal-API cleanup later. |
| **Duplication** | Stage→index and stage labels | Centralize in stageHelpers (or similar). |
| **Duplication (minor)** | Loader2 + animate-spin | Optional: shared Spinner component. |

