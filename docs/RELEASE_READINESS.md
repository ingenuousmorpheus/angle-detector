# Angle Lens: release readiness (Release Candidate 01)

Date: 2026-11-20 · Branch: `release/rc-01` (from `main` @ `bae7497`) · Version: 1.0.0-rc1 (versionCode 1)
Target: Google Play **closed test**. Nothing has been uploaded to Play.

Labels used: **VERIFIED** (observed in this session, with the evidence named), **FAILED** (observed failing),
**UNTESTED** (no evidence; must not be reported as passing).

---

## 1. Starting point (`main` @ `bae7497`, re-checked, not taken from earlier reports)

| Item | Result |
| --- | --- |
| Unit tests | VERIFIED 71/71 (6 files) |
| TypeScript (`tsc --noEmit`) | VERIFIED clean |
| Production build | VERIFIED OK (884 KB JS, chunk-size warning only) |
| Gemini key in bundle | VERIFIED absent **only because no key was set**; `vite.config.ts` embedded `GEMINI_API_KEY` into any build where it was set, including Android |
| Android SDK | compile/target **35**: below the Play requirement for new apps (36) |
| Splash screen | Capacitor's default splash image, not Angle Lens |
| Save image on Android | Used `<a download>`, which the Android WebView ignores (confirmed broken pattern; fixed below) |
| Camera in background | Stream kept open while the app was paused |
| Dev hook | `?photo=<url>&ar=1` active in every build |
| HTML | `charset="UTF--8"` typo; title "Live Angle Detector"; missing `/vite.svg` favicon |
| Open PRs | None. Branches: `main`, `android/capacitor-apk` (merged), `muse/angle-detector-industrial-ui` (merged via #1/#2), `claude/angle-detection-protractor-PqWCi` (Feb 2026, 2 commits, unrelated older prototype, not merged) |
| Docs reviewed | `anglelensession.md` (roadmap, section 13 security note on the client-side Gemini key), `angledetectorsession.md`, README, `docs/ANDROID_APK_PLAN.md`, `docs/MOTO_G_ACCEPTANCE_PLAN.md`, `docs/BASELINE.md`, `MUSE_ANGLE_DETECTOR_HANDOFF.md` |

## 2. Changes in RC1 and why

| Change | Why | Files |
| --- | --- | --- |
| **AI assist compiled out of release builds.** Gemini code, key and endpoint only exist in `npm run dev` with a key set; loaded by dynamic import | No secure backend exists; a client-side key would be extractable from the APK | `vite.config.ts`, `src/buildFlags.d.ts`, `components/CameraAngleDetector.tsx` |
| **Release bundle guard** `npm run build:release` fails on a Google API key, Gemini client/endpoint, or the `?photo=` hook | Prevents a future build from re-introducing the leak | `scripts/check-release-bundle.mjs`, `tests/releaseBundleCheck.test.ts` |
| `?photo=` developer hook limited to dev builds | Test-only interface | `components/CameraAngleDetector.tsx` |
| compile/target SDK **36**, Android Gradle Plugin 8.7.2 → **8.10.1** | Play target-API requirement; AGP 8.10 supports API 36 | `android/variables.gradle`, `android/build.gradle` |
| versionName **1.0.0-rc1** (versionCode 1), npm package renamed `angle-lens` 1.0.0 | Release identity | `android/app/build.gradle`, `package.json` |
| Release signing from git-ignored `keystore.properties` or `ANGLE_LENS_*` env vars; unsigned otherwise; `debuggable false` | Signed AAB workflow without secrets in git | `android/app/build.gradle`, `.gitignore`, `android/.gitignore`, `docs/ANDROID_RELEASE.md` |
| Branded launch screen (Android 12+ API and pre-12 layer-list); Capacitor splash PNGs removed | Store-quality launch | `res/values/styles.xml`, `res/drawable/splash.xml` |
| Dark system-bar background, light bar icons | White strips around the app (found on emulator) | `res/values/styles.xml` |
| `allowBackup="false"` | App keeps no data worth backing up; simplest Data Safety answer | `AndroidManifest.xml` |
| **Save → Android share sheet** (Capacitor Filesystem cache + Share); browser still downloads | Save did nothing in the Android app | `src/platform/saveImage.ts`, `src/render/ManualProtractor.tsx` |
| Camera released when the app is backgrounded, reopened on return; never two streams | Camera resource cleanup | `components/CameraAngleDetector.tsx` |
| Transparent `<video>` poster | Android WebView painted a grey "play" placeholder | `components/CameraAngleDetector.tsx` |
| Stale camera error cleared when a frame opens | Error stayed visible after Open Photo succeeded | `components/CameraAngleDetector.tsx` |
| HTML charset fix, title "Angle Lens", favicon; heading "Live Angle Detector" → "Angle Lens"; footer no longer mentions AI | Match app label; AI not in release | `index.html`, `App.tsx`, `public/logo.svg` |

**Not changed:** `src/geometry`, `src/measurement`, `src/vision`, `src/ar` pose maths, conventions, AI prompts.
All 71 original tests still pass unchanged.

## 3. Verified in RC1

| Check | Result | Evidence |
| --- | --- | --- |
| Unit tests | VERIFIED 76/76 (7 files; +5 bundle-guard tests) | `npm test` |
| TypeScript | VERIFIED clean | `npx tsc --noEmit` |
| Release web bundle | VERIFIED: guard passes; no API key, no Gemini client, no dev hook; no app network URLs (only XML namespace / docs strings) | `npm run build:release`; a dev build with a fake key was confirmed to FAIL the guard |
| Android release build | VERIFIED: `bundleRelease` + `assembleRelease` succeed with compileSdk/targetSdk 36 | Gradle BUILD SUCCESSFUL |
| Release manifest | VERIFIED: package `com.ingenuous.angledetector`, label "Angle Lens", versionCode 1 / 1.0.0-rc1, targetSdk 36, minSdk 23, not debuggable, `allowBackup=false`; permissions CAMERA, INTERNET (+ androidx's internal non-exported receiver permission); exported: launcher activity, androidx ProfileInstallReceiver (DUMP-protected) | `aapt2 dump badging/xmltree` |
| Adaptive icon | VERIFIED present (foreground, background, monochrome) | `mipmap-anydpi-v26` |
| Emulator acceptance (Android 16 / API 36) | VERIFIED for camera start, denial, AR Lock, drag, conventions, lock, save/share, photo import, rotation, offline, pause/resume, clean install + same-key upgrade, splash, system bars | `docs/testing/DEVICE_ACCEPTANCE_RC1.md`, `docs/testing/rc1-emulator/` |

## 4. Failed / known issues

| Issue | Severity for closed test | Notes |
| --- | --- | --- |
| Small screens: main buttons (AR Lock, Freeze & Measure, Open Photo) below the fold at 720×1280 and 360×640 CSS px | Medium | Works after scrolling. Fix needs a layout change (compact header or sticky action bar); not done here to avoid redesigning the UI |
| Landscape: readout below the fold | Low | Same cause |
| AR overlay slow to appear on the emulator's software GPU (3–7 s) | Unknown on phones | Not seen on the phone earlier; re-check on device |
| Saved image omits the 3D protractor and labels source "manual" in AR mode | Low | Pre-existing; export draws lines + label only |
| `INTERNET` permission declared but unused | Low | Kept because removing it from a Capacitor WebView app is untested; remove in RC2 after a phone test |

## 5. Untested (no evidence)

- Anything on a **physical phone** for this build (the Moto G was not connected).
- Rapid multi-touch on a real touchscreen (only the unit-level race test exists).
- Measurement reliability under glare, tilt, imperfect edges: `docs/testing/KNOWN_ANGLE_TEST_MATRIX.md` has 13 rows, none run.
- Saving into a specific gallery/Files app via the share sheet on a phone.
- Upgrade from the earlier side-loaded APK on the phone; Play-delivered install and update.
- A **signed** AAB (no upload key exists) and Play Console pre-launch report.
- Android 6–11 launch screen (layer-list path); only Android 16 was run.

## 6. Security and privacy audit

- **Gemini:** decision for the first release is **disabled**. Re-enabling needs a server-side proxy (key on the server,
  per-user rate limiting, consent screen, privacy policy and Data Safety update: camera frames would then leave the device).
- **Network:** release bundle makes no requests; the 3D model and assets load from the app's local WebView server.
- **Storage:** no localStorage/sessionStorage/IndexedDB; saved images go to the app cache, then the share sheet.
- **Camera:** requested at runtime on "Start Camera"; released in background; `uses-feature camera required=false`.
- **FileProvider:** not exported; `file_paths.xml` (Capacitor default) also grants `external-path "."`. Consider narrowing to `cache-path` only.
- **Secrets in git:** none found; keystore patterns now ignored.
- **WebView debugging:** off in release (Capacitor enables it only for debuggable builds; release is `debuggable false`).

## 7. Mitutoyo branding and asset licensing: owner decision needed before any Play upload

| Item | Finding |
| --- | --- |
| 3D model `public/models/mitutoyo-protractor.glb` | Derived from `anglefinder1.glb`, an **AI-generated** model (Hi3D) of a Mitutoyo digital protractor. Its texture shows the **"Mitutoyo" wordmark** on the dial (visible in the app and in screenshots). Source images and Hi3D's commercial-use terms are not documented in the repo |
| Trademark | "Mitutoyo" is a trademark of Mitutoyo Corporation. Showing it in the app, screenshots or listing could suggest endorsement and can trigger Play's intellectual-property / impersonation policy |
| Names in code/docs | `MitutoyoOverlay`, README and docs mention Mitutoyo (internal names are low risk; user-facing ones are not) |
| Fixture `fixtures/mitutoyo-digital-protractor/mitutoyo_center.jpg` | Render of the same generated model; not shipped in the APK |
| Open-source libraries | React, three.js, Capacitor (MIT), lucide (ISC), etc. MIT/ISC require keeping license notices; no in-app notices screen yet |

Options: (a) written permission from Mitutoyo; (b) remove/blur the wordmark in the model texture and call it a
"digital protractor" everywhere user-facing; (c) replace with an original protractor model. Recommended: (b) before the
closed test, (c) before production. Also confirm the Hi3D licence for the generated model.

## 8. Release blockers (closed test)

1. **Owner decision on the Mitutoyo wordmark / model licence** (section 7).
2. **Upload key + Play App Signing** set up by the owner; build a signed AAB (`docs/ANDROID_RELEASE.md`).
3. **Phone acceptance** of this build on the Moto G (at least rows 1–7 and 10 in `DEVICE_ACCEPTANCE_RC1.md`).
4. **Privacy policy** published at a public URL (draft: `docs/play/PRIVACY_POLICY.md`).
5. **Store assets**: 512 px icon, 1024×500 feature graphic, phone screenshots without the old heading or the wordmark (`docs/play/ASSET_REQUIREMENTS.md`).
6. **Play Console forms**: Data safety (`docs/play/DATA_SAFETY.md`), content rating, target audience, app access.

Before production (not needed for the closed test): known-angle matrix with a reference instrument, small-screen
layout fix, remove `INTERNET`, open-source notices. New personal Play developer accounts must also run a closed test
with at least 12 opted-in testers for 14 days before applying for production access (check the current rule in Play Console).

## 9. Artifacts (local, not committed; `android/.gitignore` excludes build outputs)

| File | SHA-256 | Notes |
| --- | --- | --- |
| `android/app/build/outputs/bundle/release/app-release.aab` | `aee5eeddbf0c37e4249e14ecb8b3884707121098cfea949dafcf599f764e23b1` | **Unsigned**; must be rebuilt with the upload key before Play upload |
| `android/app/build/outputs/apk/release/app-release-unsigned.apk` | `453c9cb2f95c305fd2e143134dd9f4e9aea919e3bbd665da944209ab2ba79af7` | Unsigned |
| `android/app/build/outputs/apk/release/app-release-testsigned.apk` | `c4eec0534bb41bf16a67ffae24cec075db7776d928297a5f9849f0f0430fc5b3` | Signed with the local **debug** key for side-load testing only; never upload |

Hashes are for this machine's build; they are not expected to be reproducible byte-for-byte elsewhere.
