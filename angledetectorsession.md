# Angle Detector — Enhancement Session

**Project:** Live Angle Detector  
**Repository:** `ingenuousmorpheus/angle-detector`  
**Status:** Existing AI-assisted camera prototype; enhancement plan only  
**Primary goal:** Turn the current camera demo into a trustworthy AR angle-finding tool that can replace or supplement a handheld protractor for practical field/work measurements.

---

## 0. What Exists Now

Current implementation is a Vite + React + TypeScript app with:

- rear-camera capture through `getUserMedia`;
- a center bullseye for aiming;
- one-frame analysis on demand;
- Gemini image analysis that returns:
  - angle;
  - short description;
  - normalized start / vertex / end points;
- an SVG overlay drawn over the video;
- object-cover crop compensation so the analyzed image better matches the visible camera frame;
- an 8-second result display;
- basic camera/error/loading UI.

Important current files:

- `App.tsx`
- `components/CameraAngleDetector.tsx`
- `components/AngleDisplay.tsx`
- `services/geminiService.ts`
- `types.ts`
- `vite.config.ts`

The latest existing enhancement already improved crop alignment and tightened the Gemini prompt around the center target.

---

## 1. What Is Good

Preserve these ideas:

1. **Center-target workflow.** A worker can point at the joint/edge instead of configuring a complex tool.
2. **Camera crop compensation.** Matching the analyzed image to the object-cover UI is the right instinct.
3. **Three-point result schema.** `[start, vertex, end]` is exactly the geometry needed for an AR overlay.
4. **Simple interaction.** Start camera → aim → measure is appropriate for a field tool.
5. **Mobile-first camera choice.** `facingMode: environment` is correct for the intended use.
6. **Explicit failure state.** Returning “no angle found” is better than inventing a measurement.

---

## 2. Main Problems To Fix

### A. The AI is currently doing the metrology

Gemini is being asked to look at an image and produce a numerical angle to two decimal places.

That is useful for locating candidate edges, but it is not a calibrated geometric measurement system.

**Rule:** AI may help identify the correct object/edges, but final angle math should be deterministic geometry.

Do not present two decimal places as measurement accuracy unless validation proves that accuracy.

### B. Perspective distortion is not handled

A 2D camera image measures the **apparent image-plane angle**.

If the measured surface is tilted relative to the camera, the apparent angle can differ from the true physical angle.

The app must distinguish:

- `2D apparent angle`
- `plane-corrected angle`
- `AR/world-space angle`

### C. No deterministic/manual baseline

There is currently no way for the user to tap:

1. vertex;
2. point on first edge;
3. point on second edge;

and get a mathematically exact image-plane angle.

That manual mode should become the truth/reference path before automatic computer vision.

### D. Browser API key exposure

`vite.config.ts` injects `GEMINI_API_KEY` into frontend JavaScript.

For any public deployment, that can expose the key to users.

Move cloud AI calls behind a small server/API proxy, or make the production app local-only with no embedded cloud credential.

### E. No calibration or accuracy tests

The repo has no measurement fixture set, automated geometry tests, or comparison log against known angles/protractor readings.

A measurement tool needs accuracy evidence, not only screenshots that look correct.

### F. Result overlay can drift on resize/orientation change

`AngleDisplay` scales against `getBoundingClientRect()` at render time, but there is no explicit resize/orientation observer or frozen-frame coordinate contract.

The image coordinate system should be canonical and transform into screen coordinates consistently.

### G. Cloud-first dependency is unnecessary for the core feature

Angle calculation can work offline.

AI should be optional:
- edge/object suggestion;
- difficult-scene assistance;
- explanation.

The base measurement path should not require internet access.

---

# BUILD ROADMAP

## AD-00 — Preserve + Baseline

**Goal:** establish a measurable starting point before changing behavior.

Tasks:

- preserve current UI and Gemini mode;
- add a small automated test harness;
- add known synthetic angle fixtures:
  - 15°
  - 30°
  - 45°
  - 60°
  - 90°
  - 120°
  - 135°
  - 150°
- record current Gemini error across fixtures;
- document current device/browser behavior;
- do not claim industrial accuracy yet.

**Gate:** baseline error and latency are recorded and current behavior is reproducible.

---

## AD-01 — Deterministic Geometry Core

