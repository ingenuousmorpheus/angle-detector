# Angle Lens — Development Session

**Project:** Angle Detector → Angle Lens  
**Repository:** `ingenuousmorpheus/angle-detector`  
**Started:** 2026-09-29  
**Current stack:** Vite + React 19 + TypeScript + browser camera + Gemini vision  
**Primary use case:** Point a phone camera at a bent piece of metal, place the bend/vertex near the center target, and have the app determine the angle with a visible AR-style outline around the two metal faces.  
**Long-term destination:** A reusable AR measurement engine that can later run in a phone AR mode and eventually smart-glasses/Lana-style vision.

---

## 0. Current Repository State

The existing foundation is useful and should be enhanced rather than rewritten.

Current behavior:

- rear camera opens with `getUserMedia`;
- the UI already has a centered bullseye;
- the user taps **Analyze Angle**;
- the visible camera crop is copied to a canvas;
- Gemini analyzes the frame;
- Gemini currently returns:
  - whether an angle was found;
  - a description;
  - a numerical angle;
  - normalized `[start, vertex, end]` points;
- `AngleDisplay.tsx` draws the detected angle over the camera feed with a glowing SVG path.

Current key files:

- `App.tsx`
- `components/CameraAngleDetector.tsx`
- `components/AngleDisplay.tsx`
- `services/geminiService.ts`
- `types.ts`
- `angledetectorsession.md`

The project already has the beginnings of the visual language needed for Angle Lens. The next step is to separate **object understanding**, **measurement geometry**, and **AR presentation** so that the number shown on screen is produced by deterministic geometry rather than by the language/vision model.

---

# 1. Product Vision

The physical Mitutoyo protractor is the right mental model.

A mechanical protractor works because two blades define two vectors and a pivot defines their vertex.

Angle Lens should do the same thing digitally:

```text
camera
  ↓
find the metal near screen center
  ↓
identify the two faces/edges that meet at the bend
  ↓
locate the bend vertex
  ↓
fit one direction vector to each side
  ↓
calculate the angle mathematically
  ↓
draw a glowing outline/3D ghost around the metal
  ↓
display angle + confidence
```

The app should feel as if it is "locking onto" the metal rather than merely drawing two generic lines.

---

# 2. Core Measurement Rule

**The angle at the center is the only angle that matters.**

The center crosshair remains the operator's selection mechanism.

Initial search region:

```text
center = (0.50, 0.50)
vertex acceptance radius = approximately 8–12% of frame width
```

The detector may see many corners and edges, but only a candidate vertex inside or very near the center target can become the active measurement.

If no trustworthy vertex is near the center, the app should say:

```text
NO ANGLE LOCK
Place bend in center
```

It should not guess.

---

# 3. Measurement Modes

Angle Lens should eventually expose three distinct modes.

### MODE A — 2D Angle

Measures the apparent angle in the camera image.

Fastest and easiest.

Useful when the phone camera is nearly perpendicular to the plane being measured.

### MODE B — Plane-Corrected Angle

Corrects perspective when the metal surface is tilted relative to the camera.

Uses camera calibration, a detected reference plane, or user-assisted plane alignment.

### MODE C — AR / 3D Angle

Uses device pose, camera intrinsics, depth/plane information, and tracked 3D rays/planes.

This becomes the preferred mode on AR-capable devices.

The UI must always identify which mode produced a result.

---

# 4. Important Architecture Decision

## AI finds. Geometry measures.

Gemini should not remain the final authority for the degree value.

Gemini or another vision model can help answer:

- Which object near the center is the piece of metal?
- Which visible surfaces probably belong to the same bend?
- Which candidate edges should the geometry engine inspect?
- Is glare, blur, or clutter making the scene unreliable?

But the final degree value should come from vector/plane math.

For 2D:

```text
u = A - V
v = B - V

theta = atan2(abs(cross(u, v)), dot(u, v))
```

For future 3D:

```text
theta = acos(
  dot(n1, n2) / (|n1| |n2|)
)
```

where `n1` and `n2` are fitted plane normals.

This separation is what turns the project from an AI demo into a measurement tool.

---

# 5. "Dragon Glow" Metal Outline

Keep the existing glowing angle path, but expand it into a real object-lock visualization.

Visual concept:

