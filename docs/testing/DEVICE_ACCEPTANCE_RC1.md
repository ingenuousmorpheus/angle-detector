# Device acceptance: 1.0.0-rc1

Build under test: release variant (versionCode 1, versionName 1.0.0-rc1, target SDK 36), branch `release/rc-01`.
For installing, the unsigned release APK was signed with the local **Android debug key** (not a release or upload key).
Result key: **PASS** = observed, **FAIL** = observed, **NOT RUN** = no evidence (not a pass).

Environments used on 2026-11-20:

- **Emulator**: Android Emulator 36, system image `android-36;google_apis;x86_64` (Android 16), Pixel 6 profile
  (1080×2400, 420 dpi), rear camera = emulator virtual scene, WHPX acceleration, SwiftShader software GPU.
  An emulator proves Android/WebView behavior. It does **not** prove camera quality, touch feel,
  performance on a real phone, or measurement accuracy.
- **Browser**: production bundle (`vite preview`) in Chromium (Claude app browser pane), no camera available.
- **Phone**: Moto G Power (2026), Android 16. **Not connected during RC1 preparation: nothing was run on it.**

Screenshots: `docs/testing/rc1-emulator/`.

| # | Requirement | Emulator (API 36) | Browser | Phone | Evidence / notes |
| - | - | - | - | - | - |
| 1a | Rear camera starts | **PASS** | n/a | NOT RUN | System prompt "Allow Angle Lens to take pictures and record video?"; after allow, live rear (virtual scene) view; `dumpsys media.camera` shows the app as the active client. `03-live-ar-ghost.jpg` |
| 1b | Permission denial | **PASS** | PASS | NOT RUN | "Don't allow" → no crash, message "Could not access camera… or use Open Photo", AR Lock/Freeze disabled. `02-camera-denied.jpg` |
| 2a | AR Lock | **PASS** | n/a | NOT RUN | Freezes with arms pre-placed (120.0°), 3D protractor + LCD drawn. On SwiftShader the overlay took ~3–7 s to appear; on the real phone earlier it appeared at once (not re-measured). `04-ar-lock-dragged.jpg` |
| 2b | Manual measurement | **PASS** | PASS | NOT RUN | Taps on the 90° synthetic fixture read 89.4° (emulator); drawn 60° read 59.7° (browser). Differences come from tap placement. |
| 3a | Touch drag | **PASS** (single-finger `input swipe`) | n/a | NOT RUN | Dragging a handle updated reading, arc, protractor arm and LCD (120.0 → 115.5°). |
| 3b | Rapid multi-touch | NOT RUN | NOT RUN | NOT RUN | adb cannot inject multi-pointer gestures. Covered only by `tests/pointerGuard.test.ts` (two pointerdowns before re-render). Needs a phone. |
| 4 | Rotation | **PASS** with UI issue | PASS | NOT RUN | Portrait → landscape → portrait: same process (no restart), points and reading kept (64.5° throughout). In landscape the readout is below the fold (scroll needed). `06-landscape.jpg` |
| 5a | Photo import | **PASS** | PASS | NOT RUN | Open Photo → Android photo picker → image opens in manual mode. `08-photo-import.jpg` |
| 5b | Annotated export | **PASS** | PASS (download) | NOT RUN | Save → Android share sheet "Sharing image" with the annotated PNG (64.5°, supplement label). Saving to a specific gallery app not exercised. `05-save-share-sheet.jpg` |
| 6 | Offline | **PASS** | PASS | NOT RUN | Airplane mode + Wi-Fi/data off (ping fails); cold start, camera, AR Lock (120.0°) all work. `07-offline-ar-lock.jpg` |
| 7 | Pause / resume, camera release | **PASS** | n/a | NOT RUN | Home → camera client list empty (DISCONNECT logged); return → CONNECT, live view resumes. |
| 8 | Conventions, deterministic geometry | n/a | n/a | n/a | **PASS** in unit tests (76/76). On emulator: interior 115.5° → supplement 64.5°, labeled on screen and in the saved image. |
| 9 | Glare, tilt, imperfect edges | NOT RUN | NOT RUN | NOT RUN | Needs a real camera, real parts and a reference: `KNOWN_ANGLE_TEST_MATRIX.md`. |
| 10 | Small screens | **FAIL (usability)** | FAIL (usability) | NOT RUN | At 720×1280 @320 dpi (and 360×640 CSS in the browser), AR Lock / Freeze / Open Photo are entirely below the fold; the user must scroll to find them. Functionally they work. `10-small-screen-720x1280.jpg` |
| 11 | Install / upgrade | **PASS** | n/a | NOT RUN | Clean install OK; `install -r` of the same build kept the app and its camera grant. Upgrade from the earlier side-loaded debug APK was not tested on the phone (different builds may be signed by the same debug key; Play builds will not be). |
| 12 | Launch screen | **PASS** | n/a | NOT RUN | Angle Lens mark on #111827 (Capacitor default splash removed). `01-splash.jpg` |
| 13 | System bars | **PASS** after fix | n/a | NOT RUN | Dark bars with light icons. `09-final-build-home.jpg` |

## Bugs found and fixed during RC1 testing

1. Android WebView painted a large grey "play" placeholder in the camera box before the camera started → transparent `poster`.
2. White strips behind the status/navigation bars (edge-to-edge margins) → dark window background, light bar icons.
3. A camera-denied error stayed on screen after a photo opened successfully → error cleared when a frame opens.
4. `<a download>` does nothing in the Android WebView, so Save did nothing in the app → share-sheet export via Capacitor Filesystem + Share.
5. Camera stayed open while the app was in the background → released on `visibilitychange`, reopened on return.

## Not yet run (need the phone)

Everything in the Phone column, multi-touch, glare/tilt/edge reliability, real-camera AR overlay speed,
saving into the gallery/Files from the share sheet, and the known-angle matrix.