Create a pure geometry module, e.g.:

`src/geometry/angle.ts`

Given three points:

```text
A = point on edge 1
V = vertex
B = point on edge 2
```

calculate:

- interior angle;
- reflex/supplement option;
- line vectors;
- confidence inputs independent of AI.

Use vector math:

```text
u = A - V
v = B - V

angle = atan2(|u × v|, u · v)
```

**Gate:** synthetic point tests reproduce known angles within floating-point tolerance.

---

## AD-02 — Manual AR Protractor Mode

**Goal:** create a reliable mode that already replaces a visual protractor for many uses.

Workflow:

1. freeze frame;
2. tap vertex;
3. tap first edge;
4. tap second edge;
5. display angle;
6. drag any handle for correction;
7. choose interior / exterior / supplement.

Add:

- magnified loupe near finger;
- snap-to-edge option;
- reset/undo;
- lock result;
- save annotated photo.

**Gate:** a user can measure an angle without AI and get repeatable results on the same frozen image.

---

## AD-03 — Automatic Edge Detection

**Goal:** make automatic measurement geometric, not generative.

Candidate pipeline:

```text
camera frame
↓
center ROI
↓
grayscale
↓
contrast/denoise
↓
Canny-style edge detection
↓
line-segment / Hough detection
↓
cluster two dominant edges
↓
intersection = vertex
↓
deterministic angle math
```

Implementation options:
- OpenCV.js / WebAssembly;
- lightweight custom line detector;
- native CV later if moved to Android.

Gemini/local vision may suggest which edge pair matters, but geometry produces the number.

**Gate:** automatic mode identifies the correct two lines on a controlled fixture set and reports error/confidence.

---

## AD-04 — Confidence + Quality Gate

Do not return a confident measurement when:

- edges are too short;
- vertex is offscreen;
- blur is high;
- lines are nearly parallel;
- glare hides the joint;
- perspective is extreme;
- multiple edge pairs are equally plausible.

Display:

```text
ANGLE 47.3°
confidence: HIGH
mode: 2D apparent
```

or:

```text
ANGLE UNSTABLE
move closer / align camera with surface
```

**Gate:** poor frames fail closed instead of producing precise-looking guesses.

---

## AD-05 — Perspective / Plane Correction

**Goal:** address the biggest physical-measurement limitation.

Add progressively:

### V1 — alignment guidance

Use phone orientation and visual cues to tell the user when the camera is approximately perpendicular to the measured plane.

### V2 — four-point plane rectification

Allow the user to mark a rectangular/reference plane so the image can be homography-corrected before measuring.

### V3 — native AR plane support

For an Android/native build, use camera intrinsics + AR plane/depth data where available to estimate the two rays in 3D.

**Gate:** off-axis fixture tests show the corrected result beats raw image-plane measurement.

---

## AD-06 — Live AR Mode

Move from “tap Analyze” to a live overlay:

- track vertex;
- track two edges;
- update angle continuously;
- smooth jitter with EMA/Kalman-style filtering;
- lock measurement when stable;
- show stability indicator.

Performance target:
- geometry overlay feels real-time;
- heavy AI runs only when needed, not every frame.

**Gate:** angle remains stable while the phone moves slightly around a fixed fixture.

---

## AD-07 — Physical Calibration / Work Validation

Build a real calibration set using known physical angles and the user's normal measuring device.

For each fixture record:

- known/reference angle;
- device/model;
- distance;
- camera angle to surface;
- lighting;
- app mode;
- measured result;
- absolute error.

Report:

- median absolute error;
- 95th percentile error;
- failure rate;
- repeatability.

Do not claim a tolerance tighter than measured evidence supports.

**Gate:** validation report defines the conditions where the app is trustworthy.

---

## AD-08 — Work-Focused UX

Add field features only after the core measurement is correct:

- one-handed controls;
- large buttons for gloves;
- freeze/lock;
- flashlight toggle where browser/platform permits;
- measurement history;
- photo + overlay + note;
- project/job label;
- CSV/PDF export later;
- acute / obtuse / supplement toggle;
- “hold steady” vibration/audio cue in native version;
- offline PWA install.

Keep personal/employer data out of the public repo.

---

## AD-09 — Cloud/Local AI Assistant (Optional)

