# Known-angle measurement test matrix (1.0.0-rc1)

Purpose: measure repeatability and error against a trusted reference before any accuracy wording is
used. **No row has been run on a phone yet.** Record raw values; do not round.

Reference instrument: ______________ (make, model, resolution, calibration date)
Phone: ______________ (model, Android version) · Build: 1.0.0-rc1 (versionCode 1) · Tester: ______

Procedure per row: set the part, check it with the reference, then take **5 readings** without moving
the part (re-freeze and re-place points each time). Mode: AR Lock unless stated. Snap off unless stated.
Record each reading, then mean, max |error|, and spread (max − min).

| # | Reference angle | Material / finish | Lighting | Camera pose | Mode | R1 | R2 | R3 | R4 | R5 | Mean | Max abs error | Spread |
| - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| 1 | 90° (square) | Printed fixture | Even shop light | Square, ~30 cm | Freeze & Measure | | | | | | | | |
| 2 | 45° | Printed fixture | Even | Square | Freeze & Measure | | | | | | | | |
| 3 | 135° | Printed fixture | Even | Square | Freeze & Measure | | | | | | | | |
| 4 | 90° | Sheet metal, brushed | Even | Square | AR Lock | | | | | | | | |
| 5 | 90° | Sheet metal, brushed | Even | **Tilted ~10°** | AR Lock | | | | | | | | |
| 6 | 90° | Sheet metal, brushed | Even | **Tilted ~20°** | AR Lock | | | | | | | | |
| 7 | 120° | Sheet metal | **Strong glare on one face** | Square | AR Lock | | | | | | | | |
| 8 | 120° | Sheet metal | Dim (<200 lux) | Square | AR Lock | | | | | | | | |
| 9 | 88–92° | Bend with **rounded / imperfect edge** | Even | Square | AR Lock | | | | | | | | |
| 10 | 60° | Dark / painted | Even | Square | AR Lock + **snap on** | | | | | | | | |
| 11 | 30° (acute) | Printed fixture | Even | Square | Freeze & Measure | | | | | | | | |
| 12 | 150° (shallow) | Sheet metal | Even | Square | AR Lock | | | | | | | | |
| 13 | Any row above | Same | Same | Same | **Second tester** | | | | | | | | |

Also record for rows 5–6: how far the reading moved from row 4. This is the expected 2D-projection
error, not an app bug, and it feeds the "hold the phone square" guidance.

Convention check (no phone needed, covered by unit tests in `tests/`): interior θ, supplement 180 − θ,
exterior 360 − θ, labeled on screen and in the saved image.

Pass/fail is **not** defined for accuracy yet. The owner sets a tolerance after the first data set.
