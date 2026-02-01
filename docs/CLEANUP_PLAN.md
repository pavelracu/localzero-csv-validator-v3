# Codebase Cleanup Plan

**Scope:** App (`app/src`). Identifies **unused** and **duplicated** components/elements and proposes a cleanup order.

---

## 1. Unused components & modules

| Item | Location | Notes |
|------|----------|--------|
| **StepIndicator** | `components/layout/StepIndicator.tsx` | **Removed.** Never imported; duplicate of ComplianceStepper. |
| **IssuesPanel** | `components/editor/IssuesPanel.tsx` | Never imported. Renders a panel listing columns with errors and "Clear Cells" / "Revert Column" per column. **Overlaps with FixPanel** (per-column sheet used from `VirtualizedTable`). FixPanel is the one in use. |
| **useTriageLog** | `hooks/useTriageLog.ts` | Exported but **never called**. Only referenced in a comment in `WorkspaceContext.tsx`. Intended for Triage/Export view to read triage log from IndexedDB without storing it in React state. |
| **dropdown-menu** | `components/ui/dropdown-menu.tsx` | Full shadcn dropdown menu (Root, Trigger, Content, Item, etc.). **Never imported** anywhere. Likely added for future UI (e.g. column menu, export menu). |
| **generateAuditSummary** | `lib/auditGenerator.ts` | Exported but **never imported**. Added for Sprint 2 audit/export; keep for when ZIP export or audit report is wired. |
| **setRejectedRows** | `lib/workspaceDb.ts` | Exported but **never called**. Sprint 2 prep; keep and wire when "Permanently Reject" UI exists. |

**Recommendation**

- **Remove (dead code):** `StepIndicator.tsx`, `IssuesPanel.tsx`. They duplicate or overlap with `ComplianceStepper` and `FixPanel` and are not referenced.
- **Keep but document:** `useTriageLog` — either wire it where triage/export needs the log, or remove if that flow will use `getWorkspace(activeWorkspaceId).triageLog` directly.
- **Keep (future use):** `dropdown-menu.tsx` (if a menu is planned), `auditGenerator.ts`, `setRejectedRows`.

---

## 2. Duplicated patterns

### 2.1 Redundant pipeline UI (header stepper vs sidebar) ✅ Done

**ComplianceStepper** (header: 1 Ingest, 2 Standard, 3 Triage, 4 Export) duplicated the **Sidebar** “Compliance Pipeline” (01 UPLOAD, 02 MAP & TRIAGE, 03 VALIDATE). **Removed** ComplianceStepper from `AppHeader` and deleted `ComplianceStepper.tsx`. The Sidebar is now the single pipeline progress indicator; the header keeps only “LocalZero” + current stage label + actions (Validate, Export).

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

2. **Delete `app/src/components/editor/IssuesPanel.tsx`** — **Done.** No references.

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

### Phase 4: Leave as-is (document only)

7. **auditGenerator.ts** and **setRejectedRows**: Keep; wire when implementing audit report and “Permanently Reject” in the UI.

---

## 4. Summary

| Category | Items | Action |
|----------|--------|--------|
| **Unused – remove** | StepIndicator, IssuesPanel, ComplianceStepper, dropdown-menu | Deleted; redundant with Sidebar / FixPanel. |
| **Unused – decide** | useTriageLog | Kept for Triage/Export view. |
| **Unused – keep for now** | generateAuditSummary, setRejectedRows | Leave; wire in Sprint 2. |
| **Duplication** | Stage→index and stage labels | Centralize in stageHelpers (or similar). |
| **Duplication (minor)** | Loader2 + animate-spin | Optional: shared Spinner component. |

Applying Phase 1 gives immediate benefit (less dead code, fewer duplicate concepts). Phase 2–3 can be done in follow-up PRs.