AI becomes an assistant, not the measuring instrument.

Possible jobs:

- “which two edges should I measure?”;
- identify the type of joint/object;
- explain why a measurement is unstable;
- select a likely edge pair among CV candidates.

Production security:

```text
browser
↓
small authenticated backend/proxy
↓
Gemini
```

Never ship the Gemini secret in the browser bundle.

Optional local vision support can later share patterns with Terminator New Lens / Lana OS Link.

---

## AD-10 — Terminator New Lens Integration

Expose Angle Detector as a reusable module:

```text
ANGLE MODE
↓
crosshair on joint
↓
edge lock
↓
live angle
↓
LOCK / SAVE
```

The two apps remain separate repositories, but Terminator New Lens can consume the angle-measurement module/API as one lens mode.

This is a strong bridge between:

- practical AR tool;
- cinematic AI Cosplay lens;
- future smart-glasses/Lana AR experiments.

**Gate:** Terminator Lens can invoke Angle Mode without duplicating angle math.

---

# Recommended Implementation Order

1. AD-00 baseline.
2. AD-01 deterministic geometry.
3. AD-02 manual three-point mode.
4. AD-04 confidence/quality.
5. AD-03 automatic CV.
6. AD-07 real-world validation.
7. AD-05 perspective correction.
8. AD-06 live tracking.
9. AD-08 field UX/PWA.
10. AD-09 optional AI.
11. AD-10 Terminator integration.

---

# Core Invariant

**The app should earn trust as a measuring tool.**

A visually impressive AR overlay is secondary to:

- correct geometry;
- honest uncertainty;
- repeatability;
- calibration;
- safe handling of API credentials.

When resumed, enhance the current application rather than rewriting it from scratch.


---

## AD-11 — AR Glasses Deployment

Angle Detector is the measurement source of truth for the future Terminator New Lens / Lens OS wearable.

The glasses shell may provide camera, IMU, depth, gaze, and world anchors, but angle calculation/calibration remains here.

Target interface:

```text
Lens OS frame + optional plane/depth data
↓
Angle Detector edge/point engine
↓
angle + confidence + measurement mode
↓
AR overlay
```

Do not duplicate angle math in the wearable project.

See `Terminator-New-Lens/docs/AR_GLASSES_ROADMAP.md` for the wearable integration architecture.

---

# Session Log

Oldest first. Each entry follows Goal / Starting State / Changed / Verification / Result /
Findings / Gate / Do Not Redo / Next Action.

## Session 001 — AD-00 Preserve + Baseline

### Goal
Set a measurable starting point (test harness, fixtures with known angles, baseline record)
without changing the app's behavior. Add the user-supplied 3D Mitutoyo protractor model
(`anglefinder1.glb`) as a reference fixture.

### Starting State
Main at `4f2773e`: Gemini-only prototype, no tests, no fixtures. Roadmap only. (The remote
branch `claude/angle-detection-protractor-PqWCi` predates the session docs and was not used.)

### Changed
- `vitest` + `vitest.config.ts`, scripts `test`, `baseline:gemini`, `fixtures:export`.
- `src/fixtures/syntheticAngle.ts` — seeded rasterizer for bent-bar fixtures with
  construction truth; `standardFixtureSet()` = 10 roadmap angles × 3 rotations.
- `scripts/png.ts` (dependency-free PNG encoder), `scripts/export-fixtures.ts`,
  `scripts/baseline-gemini.ts`.
- `scripts/fixtures/mitutoyo_truth.py` (Blender) → `fixtures/mitutoyo-digital-protractor/`
  (`mitutoyo_center.jpg`, `truth.json`). The 62 MB GLB itself is not committed.
- `services/geminiService.ts` — optional `mimeType` arg (default `image/jpeg`; app behavior unchanged).
- `docs/BASELINE.md`.

### Verification
- `npm test`: 15/15 pass (`tests/fixtures.test.ts`).
- `npm run lint` and `npm run build` pass.
- Blade-edge line fits on the 4000×3000 silhouette: max residual ≤ 1.7 px per edge.

### Result
PARTIAL — harness, fixtures, and behavior record done. The Gemini error/latency numbers are
not recorded (no API key in this session).