1. detect the selected metal region;
2. trace the boundary that belongs to the two bend faces;
3. render a thin glowing contour around those surfaces;
4. intensify the glow at the bend line/vertex;
5. draw the measured angle arc in the center;
6. place the numerical degree label close to the bend.

Suggested lock states:

```text
SEARCHING  → faint animated outline / hologram barely visible
CANDIDATE  → partial translucent ghost forms around the target
ALIGNING   → ghost visibly opens/closes or reshapes toward the detected geometry
LOCKING    → glow intensifies while the numeric result stabilizes
LOCKED     → stable bright outline + angle arc + final measurement
UNSTABLE   → ghost fades/pulses + corrective instruction
```

### Holographic "Lana / Terminator" presentation

The intended presentation is not a rigid CAD overlay. It should feel like the semi-transparent Lana presentation used in Time Reassignment combined with a Terminator-style target lock.

For a bend, a faint two-face holographic shape should appear around the selected metal. While the measurement engine is still solving, the hologram can visibly open and close around the hinge as candidate angles change. As confidence and temporal stability increase, the motion should settle. When the engine reaches the lock threshold, the hologram stops moving, the contour brightens/glows, the bend line flashes, and the final degree value appears.

The animation is a visualization of the solver state, not a source of measurement. It must always be driven by the current measured geometry and confidence.

The glowing outline is not just cosmetic. It tells the operator **exactly what geometry the app believes it is measuring**.

If the wrong piece is glowing, the user immediately knows not to trust the number.

---

# 6. Meshy / Generated-Model Visual Concept

The intended Meshy idea is primarily a **visual/prompt reference for the holographic measurement animation**, not a requirement that every live measurement call the Meshy API.

The desired effect is:

```text
center target finds object
        ↓
faded model/ghost begins to form
        ↓
ghost opens/closes or reshapes while solver searches
        ↓
ghost aligns to the detected geometry
        ↓
confidence reaches lock threshold
        ↓
ghost brightens / "Dragon Glow" activates
        ↓
final calculation appears
```

This is similar to a translucent generated model being placed over the real object, with the faded/holographic quality of Lana in Time Reassignment and the target-acquisition feel of Terminator Vision.

### Runtime implementation

For simple geometry such as a brake bend, the live hologram should normally be generated parametrically from the actual measurement:

- shared vertex/bend line;
- face direction 1;
- face direction 2;
- estimated face extent/depth;
- current angle candidate;
- current confidence/stability.

The renderer can continuously animate those planes toward the solver result. This gives the exact visual behavior desired without allowing a generated mesh to alter the measurement.

### Optional Meshy use

Meshy can still help with:

- generating a visual reference asset/style for the ghost;
- complex test objects;
- synthetic fixtures and training scenes;
- brackets, channels, shoes, clothing forms, and other representative 3D assets;
- demonstrating how a more complex holographic shell should appear;
- prototyping the "faded generated object" aesthetic.

If a Meshy-generated model is used in live presentation, it is a **display shell**. The measurement engine remains the source of geometry and numeric results.

### Measurement rule

A generated mesh is an interpretation of an object and can look correct while being dimensionally wrong. Therefore:

**Meshy/generative geometry may visualize or assist identification, but must never silently become metrology ground truth.**

Runtime concept:

```text
real object
   +
segmentation / tracked landmarks
   +
deterministic measured geometry
   +
faded holographic shell
   +
confidence-driven glow
```

This separation preserves both goals: trustworthy math underneath and the futuristic Meshy/Lana/Terminator visual experience on top.

---

# 7. Proposed Internal Pipeline

```text
CameraFrame
   │
   ├── camera metadata
   │   ├── frame size
   │   ├── orientation
   │   └── later: intrinsics / pose / depth
   │
   ▼
Center ROI
   │
   ▼
Metal/Object Candidate
   │
   ├── segmentation
   └── optional AI semantic hint
   │
   ▼
Edge Extraction
   │
   ├── gradients / Canny-style edges
   ├── line segments
   └── contour boundaries
   │
   ▼
Candidate Bend Pairs
   │
   ├── intersection near center
   ├── length score
   ├── contrast score
   ├── metal-mask support
   └── temporal stability
   │
   ▼
Geometry Solver
   │
   ├── vertex
   ├── vector A
   ├── vector B
   ├── interior angle
   └── supplement/exterior angle
   │
   ▼
Quality Gate
   │
   ├── confidence
   ├── blur
   ├── perspective
   ├── occlusion
   └── ambiguity
   │
   ▼
Tracker
   │
   └── stabilize across frames
   │
   ▼
Angle Lens Renderer
       ├── glow contour
       ├── bend highlight
       ├── angle arc
       ├── degree label
       └── AR ghost planes
```

