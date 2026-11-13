# Moto G Power — Real-Device Acceptance Plan

**Device:** Moto G Power (2026), Android 16. **Build under test:** debug APK from
`docs/ANDROID_APK_PLAN.md` (AD-03 branch, post-merge).
**Principle:** verify behavior first, measure accuracy second, claim only what was measured.

## Prerequisites

- [ ] Debug APK installed via `adb install` (or file transfer + tap to install).
- [ ] A trusted reference for angles: a digital protractor, machinist's protractor, or
      printed gauge blocks with known angles (record make/model).
- [ ] Test pieces: at least 3 sheet-metal bends or printed angle fixtures spanning
      acute (~45°), right (90°), and obtuse (~135°) — include one bend near a
      press-brake-relevant angle if available.
- [ ] Good workshop lighting; note lighting conditions per measurement.

## Test 1 — Camera access

1. Fresh install → launch → tap **Start Camera**.
2. Expect: Android permission prompt → Allow → live rear-camera preview.
3. Deny once → expect the app's error state ("Could not access camera … or use Open Photo"),
   no crash. Re-allow from system settings → camera works.
4. **Pass if:** prompt appears, allow → preview, deny → graceful error.

## Test 2 — Freeze-frame + three-point placement

1. Aim at a bend, tap **Freeze & Measure**.
2. Tap vertex, then a point on each edge (use the loupe while placing).
3. **Pass if:** FROZEN chip appears, angle reads, points land where tapped
   (loupe shows placement), no UI overlap at the phone's width.

## Test 3 — Handle dragging + correction

1. Drag each handle ~20px and back.
2. **Pass if:** the reading updates live during drag, returns near the original value
   when dragged back, no handle sticks or jumps.

## Test 4 — Lock + export

1. Tap **Lock** → expect LOCKED chip; taps/drag no longer move points.
2. Tap **Save** (download icon) → expect a PNG in Downloads/gallery with the
   annotation overlay visible.
3. **Pass if:** lock freezes interaction, export produces a viewable annotated PNG.
   (If export silently fails in the WebView → file under "issues", use the
   Filesystem fallback from the APK plan.)

## Test 5 — Rotation + safe areas

1. With a measurement placed, rotate portrait → landscape → portrait.
2. **Pass if:** points stay aligned with the frozen frame, no crash, no controls
   hidden under the navigation/gesture bar.

## Test 6 — Accuracy vs trusted reference (the only numbers that matter)

For each test piece, with the camera held perpendicular to the bend plane:

| # | Piece | Reference angle | App reading | Abs. error | Notes (lighting, distance) |
|---|-------|----------------|-------------|------------|----------------------------|
| 1 |       |                |             |            |                            |
| 2 |       |                |             |            |                            |
| 3 |       |                |             |            |                            |

Repeat each piece 3× (re-place points each time) to check repeatability.

**Pass criteria (proposed, owner to confirm):** median absolute error ≤ 1.0° and no
single error > 2.0° across the set, under the recorded conditions. These numbers are
a starting proposal — the app makes no accuracy claim until this table is filled.

## Test 7 — Snap behavior on real parts

1. With snap OFF (default), place points on a detailed/busy part → record reading.
2. Enable snap, re-place → record reading and whether snap visibly pulled a point
   (watch the loupe).
3. **Pass if:** the operator can tell which mode is active (readout says so) and the
   guidance text is visible. Record any wrong-feature selections.

## Reporting

For each test: PASS / FAIL + one-line observation. Attach: the accuracy table, 2–3
screenshots (one portrait measurement, one landscape, one exported PNG), device
model + Android version + APK build (git hash).

## Out of scope for this round

Press-brake production use, tolerance/pass-fail decisions, calibration certificates.
The app remains a 2D-apparent-angle instrument until a broader validation set exists.