### Findings
- Mitutoyo model: the blades meet at **134.65° ± 0.9°** (supplement 45.35°); the LCD texture
  reads **101.5°**. These disagree, so the generated display number is not trustworthy (truth.json, test
  "stores blade geometry as ground truth").
- The current Gemini prompt explicitly prefers a visible display value, so it would return the
  generated 101.5° on this fixture.

### Gate/Blocker
Gemini baseline needs `GEMINI_API_KEY` → `npm run baseline:gemini`.

### Do Not Redo
Mitutoyo truth extraction (rerun the script only if the GLB changes). Fixture angle list.

### Next Action
AD-01 deterministic geometry core.

## Session 002 — AD-01 Deterministic Geometry Core

### Goal
Pure, tested angle math with no dependency on React, Gemini, camera or AR (AD-01 / AL-01).

### Starting State
Session 001 harness + fixtures on main (`6ee344d`).

### Changed
- `src/geometry/angle2d.ts` — vec ops; `angleBetweenVectors` = atan2(|u×v|, u·v);
  `angleFromPoints`, `signedAngle`, `angleBetweenLines`, `supplement`/`exterior`/`toConvention`,
  `lineIntersection`, `distanceToLine`, normalized↔pixel.
- `src/geometry/lineFit.ts` — total-least-squares fit with residuals/span (used by AD-03).
- `src/camera/cameraTransform.ts` — the app's object-cover crop as a pure, tested function.
- `src/measurement/measurementTypes.ts` — `AngleMeasurement` contract (anglelensession §9) +
  `MeasurementSource`.
- `src/measurement/measureFromPoints.ts` — three normalized points → `AngleMeasurement`,
  computed in **pixel space**, fails closed on short arms.

### Verification
`npm test`: 46/46 (31 new in `tests/geometry.test.ts`): all roadmap angles × 6 rotations ×
3 scales to 1e-9; near-0°/180° precision; vertical-line fits; crop round-trips; every synthetic
fixture exact; Mitutoyo truth points → 134.65°. `npm run lint` clean.

### Result
COMPLETE.

### Findings
Measuring in normalized coordinates on a 16:9 frame skews angles (a true 45° reads ≈29.4°);
test "computes in pixel space" pins this. Any future code must convert to pixels first.

### Gate/Blocker
None.

### Do Not Redo
Angle formula choice (atan2 over acos); TLS line fit over y=mx+b.

### Next Action
AD-02 manual freeze-frame three-point mode in the existing camera UI.

## Session 003 — AD-02 Manual AR Protractor Mode

### Goal
Measure an angle with no AI: freeze → tap vertex, edge 1, edge 2 → angle from geometry; drag
to correct; loupe; snap; undo/reset; lock; convention toggle; save annotated photo.

### Starting State
Session 002 geometry core on main (`70478cc`). App crashed at load without a Gemini key.

### Changed
- `services/geminiService.ts` — client created lazily; `isAiAvailable()`. The app now loads and
  measures without a key; the AI button only shows when a key exists.
- `src/render/ManualProtractor.tsx` — frozen-frame overlay: tap order vertex → A → B, draggable
  handles (32 px hit radius), 4× loupe while dragging, edge snap (edge points only, never the
  hidden vertex), undo (50 deep) / reset, lock, interior/supplement/exterior, save PNG.
  ResizeObserver keeps the overlay aligned on resize/orientation change.
- `src/vision/grayImage.ts` (luma, Sobel), `src/vision/snapToEdge.ts` (fails closed: no edge → no snap).
- `src/render/exportAnnotated.ts`, `src/render/format.ts` (1 decimal; presentation only).
- `components/CameraAngleDetector.tsx` — **Freeze & Measure**, **Open Photo**, `?photo=<url>`
  deep link, **Measure AI points** (Gemini points become a starting placement; the number is
  then computed by geometry). Gemini readout labelled "AI estimate (unverified)". Frame capture
  uses the tested `coverCrop`.
- `App.tsx` copy, `components/AngleDisplay.tsx` label.

### Verification
- `npm test` 50/50 (`tests/snap.test.ts` new). `npm run lint`, `npm run build` pass.
- Same frozen points → same number: `measureFromPoints` is pure (Session 002 tests).
- **Not verified in a browser.** Launching the dev-server preview was denied in this session.

