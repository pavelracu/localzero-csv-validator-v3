# LocalZero UI/UX Improvement Recommendations

**Aligned with:** Product Strategy v1.0, Product Brief  
**Focus:** Trust, clarity, and time-to-valid

**Stages (from app):** `IMPORT` → `SCHEMA` → `PROCESSING` → `STUDIO`

---

## 1. Trust & Privacy (Strategy: Zero-Trust, Air-Gapped)

### 1.1 **Prominent Privacy Badge on Every Screen**
**Current:** StatusBar shows "Privacy: Local Processing" in footer; IMPORT screen has no badge on the drop zone.

**Recommendations:**
- **IMPORT (drop zone):** Add a clear badge *inside* the drop card:  
  `🟢 Offline — Data never leaves your device`  
  Use green dot + short line; optional ShieldCheck icon.
- **Header (all stages):** Show a compact badge next to the app title: `Data stays local` with icon.
- **StatusBar:** Use simple copy: "🟢 Data is local" or "Offline — Data secure" so it reads as a certification, not just a label.

**Impact:** Reinforces zero exfiltration and supports security-focused buyers.

---

### 1.2 **Offline Readiness Signal**
**Strategy:** App must work 100% if network is disconnected after load.

**Recommendations:**
- After initial load (Wasm ready), show a one-time or subtle line:  
  "Ready to work offline" or "You can disconnect — all processing is local."
- Optional: In StatusBar, replace "Memory: N/A" with a small "Works offline" indicator.

**Impact:** Makes the differentiator clear in-product.

---

## 2. Filter: All Rows vs Errors Only (Must-Have MVP)

**Brief:** Toggle between "All Data" and "Errors Only".  
**Current:** In STUDIO, VirtualizedTable shows all rows; errors are highlighted but there is no filter.

**Recommendations:**
- Add a **segmented control** (or tabs) above the grid in **STUDIO**:  
  **All rows** | **Errors only**
- "Errors only" shows only rows that have at least one validation error (use existing `errors` Map).
- Default to "All rows"; when the user switches to "Errors only," scroll can reset to top. Optionally persist the choice in session state.
- Use clear labels and optional counts, e.g. `All (1,234,567)` and `Errors (450)`.

**Impact:** Delivers the stated MVP filter and speeds up the fix workflow.

---

## 3. Desktop-Required Guardrail (Risk R2)

**Strategy:** "Device detection. Hard-block files >50MB on mobile with 'Please use Desktop' prompt."

**Recommendations:**
- **Device / capability check on load:**  
  - Detect mobile (e.g. narrow viewport + touch, or UA).  
  - If mobile, show a **single full-screen state** before any file drop:  
    - Illustration or icon (e.g. desktop monitor).  
    - Headline: "Desktop required."  
    - Body: "To process large files securely on your device, LocalZero requires a desktop browser. Please open this page on a computer."  
    - No file input visible; no way to proceed.  
  - Optional: still allow a small file (<1MB?) on mobile for a "preview" mode with a warning.
- **File size on desktop:**  
  - For files >~500MB–1GB, consider a confirmation step: "This file is very large. Processing may take a minute. Continue?" to set expectations and avoid perceived freezes.

**Impact:** Mitigates mobile OOM risk and matches strategy.

---

## 4. Workflow Clarity (Use App Stages)

**Stages in code (App.tsx / useDataStream):** `IMPORT` | `SCHEMA` | `PROCESSING` | `STUDIO`

**Recommendations:**
- **Progress / step indicator:**  
  - Use the same stage names: **IMPORT** → **SCHEMA** → **PROCESSING** → **STUDIO**.  
  - Optional short labels underneath: "Upload" → "Schema" → "Validating" → "Review & fix".
- **Microcopy by stage:**  
  - **IMPORT:** Subtitle e.g. "Your data never leaves this device."  
  - **SCHEMA:** "Set column types" or "Confirm types" — this is where validation rules are chosen. Load and save schema here.  
  - **PROCESSING:** Keep Loader2 + row count; add one line: "Validation runs locally — no data is uploaded."  
  - **STUDIO:** "Review and fix errors" — this is where bulk fixes happen.  
  - Add an explicit **Export** or **Submit** action (e.g. "Export CSV" or "Submit") so the workflow has a clear end.

**Impact:** Aligns UI with the app’s stages and keeps wording simple.

---

## 5. Time to Valid (Key Metric)

**Strategy:** Seconds from file drop to "All Valid".

**Recommendations:**
- **After validation completes:**  
  - If 0 errors: show a small success (StatusBar or toast): "All valid — ready in X.Xs" (from load/confirm to validation complete).  
  - If there are errors: show "X errors in Y columns" (you already have some of this).
- **StatusBar:**  
  - When `errorCount === 0`, make "All Valid" prominent (green check + same phrase) and optionally show the time for the current session.