---

# 8. New Module Layout

Do not force all logic into `CameraAngleDetector.tsx`.

Target structure:

```text
src/
  camera/
    cameraFrame.ts
    cameraTransform.ts

  geometry/
    angle2d.ts
    angle3d.ts
    lineFit.ts
    intersections.ts
    homography.ts

  vision/
    centerROI.ts
    edges.ts
    contours.ts
    segmentMetal.ts
    bendCandidates.ts

  tracking/
    angleTracker.ts
    stability.ts

  measurement/
    measurementEngine.ts
    confidence.ts
    measurementTypes.ts

  render/
    AngleLensOverlay.tsx
    GlowContour.tsx
    AngleArc.tsx
    GhostPlanes.tsx

  ar/
    arAdapter.ts
    browserAdapter.ts
    nativeARAdapter.ts
```

The current repository is small, so migration can happen gradually. Do not perform a large rewrite in one pass.

---

# 9. Data Contract

Replace the current AI-shaped result with a measurement result that can survive the transition from browser camera to AR.

Example:

```ts
export type MeasurementMode =
  | 'apparent-2d'
  | 'plane-corrected'
  | 'ar-3d';

export interface AngleMeasurement {
  found: boolean;
  angleDeg: number | null;
  supplementDeg: number | null;

  vertex2D?: Point;
  edgeA2D?: [Point, Point];
  edgeB2D?: [Point, Point];

  confidence: number;
  stability: number;
  mode: MeasurementMode;

  reason?: string;

  // Later AR fields
  vertex3D?: Vec3;
  normalA?: Vec3;
  normalB?: Vec3;
}
```

Gemini results should be converted into **hints**, not directly into `AngleMeasurement`.

---

# BUILD ROADMAP

## AL-00 — Preserve Current App + Establish Ground Truth

Before changing the detector:

- keep the current Gemini mode working;
- create a branch/checkpoint;
- record screenshots and behavior;
- create test images with known angles;
- use the physical Mitutoyo as the comparison tool;
- include common work angles such as:
  - 30°
  - 45°
  - 60°
  - 75°
  - 90°
  - 105°
  - 120°
  - 135°
  - 150°.

For each physical test capture:

- reference angle;
- Angle Lens reading;
- distance from camera;
- approximate phone tilt;
- lighting;
- material surface;
- whether glare was present.

**Gate:** we have baseline error before improving anything.

---

## AL-01 — Deterministic Angle Math

Create pure TypeScript geometry functions.

Required:

- angle from three 2D points;
- angle from two line vectors;
- line intersection;
- interior/supplement conversion;
- normalized ↔ pixel coordinate transforms.

Add unit tests.

The math layer must have **zero dependency on Gemini, React, camera APIs, or AR**.

**Gate:** synthetic geometry returns known angles within floating-point tolerance.

---

## AL-02 — Manual Center-Lock Mode

Before automatic computer vision, create a manual mode that proves the geometry and UI.

Workflow:

1. point camera;
2. freeze frame;
3. place vertex at center or tap vertex;
4. tap/drag point on face A;
5. tap/drag point on face B;
6. app calculates angle;
7. glowing overlay shows exactly which vectors are measured.

Add:

- magnified loupe while dragging;
- reset;
- lock;
- inside/outside angle toggle;
- "snap to nearby edge."

This becomes the fallback mode when automatic detection is uncertain.

**Gate:** repeated measurements of a clean fixture agree closely.

---

## AL-03 — Center ROI Edge Detector

Implement the first automatic detector locally.

Start only with the center region, not the whole frame.

Candidate algorithm:

```text
crop center ROI
→ grayscale
→ local contrast
→ light denoise
→ edge extraction
→ line-segment detection
→ discard tiny segments
→ find intersections
→ score intersections by distance to center
→ choose best two supported lines
→ calculate angle
```

Do not optimize for every object yet.

Optimize first for:

