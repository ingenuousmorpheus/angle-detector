# AD-00 Baseline

Recorded 2026-10-03, before any change to measurement behavior.

## Current behavior (preserved)

- Camera → `object-cover` crop → JPEG → `services/geminiService.ts` → Gemini returns
  `{isAngleFound, description, angle, points[start, vertex, end]}`.
- The number shown on screen is **Gemini's own number**, printed to two decimals
  (`AngleDisplay.tsx`, `CameraAngleDetector.tsx`). Nothing deterministic checks it.
- The system prompt tells Gemini: *if a digital display is visible near the vertex, use its
  value as the definitive angle.* See the Mitutoyo finding below for why that is dangerous.
- `vite.config.ts` injects `GEMINI_API_KEY` into the browser bundle (unchanged in AD-00; fixed in AD-09).
- `npm run lint` (tsc) and `npm run build` pass.

## Fixtures

| Set | Source of truth | Where |
|---|---|---|
| Synthetic bends: 15, 30, 45, 60, 75, 90, 105, 120, 135, 150° × 3 rotations | construction (`src/fixtures/syntheticAngle.ts`) | generated in memory; PNGs via `npm run fixtures:export` → `fixtures/synthetic/` |
| Mitutoyo digital protractor (generated 3D model `anglefinder1.glb`) | blade silhouettes in an orthographic render (`scripts/fixtures/mitutoyo_truth.py`) | `fixtures/mitutoyo-digital-protractor/` |

### Mitutoyo fixture — ground truth

| Quantity | Value |
|---|---|
| Included angle between the blades (vertex = blade-centerline intersection, at the pivot) | **134.65° ± 0.9°** |
| Supplement | 45.35° |
| Top-edge pair / bottom-edge pair | 135.54° / 133.77° (the generated blades taper slightly — that spread is the uncertainty) |
| LCD reading printed in the model's texture | 101.5° |

The LCD number is part of a **generated texture** and does not agree with the model's own
geometry (33° off). This is exactly invariant 4 of `anglelensession.md`: a generated model
must never silently become metrology ground truth. The current Gemini prompt rule
"use the display value as the definitive angle" would report 101.5° here.

## Gemini error / latency

**Status: PENDING — not run.** No `GEMINI_API_KEY` was available in the session that set up
AD-00. Run:

```bash
GEMINI_API_KEY=... npm run baseline:gemini
```

It grades all 31 fixtures and writes `baseline/gemini-baseline.json` (median / p95 absolute
error, convention-tolerant error, vertex error in px, latency). No numbers are claimed until
that file exists.

## Device / browser

Not yet recorded on a physical phone. To record: open `npm run dev` on the phone
(`host: 0.0.0.0`, port 3000; camera needs HTTPS or localhost), point at
`fixtures/synthetic/angle_*.png` on a monitor and at a real part checked with the Mitutoyo.
