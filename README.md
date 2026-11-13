<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1-rgPJ1jmuMAlgFtp5vpFxPEEEG054Oiw

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## AR Lock (Mitutoyo protractor overlay)

On the live camera a faint 3D Mitutoyo digital protractor sits at the crosshair. Aim the bend at the crosshair and tap **AR Lock**: the frame freezes with the vertex on the crosshair and both arms pre-placed; drag each arm handle onto its edge. The 3D protractor follows (arm and blade along the two edges, LCD showing the reading) and turns solid with `HOLD` when you lock.

- The reading comes only from `measureFromPoints` on the points you place (2D apparent angle). The 3D model is presentation only; it never computes or changes a value. No calibration or accuracy claim.
- It is drawn over the frozen camera image (not world-tracked AR).
- Model: `public/models/mitutoyo-protractor.glb`, generated from the Hi3D scan by `node scripts/prepare-mitutoyo-model.mjs "<source .glb>"` (simplifies, splits the blade off the body, fits the pivot; writes `src/ar/mitutoyoRig.json`).
- Test without a camera: `http://localhost:3000/?photo=/fixtures/mitutoyo-digital-protractor/mitutoyo_center.jpg&ar=1`

## Android APK (Capacitor)

Toolchain: Node 20+, **JDK 21**, Android SDK (`platform-tools`, `platforms;android-35`, `build-tools;35.0.0`).

```bash
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug   # -> android/app/build/outputs/apk/debug/app-debug.apk
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

On Windows, if Gradle fails with "Unable to establish loopback connection", point `TEMP`/`TMP` and `JAVA_TOOL_OPTIONS=-Djdk.net.unixdomain.tmpdir=<short dir>` at a short local folder.