- bent sheet metal;
- brake-formed flanges;
- straight brackets;
- clean V-like profiles.

**Gate:** known fixtures can be detected without Gemini.

---

## AL-04 — Metal Segmentation + Glow Outline

Add a segmentation layer around the selected object.

The purpose is not to perfectly classify all metal in the scene. It is to determine which pixels/edges support the active angle.

Possible progression:

### V1
Classical contour + edge connectivity around the center.

### V2
Lightweight segmentation model running locally/on-device.

### V3
Optional AI segmentation hint when the scene is confusing.

Renderer:

- trace the detected surface;
- show faint glow while acquiring;
- lock glow when stable;
- highlight face A and face B separately;
- emphasize the bend.

**Gate:** operator can visually confirm what is being measured.

---

## AL-05 — Parametric 3D Angle Ghost

Create a simple 3D representation from the measured geometry.

Do **not** call Meshy every time the user measures an angle.

Instead construct:

- Plane A;
- Plane B;
- shared hinge/bend;
- angle arc;
- optional extrusion depth.

Initially this can be rendered with Three.js over the camera preview.

Purpose:

- prove 3D presentation;
- test AR-style interaction while still inside the browser app;
- provide the visual "model hugging the metal" concept.

The ghost should remain tied to the detected vectors. If tracking confidence falls, fade it rather than letting it drift.

**Gate:** changing a known angle changes the ghost geometry exactly.

---

## AL-06 — Perspective Awareness

2D line angles can be wrong when the camera views the bend obliquely.

Add a perspective-quality indicator.

Early version:

- use device orientation when available;
- estimate line foreshortening;
- warn when view is too oblique;
- display:
  - `GOOD VIEW`
  - `TILT PHONE`
  - `ALIGN WITH BEND`.

Next:

- identify the surface plane;
- rectify it using homography;
- calculate the corrected angle from the rectified geometry.

**Gate:** off-axis tests improve after correction and bad views fail closed.

---

## AL-07 — Live Tracking

Move from one-shot Analyze to continuous measurement.

Pipeline frequency should be split:

- camera preview: native/full rate;
- lightweight tracking: frequent;
- full edge re-detection: lower rate;
- AI assistance: only on demand or when lost.

Add smoothing:

- exponential moving average for angle;
- vertex position smoothing;
- hysteresis for lock/unlock;
- minimum stable-frame count before displaying a final reading.

Example:

```text
SEARCHING
47.0
47.2
47.1
47.1
LOCKED 47.1°
```

Do not average across a true scene change.

**Gate:** measurement remains steady while the hand naturally moves.

---

## AL-08 — Accuracy + Confidence Engine

Confidence should reflect evidence, not AI certainty.

Possible score components:

- distance of vertex from center;
- edge length;
- fit residual/error;
- angle consistency across frames;
- segmentation support;
- blur score;
- glare/overexposure;
- perspective quality;
- candidate ambiguity.

Example UI:

```text
47.1°
HIGH CONFIDENCE
AR/2D LOCK
```

or:

```text
47°?
LOW CONFIDENCE
Move closer
```

Only show decimals that validation supports.

**Gate:** bad scenes become warnings instead of confidently wrong numbers.

---

## AL-09 — Meshy Synthetic Fixture Lab

This is where Meshy becomes especially useful.

Create development/training scenes containing:

- V bends;
- channels;
- Z bends;
- brackets;
- sheet-metal flanges;
- shiny and dull finishes;
- different thicknesses;
- cluttered work backgrounds.

Known target angle is stored with each fixture.

Then render/capture those models from:

- different camera distances;
- different lighting;
- different yaw/pitch;
- partial occlusion.

This creates a synthetic regression set.

For simple fixtures, also generate exact parametric models in Blender/Three.js so the ground-truth angle is guaranteed.

**Rule:** Meshy-generated shape = test/reference asset, not metrology truth unless its geometry is independently verified.

---

## AL-10 — Mobile Packaging

Keep the measurement core in TypeScript so the current web app remains useful.

For serious AR, prepare a native shell rather than tying measurement logic to browser APIs.

Recommended transition:

```text
React/Vite measurement app
        ↓
pure TS measurement engine
        ↓
mobile wrapper / native bridge
        ↓
AR-capable Android implementation
```

