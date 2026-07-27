# Repo Audit Report — todo

**Date:** 2026-07-27
**Stack detected:** Static single-page app — vanilla HTML/CSS/JavaScript, `localStorage` for persistence, WebGL for the animated background. No backend, no build step, no dependencies.
**Scope:** `index.html` (the only file). The `QUOTES` array (lines 110–487) is static data and was skimmed, not line-audited.

## Summary

- Total findings: 3
- Auto-fixed (trivial-safe): 0
- Needs review (see PLAN.md): 3
- Critical: 0 | Major: 0 | Minor: 3 | Notes: 2

## Production-readiness scorecard

| Category | Status | Notes |
|---|---|---|
| Correctness | ⚠️ | One timezone off-by-one near midnight (Finding 3). |
| Silent failures | ⚠️ | `localStorage` read/write is unguarded — a throw bricks the whole app (Findings 1–2). |
| Security | ✅ | Task text rendered via `textContent` (no XSS); quotes are static; no secrets, no injection surface. |
| Concurrency | ✅ | Single-threaded; only `requestAnimationFrame`. No shared-state hazards. |
| Performance | ⚠️ (note) | WebGL render loop runs continuously even when the tab is backgrounded (browser throttles rAF, so low impact). |
| Architecture | ✅ | Appropriate for scope — one self-contained file. |
| Production-readiness | ⚠️ | Storage-unavailable (private mode / quota) path is unhandled. |
| Test coverage | ⚠️ (note) | No automated check on the date-grouping / rollover logic. |

## Auto-fixed (trivial-safe)

None. No dead code, unused variables, unreachable branches, or duplicate blocks were found — the code is tight.

## Findings requiring review

### Pass 2 — Silent failure

- **`index.html:497` (`load`)**
  - **Severity:** Minor
  - **What's wrong:** `JSON.parse(localStorage.getItem(KEY) || "[]")` runs at initial load with no `try/catch`. If the stored value is corrupt JSON (a truncated write, a manual edit, another script clobbering the key), `JSON.parse` throws.
  - **Why it matters in production:** The throw happens during top-level script execution (`let tasks = load()`), which halts the *entire* remaining script — `render()`, the add/complete/tab event bindings, and the WebGL background all never run. One bad storage value silently bricks the whole page with no recovery path other than the user manually clearing storage.
  - **Suggested fix:** Wrap parse in `try/catch`, fall back to `[]` on failure.

- **`index.html:498` (`save`)**
  - **Severity:** Minor
  - **What's wrong:** `localStorage.setItem(...)` is unguarded. In private-browsing modes and when the storage quota is exceeded, `setItem` (and even reading `localStorage`) throws.
  - **Why it matters in production:** A throw inside `save()` propagates out of the add-task and complete-task handlers, so the action fails mid-way — e.g. a task is pushed into the in-memory array but the render never runs, or the completing task doesn't disappear — with no message to the user. On a browser where storage is blocked entirely, the app appears broken from the first keystroke.
  - **Suggested fix:** Guard `save()` in `try/catch`; optionally surface a one-line non-blocking notice on failure.

### Pass 1 / Pass 7 — Date handling (control flow + consistency)

- **`index.html:496` (`todayStr`) vs `:491` header and `:537` pending pill**
  - **Severity:** Minor
  - **What's wrong:** `todayStr()` derives "today" from `new Date().toISOString().slice(0,10)`, which is the **UTC** date. The big date header (line 491) and the pending date pill (line 537) use **local-time** formatting (`toLocaleDateString`, `new Date(date+"T00:00")`). Task grouping is internally consistent (the same UTC function is used to store and to compare), but it disagrees with what the user is *shown*.
  - **Why it matters in production:** For any user in a negative UTC offset (all of the Americas), in the evening the UTC date is already tomorrow. A task added at, say, 9 PM local on July 27 is stored as `2026-07-28`; the header still reads "July 27, 2026". The task still appears under Today (consistent internally), but the displayed date and the effective rollover boundary are off by up to a day, and the pending pill can show a date that looks one day ahead of when the task was actually created.
  - **Suggested fix:** Replace `toISOString().slice(0,10)` with a local-date formatter so all three date sources agree.

## Clean areas

- **Security:** no injection surface, no secrets, safe DOM APIs for user text.
- **Concurrency:** none present; nothing to get wrong.
- **Redundancy/dead code:** none found.
- **Task add / complete-to-delete / pending-rollover core logic:** correct (manually traced; also verified live in-browser earlier — add, complete-delete on both tabs, and rollover all behave).
- **WebGL background:** has a no-WebGL fallback (line 574); shader-compile failure degrades to a blank canvas rather than crashing the app.
