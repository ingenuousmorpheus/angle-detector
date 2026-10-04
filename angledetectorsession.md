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
