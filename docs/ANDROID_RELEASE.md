# Android release build (Angle Lens)

Package `com.ingenuous.angledetector` · label **Angle Lens** · compile/target SDK **36** · min SDK 23.
Version is set in `android/app/build.gradle` (`versionCode`, `versionName`). **Increase `versionCode` for every Play upload.**

## Toolchain

- Node 20+ and npm
- JDK 21 (`JAVA_HOME`)
- Android SDK: `platform-tools`, `platforms;android-36`, `build-tools;36.0.0`
- Gradle 8.11.1 (wrapper) with Android Gradle Plugin 8.10.1, Capacitor 7.6

## Reproducible build

```bash
npm ci
npm test
npm run lint
npm run android:sync          # vite build + release bundle check + cap sync android
cd android
./gradlew clean bundleRelease assembleRelease
```

`npm run build:release` fails if the web bundle contains a Google API key, the Gemini client or
endpoint, or the `?photo=` developer hook (`scripts/check-release-bundle.mjs`).

Outputs:

| File | Use |
| --- | --- |
| `android/app/build/outputs/bundle/release/app-release.aab` | Upload to Google Play (must be signed with the upload key) |
| `android/app/build/outputs/apk/release/app-release-unsigned.apk` (or `app-release.apk` when signed) | Side-load testing |

On Windows, if Gradle fails with "Unable to establish loopback connection", set `TEMP`/`TMP`
and `JAVA_TOOL_OPTIONS=-Djdk.net.unixdomain.tmpdir=<short dir> -Djava.io.tmpdir=<short dir>` to a short local folder.

## Signing (owner only)

No key is in the repository, and none has been created. Release builds are **unsigned** until the
owner provides one. Google Play App Signing is recommended: Google holds the app signing key and
you sign uploads with a separate **upload key**.

1. The owner creates an upload key, kept outside the repo and backed up:
   ```bash
   keytool -genkeypair -v -keystore angle-lens-upload.jks -alias upload -keyalg RSA -keysize 4096 -validity 10000
   ```
2. Point the build at it with either `android/keystore.properties` (git-ignored):
   ```properties
   storeFile=C:/secure/angle-lens-upload.jks
   storePassword=...
   keyAlias=upload
   keyPassword=...
   ```
   or environment variables `ANGLE_LENS_KEYSTORE`, `ANGLE_LENS_KEYSTORE_PASSWORD`,
   `ANGLE_LENS_KEY_ALIAS`, `ANGLE_LENS_KEY_PASSWORD` (for CI secrets).
3. `./gradlew bundleRelease` then produces a signed `app-release.aab`.
4. Check the signature: `jarsigner -verify -verbose -certs app-release.aab`.

`.jks`, `.keystore`, `.p12`, `.pem` and `keystore.properties` are git-ignored. Never commit them,
paste passwords into issues/PRs, or share the upload key.

## Install and upgrade notes

- A Play-installed build and a side-loaded debug build are signed with different keys. Android refuses
  to upgrade one with the other; uninstall first (this deletes nothing important: the app stores no data).
- Upgrades between builds signed with the same key keep the app installed; bump `versionCode` each time.

## What release builds exclude

- **AI assist (Gemini):** compiled out (`__AI_ASSIST__` is only true in `npm run dev` with a key).
  No key, client library or endpoint is in the bundle.
- **`?photo=<url>&ar=1` developer hook:** compiled out (`__DEV_TOOLS__`).
- **WebView remote debugging:** Capacitor enables it only for debuggable builds; release is `debuggable false`.
