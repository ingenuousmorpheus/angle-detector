# MUSE_ANGLE_DETECTOR_HANDOFF.md

Continuity record for Muse's industrial-UI trial on the Angle Detector project.
Written 2026-10-08. Existing project docs (`README.md`, `angledetectorsession.md`,
`docs/BASELINE.md`) were not modified.

## 1. Verified repository state

- Repository: https://github.com/ingenuousmorpheus/angle-detector
- Base: `main` @ `cb5733e` ("AD-02: manual freeze-frame protractor …")
- Branch: `muse/angle-detector-industrial-ui` (one commit, see §4)
- Stack: React 19 + Vite 6 + TypeScript, Tailwind via CDN play script,
  `lucide-react` icons, `@google/genai` (optional). `npm run lint` = `tsc --noEmit`.
- App entry: `index.html` → `index.tsx` → `App.tsx` → `components/CameraAngleDetector.tsx`
  → frozen mode renders `src/render/ManualProtractor.tsx`; AI overlay is
  `components/AngleDisplay.tsx`.

### Measurement architecture (untouched — safety boundaries honored)

- `src/geometry/angle2d.ts` — deterministic atan2 angle math (never acos).
- `src/geometry/lineFit.ts` — TLS line fit.
- `src/measurement/measureFromPoints.ts` — pure `AngleMeasurement` contract
  (`found`, `angleDeg`, `supplementDeg`, `displayDeg`, `convention`,
  `confidence` from arm length only, `mode: 'apparent-2d'`, `source`).
- `src/vision/` — luma/Sobel + edge snap (fails closed: no edge → no snap).
- `src/render/format.ts` — `formatAngle`: one decimal, presentation only.
- `services/geminiService.ts` — optional AI; app loads and measures without a key;
  AI numbers are labeled "AI estimate (unverified)".
- Tests: `tests/` — 50 tests (fixtures, geometry, snap). Fixtures:
  `fixtures/synthetic/` (constructed angles) and
  `fixtures/mitutoyo-digital-protractor/` (truth 134.65° ± 0.9° interior).

### Remote branch assessment (no conflict)

`origin/claude/angle-detection-protractor-PqWCi` exists but is stale
(last commit 2026-02-20, predates the AD-00…AD-02 rewrite) and unmerged.
It does not touch the current `ManualProtractor` code path and is not active
development. Work proceeded on `main` as instructed; the branch was left alone.

## 2. Design assessment (manufacturing use)

Evaluated against the Phase 2 criteria. Findings:

1. **Readout size** — the frozen-mode angle was `text-xl` (20px): too small to read
   at arm's length in a workshop. → **Fixed by this change.**
2. **Live vs frozen distinction** — frozen mode had no explicit status indicator;
   only the prompt text implied the mode. → **Fixed by this change** (FROZEN chip,
   plus LOCKED chip when the result is locked).
3. **Contrast** — dark theme with yellow/cyan on black is already workshop-suitable.
   Kept.
4. **Touch targets** — main buttons are large rounded-full; protractor toolbar is
   `h-11` (44px), the accepted minimum. Not changed in this pass.
5. **Confidence** — the engine exposes `confidence` (arm-length based), but the
   session log explicitly defers the confidence/quality gate to AD-04. The raw
   number was deliberately NOT surfaced, to avoid implying accuracy the project
   has not validated.
6. **Portrait-phone layout (known issue, not fixed)** — on a 390px phone the
   frozen frame is `aspect-video` (≈354×197px); the two-row toolbar and the
   readout bar together cover almost the entire frame (see `angle-390.png`).
   Tapping the upper half of the frame can hit toolbar buttons instead of
   placing points. Recommended next improvement: portrait layout with a taller
   frame and/or collapsible toolbar.

## 3. Work completed

One small, reversible, presentation-only change in
`src/render/ManualProtractor.tsx` (bottom readout bar only, +26/−8):

- Angle digits enlarged: `text-4xl md:text-5xl`, `font-mono font-bold tabular-nums`,
  high-contrast `text-yellow-200`.
- Added an explicit **FROZEN** status chip (amber) — a frozen measurement can never
  be mistaken for a live reading.
- Added a **LOCKED** chip (lime) shown only when the operator locks the result.
- Secondary details (convention, interior, supplement, "2D apparent · manual")
  kept on a smaller second line; prompt and no-measurement states unchanged
  apart from slightly larger prompt text.
- No new dependencies. No changes to geometry, detection, calibration, tolerances,
  units, fixtures, prompts, or instructions.

## 4. Files changed

- `src/render/ManualProtractor.tsx` — bottom readout bar JSX only.
- Commit: (recorded at push time — see PR).

## 5. Tests performed

- `npm run lint` (`tsc --noEmit`) — clean.
- `npm test` (vitest) — **50/50 pass** (`fixtures`, `geometry`, `snap`).
- `npm run build` (vite) — clean.
- `git diff --stat` confirms the only modified file is the readout component;
  `src/geometry/`, `src/measurement/`, `src/vision/`, `services/`, `tests/`,
  fixtures untouched.
- Browser verification (headless Chromium, Tailwind inlined locally since the
  CDN was unreachable from the test browser): loaded the app, fed the Mitutoyo
  fixture photo through the file-input path, placed vertex + two edge points
  with trusted pointer input at each width, and screenshotted:
  - 1440px desktop — FROZEN + 146.1°, toolbar single row.
  - 768px tablet — FROZEN + 146.4°.
  - 430px mobile — FROZEN + 149.2°, details wrap to two lines, legible.
  - 390px mobile — FROZEN + 150.3°; toolbar wraps to two rows (pre-existing).
- The on-screen numbers above verify the *readout UI*, not measurement accuracy:
  taps were placed by the test harness, not on the fixture's true blade geometry.
  Measurement accuracy is established only by the 50 unit tests and the AD-00…
  AD-02 validation records — automated tests are not calibrated measurement.

## 6. Known issues

- Portrait-phone frame crowding (§2.6) — pre-existing, documented, not introduced
  by this change.
- Test-harness note: synthetic (untrusted) `PointerEvent`s dispatched via CDP
  misbehaved with the component's pointer-capture flow; real trusted mouse input
  works exactly as designed. Not an app bug.
- The app was verified against a local standalone build; the dev-server +
  `?photo=` flow from the session log was not re-run (same code path exercised).

## 7. Screenshots

`~/workspace/your_files/angle-detector-ui/`:
`angle-1440.png`, `angle-768.png`, `angle-430.png`, `angle-390.png`.

## 8. Recommended next improvement

Portrait-phone measurement layout: give the frozen frame more vertical room
(taller than `aspect-video` on portrait, collapsible toolbar rows), so the
operator can see and tap the workpiece instead of UI chrome. Bounded,
presentation-only, same safety boundaries.

## 9. Human approval requirements

- Owner reviews the screenshots on a phone and confirms the readout is readable
  in workshop lighting.
- Independent code review of the one-file diff (presentation only).
- Do not merge until both are done. No deploy step exists for this repo.
- Any future work touching `src/geometry`, `src/measurement`, `src/vision`,
  AI prompts, or calibration values needs the owner's explicit approval and
  must re-run the full test suite plus the fixture-based browser check from
  `angledetectorsession.md` Session 003.