### Result
PARTIAL. The code is complete and type-checks, but the UI interaction is not yet browser-verified.

### Findings
None new beyond Session 001–002.

### Gate/Blocker
Browser / phone check: `npm run dev`, then open
`http://localhost:3000/?photo=/fixtures/mitutoyo-digital-protractor/mitutoyo_center.jpg`,
tap the pivot (image center, right of the knob), then a point on each blade. Expect ≈134.6°
interior / 45.4° supplement (truth 134.65° ± 0.9°).

### Do Not Redo
Lazy Gemini client. The decision not to snap the vertex.

### Next Action
Run the browser check above; then AD-04 confidence/quality gate.

## Session 004 — AD-03 Industrial Measurement Readout (UI trial)

### Goal
Bounded presentation-only improvement: a workshop-readable measurement readout for the
manual freeze-frame protractor (large digits, explicit FROZEN/LOCKED chips). No geometry,
measurement, vision, calibration, or AI changes.

### Starting State
AD-02 manual protractor on main (`cb5733e`); branch `muse/angle-detector-industrial-ui`
created for the trial.

### Changed
- `src/render/ManualProtractor.tsx` — bottom readout bar only: angle digits `text-4xl
  md:text-5xl` monospace tabular-nums, high-contrast yellow on black; explicit **FROZEN**
  chip (amber); **LOCKED** chip (lime, only when locked); secondary details (convention,
  interior, supplement, "2D apparent · manual") on a smaller second line.
- `MUSE_ANGLE_DETECTOR_HANDOFF.md` (new) — continuity record.
- The engine's raw `confidence` value was deliberately NOT surfaced (AD-04 gate pending).

### Verification
- `npm run lint` clean, `npm test` 50/50 pass, `npm run build` clean.
- Headless-Chromium checks at 390/430/768/1440px with the Mitutoyo fixture: frozen frame
  → 3 placed points → readout renders at every width (screenshots `angle-*.png`).

### Result
COMPLETE. Draft PR #1 opened (not merged).

### Findings
- On 390px portrait phones the two-row toolbar + readout bar cover most of the
  `aspect-video` frozen frame — documented as the known issue for the follow-up.
- Naming note: the branch/PR label this "AD-03", but the roadmap's AD-03 (automatic
  edge detection) is NOT done; this session was presentation-only.

### Gate/Blocker
Independent review of PR #1 (presentation-only diff).

### Do Not Redo
The readout component diff; the decision to keep `confidence` unsurfaced.

### Next Action
Portrait-usability follow-up for the 390px crowding (Session 005).

## Session 005 — AD-03 Portrait Usability Follow-up

### Goal
Fix the documented 390px portrait issue: toolbar + readout obstructing the frozen camera
frame. Keep angle/FROZEN/LOCKED readable; preserve measurement math, point placement,
calibration, fixtures, safety boundaries.