Capacitor can be evaluated as a bridge for the current UI, but the AR layer should have a clean adapter so native AR APIs can be used directly when required.

Do not duplicate the angle math in the native app.

---

## AL-11 — AR Phone Mode

Create an `ARAdapter` abstraction.

Minimum adapter abilities:

- camera intrinsics;
- device/world pose;
- hit-test/raycast if supported;
- plane/depth data if available;
- world anchor creation;
- convert 2D screen points to 3D rays.

Measurement flow:

```text
screen center
↓
raycast
↓
candidate bend region
↓
fit two surface planes / edge directions
↓
calculate real 3D angle
↓
anchor ghost planes to metal
↓
display world-locked degree value
```

The renderer should remain visually similar to the existing Angle Lens overlay so users do not have to relearn the app.

---

## AL-12 — AR Glasses / Lana Vision Migration

The final destination is not a separate measurement implementation.

Angle Lens becomes a reusable perception tool.

Interface concept:

```text
Lana / glasses camera frame
+ device pose/depth
+ center/gaze target

        ↓

Angle Lens Measurement Engine

        ↓

{
  angleDeg,
  confidence,
  vertex,
  surfaces,
  worldAnchor,
  guidance
}

        ↓

HUD / voice / automation
```

Possible future behavior:

> "Lana, check this bend."

The user's gaze/crosshair selects the joint.

Angle Lens locks the two faces, outlines the part, measures the 3D angle, and Lana can speak the result.

The measurement engine remains usable without Lana.

---

## AL-13 — Terminator Vision General Measurement Layer

Angle Lens should eventually become one measurement capability inside the broader Terminator Vision system.

The same architecture can support objects beyond brake-formed metal, but each measurement class must use geometry appropriate to that object.

Potential modes:

- **Angle mode** — bend angles, corners, brackets, tooling;
- **Linear mode** — width, height, distance, diameter;
- **Foot / shoe estimate mode** — foot length/width and likely shoe-size range;
- **Body / clothing estimate mode** — shoulder width, chest/torso dimensions, sleeve/inseam proxies, likely shirt-size range;
- **Object fit mode** — compare an observed object against a known dimensional template.

### Important distinction

Rigid-object angles can often be measured directly from geometric features.

Shoe and clothing size estimation is harder because a single RGB image has no guaranteed real-world scale. These modes should use some combination of:

- AR depth when available;
- camera intrinsics;
- detected floor/body planes;
- known reference dimensions;
- user-provided height where appropriate;
- multiple views;
- pose/body landmark tracking;
- confidence ranges instead of pretending to know an exact size.

Example output:

```text
SHIRT SIZE ESTIMATE
Likely: M
Range: M–L
Confidence: 0.82
Basis: shoulder + torso geometry
```

or:

```text
FOOT LENGTH
Estimated: 27.1 cm ± 0.8 cm
Likely shoe range shown separately
```

Do not collapse body dimensions directly into a universal clothing size. Brand and garment sizing varies, so actual body measurements and the resulting size recommendation should remain separate fields.

### Terminator Vision visual behavior

The presentation language remains consistent across modes:

```text
SEARCHING
→ faint holographic shell

CANDIDATE
→ target outline / landmarks appear

ALIGNING
→ shell reshapes to the observed object/person

LOCKING
→ glow intensifies and measurements stabilize

LOCKED
→ final dimensions + confidence appear
```

For a person, the hologram can be a subtle faded body/garment shell rather than a solid character model. For a shoe/foot, it can be a translucent footprint/last-shaped shell with length and width markers.

### Lana integration

Future interaction could include:

> "Lana, measure this bend."

> "Lana, what size shoe does this look like?"

> "Lana, estimate the shirt size."

Lana/Terminator Vision handles target selection, dialogue, and presentation. Angle Lens/general measurement modules return structured measurements and confidence. Lana must communicate estimates as estimates when scale/depth evidence is limited.

**Gate:** each new measurement mode has its own validation set and never inherits an accuracy claim from Angle Mode.

# 10. User Experience Target

The finished phone workflow should feel like this:

