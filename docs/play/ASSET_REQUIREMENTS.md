# Store asset requirements and status

| Asset | Google Play requirement | Status |
| --- | --- | --- |
| App icon | 512 × 512 PNG (32-bit, alpha allowed), ≤ 1 MB | **To export** from `docs/images/logo.svg` (same mark as the launcher icon) |
| Feature graphic | 1024 × 500 PNG/JPEG, no alpha | **To make** |
| Phone screenshots | 2–8 images, PNG/JPEG, each side 320–3840 px, aspect up to 2:1 (16:9 or 9:16 typical) | Have 2 real device shots (`docs/images/ar-lock-*.jpg`, cropped 540 px wide; re-capture full-res). They show the **old "Live Angle Detector" heading** and the **Mitutoyo-branded overlay**; retake after the branding decision |
| 7" / 10" tablet screenshots | Optional for phones-only app | Skip for closed test |
| Launcher icon (adaptive) | Foreground + background + monochrome | Done: `android/app/src/main/res/mipmap-anydpi-v26`, `drawable/ic_angle_lens_foreground.xml` |
| Splash screen | Android 12+ uses icon + background | Done in 1.0.0-rc1 (replaced Capacitor's default splash) |
| Privacy policy URL | Required (app uses CAMERA) | Draft: `docs/play/PRIVACY_POLICY.md`; needs a public URL |

Suggested screenshot set (portrait, 1080 × 1920 or the phone's native size, no status-bar clutter):
1. Live view with the AR ghost and crosshair. 2. AR Lock on a real bend with reading. 3. Manual Freeze & Measure with the arc.
4. Convention toggle showing supplement. 5. Save/share sheet with the annotated image.
