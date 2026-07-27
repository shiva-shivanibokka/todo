# Fix Plan — todo

Generated from repo-bug-audit on 2026-07-27. 3 tasks, ordered by severity/impact. All findings are Minor; none block use of the app today.

## Task 1: Guard `localStorage` read against corrupt/blocked storage

- **File:** `index.html` (line 497)
- **Category:** Pass 2 — Silent failure
- **Severity:** Minor
- **Finding:** `const load = () => JSON.parse(localStorage.getItem(KEY) || "[]");` runs at top-level load. Corrupt JSON or a browser that throws on `localStorage` access (private mode) makes `JSON.parse` / the getter throw, halting the rest of the script (render, event bindings, background).
- **Why it matters:** One bad stored value or a locked-down browser bricks the entire page with no in-app recovery.
- **Proposed change:**
  ```javascript
  const load = () => {
    try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
    catch { return []; }
  };
  ```
- **Verification:** In DevTools console run `localStorage.setItem("todo.tasks","{bad json")` then reload — page should load with an empty list instead of a blank/broken screen. Then add a task and confirm normal behavior resumes.
- **Depends on:** none

## Task 2: Guard `localStorage` write against quota/blocked storage

- **File:** `index.html` (line 498)
- **Category:** Pass 2 — Silent failure / Pass 12 — Production-readiness
- **Severity:** Minor
- **Finding:** `const save = t => localStorage.setItem(KEY, JSON.stringify(t));` is unguarded. `setItem` throws on quota-exceeded and in storage-blocked contexts, propagating out of the add/complete handlers mid-operation.
- **Why it matters:** On a storage-blocked browser the app looks broken from the first keystroke; on quota-exceeded, an add/complete half-applies with no user feedback.
- **Proposed change:**
  ```javascript
  const save = t => {
    try { localStorage.setItem(KEY, JSON.stringify(t)); }
    catch (e) { console.warn("Could not save tasks:", e); }
  };
  ```
  (In-memory state still updates and the UI still renders for the current session; only persistence is lost, which is the correct graceful degradation.)
- **Verification:** In a private/incognito window with storage disabled, confirm tasks can still be added and completed within the session without the UI freezing. In a normal window, confirm persistence across reload is unchanged.
- **Depends on:** none

## Task 3: Use local date (not UTC) for task grouping so it matches the displayed date

- **File:** `index.html` (line 496)
- **Category:** Pass 1 — Control/data flow / Pass 7 — Consistency
- **Severity:** Minor
- **Finding:** `const todayStr = () => new Date().toISOString().slice(0,10);` uses the UTC date, while the header (line 491) and pending pill (line 537) use local time. In negative-UTC-offset timezones, evening-local tasks are filed under the next calendar day and the header/pill disagree with the grouping boundary by up to a day.
- **Why it matters:** A user adds an evening task and the big date shown, the date the task is filed under, and the "rolls to Pending" boundary can all be a day apart — confusing for a date-centric to-do app, especially around midnight.
- **Proposed change:**
  ```javascript
  // local YYYY-MM-DD, matching the displayed (local) date
  const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  };
  ```
- **Verification:** Set the OS/browser timezone to something like UTC-8, set the clock to ~10 PM, reload, add a task. Confirm the header date, the task's grouping under "Today", and (after the local day advances) its move to Pending with the correct pill date all agree. Existing stored tasks (old UTC-format `YYYY-MM-DD` strings) remain comparable since the format is unchanged.
- **Depends on:** none

---

### Optional hardening (Notes — not scheduled unless you want them)

- **Pause the WebGL loop when the tab is hidden** (`document.visibilitychange`) to save battery on a page likely left open all day.
- **Add a tiny self-check** (a `demo()` asserting `todayStr()` format and that completing removes a task) to lock in the date/rollover logic.
- **Add `maxlength` to the task input** to bound pathological paste sizes.