1. Open Angle Lens.
2. Point camera at the workpiece.
3. Move the bend into the center target.
4. A faint translucent holographic shape begins forming around the metal.
5. The ghost opens/closes as the solver tests candidate geometry.
6. Two measured surfaces become outlined and the ghost settles onto them.
7. Glow intensity increases as confidence/stability rises.
8. Bend line/vertex flashes when acquired.
9. The final angle appears only when the reading reaches the configured lock threshold.
10. Tap Lock to freeze/save the measurement.
11. If perspective is poor, the hologram fades/pulses and the app tells the operator how to move the phone.

Example:

```text
          44.9°
       ────◉╲
           ╲
       LOCKED
   HIGH CONFIDENCE
```

The key emotional/visual effect is: **the software appears to understand the physical metal in front of it.**

---

# 11. Measurement Conventions

Press-brake work can describe angles differently, so Angle Lens must make the convention explicit.

Support:

- included/interior angle;
- exterior angle;
- supplement;
- acute/obtuse selection where applicable.

Never silently convert one convention to another.

Later allow a shop default in settings.

---

# 12. Accuracy Rules

Angle Lens must not imply accuracy it has not earned.

Rules:

- two decimal places are presentation only until validation supports them;
- do not label a measurement "precise" because Gemini returned a precise-looking number;
- compare against trusted physical references;
- record repeatability;
- test multiple phones;
- test glare, dark surfaces, scratches, and dirty material;
- test at realistic working distances.

Initial product target should be **repeatable and honest**, not an unsupported tolerance claim.

---

# 13. Security / Production Note

The current client-side Gemini setup uses a build-time API key path.

Before public deployment:

- do not ship a reusable cloud API key in browser JavaScript;
- place optional Gemini calls behind a secure backend/proxy, or use local/on-device inference;
- core measurement must continue working without cloud AI.

---

# 14. First Engineering Sprint

Do these next, in order:

1. Create a recoverable git checkpoint.
2. Keep current Gemini behavior intact.
3. Add `geometry/angle2d.ts`.
4. Add unit tests for known angles.
5. Add a manual three-point/freeze-frame mode.
6. Change the display value so manual mode is calculated by geometry.
7. Refactor `AngleDisplay` into a reusable overlay receiving geometry rather than an AI-specific result.
8. Add `measurementTypes.ts`.
9. Add a simple center-ROI local edge detector prototype.
10. Compare detector output against the Mitutoyo on real parts.

Do **not** start native AR until the geometry core and validation harness are working.

---

# 15. First Acceptance Test

Use a real bent part with a trusted physical reference.

For each test:

1. set reference angle with the Mitutoyo;
2. photograph/scan with Angle Lens;
3. center the bend;
4. record:
   - app angle;
   - reference angle;
   - absolute error;
   - stability;
   - confidence;
5. repeat at least five times without changing the part;
6. repeat with the phone slightly tilted.

The first milestone is not "looks futuristic."

The first milestone is:

> **Angle Lens identifies the same physical bend the operator intended, calculates it deterministically, and shows the user exactly what geometry produced the number.**

---

# 16. Core Invariants

1. **Center target selects the measurement.**
2. **AI may identify; deterministic geometry measures.**
3. **The glowing outline must correspond to the actual measured geometry.**
4. **A generated Meshy model must never silently become metrology ground truth.**
5. **Low confidence fails visibly instead of guessing.**
6. **The measurement core remains independent of React, Gemini, and any one AR platform.**
7. **AR is an upgrade to the measurement engine, not a rewrite of it.**
8. **No accuracy claim without fixture testing.**
9. **The holographic shell is presentation driven by measurement state; it never drives the measurement.**
10. **General body/shoe/clothing modes must expose uncertainty and must not pretend a single RGB image provides absolute scale.**

---

# 17. Resume Point

When development resumes, begin with **AL-01 and AL-02**.

Do not rewrite the current application.

First build a deterministic angle-math core and a manual three-point measurement path inside the existing camera UI. Once that is trustworthy, add automatic center-ROI line/metal detection and the Dragon Glow outline.

The first presentation prototype after that should implement the intended hologram state machine: **SEARCHING → CANDIDATE → ALIGNING → LOCKING → LOCKED**, with a faint two-face ghost visibly opening/closing toward the live solver result and glowing when the measurement is ready.

The 3D ghost and AR migration come after the measurement engine is proven. Generalized Terminator Vision measurements (shoe/body/clothing/object dimensions) should reuse the same renderer and confidence architecture but receive their own measurement algorithms and validation.