- **Export / Submit:**  
  - Enable "Export" or "Submit" only after validation has run; optionally allow export with a "Export with errors" warning.

**Impact:** Surfaces the key metric and reinforces performance.

---

## 6. Fix Panel (Resolve Errors)

**Current:** FixPanel exists and is type-aware; it slides out when the user clicks a column with errors.

**Recommendations:**
- **Title:** Use plain language: "Fix errors — [Column name]" or "Resolve errors in [Column name]".  
  - Subtitle: "Fixes for [Phone/Email/Date/…]."
- **Order of actions:**  
  - Put **suggested fixes** first (e.g. "Format as (###) ###-####"), then **manual** actions (Clear invalid cells, Revert column).  
  - Make the main action (e.g. "Apply" for a suggestion) the default.
- **Feedback:**  
  - After applying a fix: "Applied. Re-validating…" then "X errors fixed" or "Column valid."  
  - If nothing could be fixed: "No automatic fix. Use Clear or Revert if needed."
- **Discoverability:**  
  - In column header, keep error count + "Fix" button; tooltip: "Fix errors in this column."

**Impact:** Clear, familiar wording and a clearer fix flow.

---

## 7. IMPORT Screen & First Impression

**Recommendations:**
- **Drop zone:**  
  - Add the privacy badge (see 1.1).  
  - Under "Upload CSV Data File": "Process up to 1GB. 100% in your browser."
- **Presets:**  
  - If no presets: "No saved presets yet. Set column types once and save a preset for next time."  
  - If presets exist: a small "Saved presets" label above the list.
- **Loading (right after drop):**  
  - Show "Reading file…" or "Parsing…" with: "Processing locally — no upload."

**Impact:** Builds trust and sets expectations.

---

## 8. Export / Submit (Complete the Loop)

**Brief:** Click "Submit" → data passed to host app (or downloaded).

**Current:** No explicit Export or Submit in the UI.

**Recommendations:**
- **STUDIO:**  
  - Add a primary action in header or footer: **"Export CSV"** or **"Submit"** (depending on host app integration).  
  - Export: client-side download with a filename like `localzero-export-{date}.csv`.  
  - Submit: document the callback/API the host app provides; button label e.g. "Submit to app."
- **State:**  
  - Disable until validation has run; if there are errors, either "Fix all errors first" or allow with warning: "Export includes X rows with errors."
- **Success:**  
  - After export/submit: "Export complete" or "Data submitted"; optional "Ready in Xs" if you show time-to-valid.

**Impact:** Closes the workflow with a clear outcome.

---

## 9. Visual & Copy Consistency

**Recommendations:**
- **Product name:** Use "LocalZero" consistently in the header (e.g. "LocalZero" or "LocalZero — Schema Engine").  
- **Errors:** Use one color system (e.g. amber for "needs attention," red for "invalid") in grid, StatusBar, and fix panel.  
- **Stages:** Use the app’s stage names (IMPORT, SCHEMA, PROCESSING, STUDIO) in the UI (header badge, step indicator).  
- **Phrases:** Use simple words: "Data stays local," "Fix errors," "Export CSV," "All valid."

**Impact:** Consistent, easy-to-understand copy.

---

## 10. Summary Priority Matrix

| Priority | Improvement | Effort | Impact |
|----------|-------------|--------|--------|
| P0 | Privacy badge on drop zone + header | Low | High (trust) |
| P0 | Filter: All rows / Errors only (STUDIO) | Medium | High (MVP) |
| P0 | Export / Submit button + flow | Medium | High (complete loop) |
| P1 | Desktop-required block on mobile | Low | Medium (risk) |
| P1 | Fix panel: plain title + order (suggestions first, then Clear/Revert) | Low | Medium (clarity) |
| P1 | Step indicator using app stages (IMPORT → SCHEMA → PROCESSING → STUDIO) | Low | Medium (workflow) |
| P2 | Time to valid in StatusBar / success | Low | Medium (metric) |
| P2 | Offline readiness message | Low | Low–Medium |
| P2 | Preset empty state + export warning | Low | Low |

---

## 11. Quick Wins (Same Sprint)

1. Add `🟢 Offline — Data never leaves your device` to the IMPORT card and a compact badge in the header.  
2. Add segmented control **All | Errors** in STUDIO (VirtualizedTable), filter rows by `errors` Map.  
3. Add "Export CSV" (or "Submit") in STUDIO; disable until validation has run.  
4. Fix panel: use a plain title like "Fix errors — [Column name]" and put suggestions first, then Clear/Revert.  
5. StatusBar: use "🟢 Data is local" (or "Offline — Data secure") instead of "Privacy: Local Processing."

Use the app’s stage names (IMPORT, SCHEMA, PROCESSING, STUDIO) and normal, easy-to-understand words throughout.