### Starting State
Session 004 on branch `muse/angle-detector-industrial-ui` (PR #1 draft, unmerged).

### Changed
- `components/CameraAngleDetector.tsx` — frame container `aspect-video` →
  `aspect-video portrait:aspect-[3/4]`: portrait phones/tablets get a taller frame
  (390px: 354×197 → 354×473); landscape/desktop keep 16:9. Capture uses the tested
  `coverCrop` at the displayed aspect; angle math is aspect-independent.
- `src/render/ManualProtractor.tsx` — toolbar icon-only below `sm` (same buttons,
  handlers, order; 44px-tall targets; `title` attributes kept); readout details collapse
  to a one-liner on small screens.
- Handoff §10 with verification and the design tradeoff note.

### Verification
- `npm run lint` clean, `npm test` 50/50 pass, `npm run build` clean.
- Headless-Chromium checks at 390/430/768/1440px with the Mitutoyo fixture + 3 placed
  points (screenshots `angle-*-v2.png`).

### Result
COMPLETE. Pushed; PR #1 body updated with the follow-up section; still draft, not merged.
(Remote head `2a69f8c2` is a CRLF-preserving API re-push; its tree is identical to local
`4cb5151`.)

### Findings
- Product tradeoff: annotated PNG exports from portrait captures are now 3:4 (was 16:9);
  landscape/desktop unchanged. Measurement unaffected (coverCrop at displayed aspect,
  aspect-independent angle math).

### Gate/Blocker
Independent review of PR #1 (now covers both the readout and the portrait follow-up).

### Do Not Redo
The 3:4 portrait frame decision; the icon-only toolbar below `sm`.

### Next Action
Android-first validation of the existing interface (Session 006). Do NOT start the
simulation workspace until AD-03 is reviewed and stable.

## Session 006 — Android-First Validation (2026-10-09)

### Goal
Per owner authorization: finish and validate the existing AD-03 work first — no new
multi-phase build, no simulation workspace, no push/merge/deploy, no SDK installs. Validate
the existing interface at Android phone sizes with touch input; check APK packaging
feasibility without installing anything.

### Starting State
Branch `muse/angle-detector-industrial-ui` (local `4cb5151`, tree-identical to remote
`2a69f8c2`); PR #1 draft, open, unmerged, body includes the follow-up section; no review
comments visible publicly. Working tree clean.

### Changed
- `angledetectorsession.md` — this entry. No app code changed (nothing to fix).

### Verification
- `npm test`: 50/50 pass. `npm run lint` clean. `npm run build` clean.
- Browser device emulation (headless Chromium, touch input, DPR set) at 360×800,
  393×873, 412×915, 430×932 portrait + 800×360, 932×430 landscape, Mitutoyo fixture via
  the file-input path, 3 blade-aligned touch taps per viewport:
  - Frozen frame renders at every size (portrait 3:4, landscape 16:9); tap → angle
    reading appears; touch-drag on a handle changes the reading; Lock → LOCKED chip;
    annotated PNG export downloads (0.5–0.9 MB files).
  - No horizontal overflow at any size; toolbar buttons 44px tall (40px wide icon-only).
  - Measurement integrity: landscape taps → **133.8°** vs fixture truth **134.646° ± 0.9°**
    (inside uncertainty); portrait taps with snap OFF → **134.7°** (inside uncertainty).
    Geometry engine vindicated end-to-end through the touch pipeline.
  - Screenshots: `~/workspace/your_files/angle-detector-ui/android-*.png`.
- Environment limitation (reported, not worked around): the sandboxed Chromium build
  enforces Local Network Access checks (organization-managed) that block localhost
  navigation, and has no direct egress. Testing used a fully offline page instead:
  production JS bundle (verified self-contained, 0 external refs) + Tailwind v4 CSS
  compiled locally with the real Tailwind engine from the repo's actual class list +
  fixture via the file-input path. No mockups — all screenshots are the actual rendered
  app. Real-device camera testing was not possible here.

### Result
COMPLETE — validation only. Nothing pushed, merged, or deployed.

### Findings
- Snap-to-edge defaults ON and pulled scripted taps 5.5° off truth on the busy Mitutoyo
  render (129.1° vs 134.646°); with snap OFF the same taps read 134.7°. This is the
  feature working as designed (nearest strong edge within radius), not a geometry bug —
  but an operator measuring a detailed part must verify placement with the loupe, or
  toggle snap off. Worth one line of operator guidance before press-brake use.
- At 360px the icon toolbar wraps to two rows (one row at ≥390px); still compact and
  doesn't cover the measurement area.
- No JDK, Android SDK, Gradle, emulator, adb, or Capacitor in this environment or the
  project. APK packaging is feasible in principle (standard Vite SPA — Capacitor can
  wrap it), but requires installing the Android toolchain (large downloads, needs
  owner approval) plus `npm i @capacitor/core @capacitor/cli`, `npx cap init`,
  `npx cap add android`. Not started.

### Gate/Blocker
- Independent review of PR #1 (still pending; no review comments visible).
- Owner decisions needed: (a) approve merge of PR #1 after review; (b) approve Android
  toolchain install for a test APK; (c) green-light the simulation workspace phase only
  after AD-03 is reviewed and stable.

### Do Not Redo
The offline emulation harness (`/tmp/ad_test.html` build script, CDP touch scripts);
the 6-viewport touch test matrix and its results.

### Next Action
Await independent review of PR #1 and owner decisions above. Do not start new phases,
push, merge, or deploy without explicit owner approval.

## Session 007 — AD-03 Safety Refinement: snap defaults OFF (2026-10-09)

### Goal
Owner-authorized (explicit, via Lana 1 relay): make snap-to-edge default OFF for new
measurement sessions, add operator guidance, re-verify. No push/merge/deploy, no SDK
installs, no simulation workspace.

### Starting State
Session 006 validation on branch `muse/angle-detector-industrial-ui` (local `bc146f1`).

### Changed
- `src/render/ManualProtractor.tsx` only:
  - `useState(true)` → `useState(false)` for snap, with a comment recording why
    (observed ~5.5° pull on the Mitutoyo render; operator enables explicitly).
  - Readout details lines (desktop + mobile one-liner) append `· snap on/off`.
  - Guidance line under the reading: "Verify both edge points before trusting the
    angle. Snap may select nearby features."
- `MUSE_ANGLE_DETECTOR_HANDOFF.md` — §11 (refinement record) + §12 (PR #1 reviewer
  handoff: scope, what (not) to review, test evidence, known limitations, merge gates).

### Verification
- `npm test` 50/50 pass, `npm run lint` clean, `npm run build` clean.
- 7/7 CDP touch checks at 390×844: snap defaults OFF (magnet gray), taps → 134.7°
  vs truth 134.646°, readout shows "snap off", guidance visible, toggle → "snap on"
  (magnet cyan), reset clears points and restores the prompt.
- Full 6-viewport matrix re-run: all 6 within 0.05° of truth; drag/lock/export pass;
  no overflow; 44px targets. Zero failures.
- Screenshots: `~/workspace/your_files/angle-detector-ui/android-*.png` (+ new
  snap-off/snap-on/reset shots in /tmp/ad_shots).

### Result
COMPLETE. Committed locally; NOT pushed, merged, or deployed.

### Findings
- With snap OFF by default, scripted fixture taps are essentially exact (≤0.05° error
  at all 6 viewports) — the earlier 5.5° portrait delta is fully attributable to snap
  pulling onto a nearby edge, confirming the engine was never the problem.
- No defects found in this session; no app code needed changes beyond the snap default.

### Gate/Blocker
Independent review of PR #1 (still no public review comments). Owner merge approval.

### Do Not Redo
The offline harness rebuild (bundle hash changed); the snap test scripts.

### Next Action
Await independent review + owner decisions (merge; Android toolchain install; then the
simulation workspace phase). Do not push, merge, deploy, or install without explicit
owner approval.

## Session 008 — AD-03 Review Prep + Android Readiness (2026-10-09)

### Goal
Owner-authorized (via Lana 1 relay): preserve/prepare AD-03 for independent review;
research the smallest practical APK route (Capacitor); write the Moto G Power
acceptance plan. No push/merge/deploy, no toolchain installs, no simulation workspace.

### Starting State
Branch `muse/angle-detector-industrial-ui` at local `d582223` (Session 007 snap
refinement). PR #1 draft, open, unmerged.

### Changed (docs only; no app code)
- `docs/ANDROID_APK_PLAN.md` (new) — Capacitor 7 route: JDK 17, AGP 8.7.2, Gradle
  8.11.1, SDK 35/35/23; required pre-packaging code changes (offline bundling —
  drop Tailwind CDN + import map; CAMERA permission; safe-area insets CSS; rotation
  config; export fallback if `<a download>` fails in WebView); build steps; open
  device questions.
- `docs/MOTO_G_ACCEPTANCE_PLAN.md` (new) — 7-test real-device procedure: camera
  permission allow/deny, freeze + 3-point placement, drag correction, lock + export,
  rotation/safe areas, accuracy table vs trusted reference (3 pieces × 3 repeats,
  proposed ≤1.0° median / ≤2.0° max — owner to confirm), snap on/off on real parts.
  No accuracy claim until the table is filled.

### Verification
- Branch inspection: 5 local commits over main (`1616563`, `06b9e85`, `4cb5151`,
  `bc146f1`, `d582223`); working tree clean; local HEAD tree intact.
- PR #1 re-checked live: draft, open, unmerged, `mergeable_state: clean`, head
  `2a69f8c2`, 4 commits, 3 files (+236/−13).
- **Scope finding:** PR #1 as it stands covers the readout + portrait follow-up only.
  The snap-default safety refinement (`d582223`) and both session-log commits exist
  ONLY locally — they are NOT in the review scope until the branch is pushed, which
  needs Pedro's separate authorization (explicitly withheld).
- `npm test` 50/50 pass, `npm run lint` clean, `npm run build` clean — no regressions.
- Reviewer handoff (§12 of `MUSE_ANGLE_DETECTOR_HANDOFF.md`) verified current, except
  it says "three commits" — the branch now has five (two are docs-only); corrected
  below at push time.
- Review request: NOT sent. The reviewers (Lana/Codex) are reached via Pedro's relay;
  there is no reviewer user for me to @-mention, and outward requests need his word.
  The request is staged: everything a reviewer needs is in the handoff §12.

### Result
COMPLETE — preparation and planning only. Nothing pushed, merged, installed, or deployed.

### Findings
- Capacitor 7 + JDK 17 is the conservative toolchain (Capacitor 8 would want JDK 21).
  Minimum practical route is genuinely small: `npm i @capacitor/{core,cli}`, `cap init`,
  `cap add android`, manifest permission, `assembleDebug` — IF the §2 code changes
  (offline bundling etc.) are done first.
- The single biggest pre-APK code task is killing the CDN dependencies (Tailwind Play
  + aistudiocdn import map); the JS bundle itself is already self-contained.
- Export-via-`<a download>` is the main WebView unknown — flagged for the device test
  with a Filesystem-plugin fallback ready.

### Gate/Blocker
1. Pedro's separate authorization to push the branch (brings the snap fix + reviewer
   handoff into PR #1's scope).
2. Independent review of PR #1 (no public comments yet).
3. Pedro's merge approval; then toolchain-install approval for the APK.

### Do Not Redo
The toolchain version research; the two new docs.

### Next Action
Pedro decides: (a) authorize push of `d582223` so review covers the snap fix;
(b) trigger the independent review (relay to Lana/Codex); (c) approve merge after
review; (d) approve toolchain install for the APK. Exact next command once (a) is
approved: `git push origin muse/angle-detector-industrial-ui` (from a machine with
GitHub write access), then blob-verify.

## Session 012 — AD-03 Codex FAIL corrections (2026-10-09)

### Goal
Owner-authorized (via Lana 1 relay): correct Codex FAIL defects on
`muse/angle-detector-industrial-ui`. Local commits only; no push, no merge.

### P1 — Frozen-frame rotation defect (root cause + fix)
**Root cause:** `ManualProtractor` rendered the frozen `<img>` with
`w-full h-full` (stretch to fill), while points were stored in
container-normalized coords and the geometry engine used original image
dimensions. Rotating after freeze (3:4 ↔ 16:9) distorted the image; a 45° bend
no longer measured 45°.

**Fix:** New `src/render/containRect.ts` (pure functions): `containRect`
(object-contain rect), `toImageNorm` (container → image-normalized),
`toContainerPx` (image-normalized → container). The `<img>` is explicitly
positioned at the contain rect (letterboxed, never stretched). Points are now
stored image-normalized; `toNorm`/`px`/hit-testing all go through the rect.
Geometry engine, loupe, snap, and PNG export unchanged (they already consume
image-normalized points × original dimensions).

**Verification:**
- 10 new tests in `tests/containRect.test.ts`: contain math, round-trip,
  45° fixture across portrait→landscape→portrait, pre/post-rotation placement,
  old-stretch-would-fail proof. All pass.
- Browser (headless Chromium, 45° fixture, CDP taps): portrait 45.1°,
  landscape (rotated) 45.1° — image letterboxed, angle invariant.
  Screenshots: `~/workspace/your_files/angle-detector-ui/p1-fix/`.

### P2 — Warning contrast
`text-gray-500` (4.3:1, below 4.5:1) → `text-gray-300` (14.3:1 on black,
8.6:1 pessimistic). Verified by computation.

### Hardening
- `aria-pressed` + `aria-label` on snap/lock/convention toggles.
- Pointer drag tracks `activePointerId`; secondary touches ignored.
- Convention label now visible on mobile (was `hidden sm:inline`).

### Results
60/60 tests (50 existing + 10 new), tsc clean, lint clean, build clean.
Committed locally on `muse/angle-detector-industrial-ui`. NOT pushed, NOT merged.
Phase 2 Live UI not started.

### Gate
Ready for Codex re-review. Awaiting owner: trigger re-review → merge approval.
