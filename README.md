# Painter

An offline Android drawing app built with React, TypeScript, Canvas 2D, and Capacitor. Includes a project gallery, pens, RGB colors and opacity, shapes, a transparent eraser, undo/redo, pinch navigation, recoverable autosave, and PNG sharing.

## Run locally

Install Node.js 22 or newer, then:

```sh
npm ci
npm run dev
```

Open the printed localhost URL. Browser development uses IndexedDB for projects and downloads PNG files. Android uses private Filesystem storage and the native share sheet. No backend, API keys, online fonts, or account is required.

```sh
npm run build        # TypeScript checks and production bundle
npm test             # Document and recovery tests
npm run test:e2e      # Real Canvas, gestures, storage, and export in Chrome
npm run format:check # Formatting
```

The browser tests use installed Google Chrome. To install the test browser on a fresh machine, run `npx playwright install chrome` (or `--with-deps chrome` on Linux CI).

## Build an Android APK

| Tool                           | Project baseline                                     |
| ------------------------------ | ---------------------------------------------------- |
| Node.js                        | 22+; local web verification used 26.4.0              |
| npm                            | Lockfile v3; local verification used 11.17.0         |
| Capacitor core / CLI / Android | 8.5.3, locked in `package-lock.json`                 |
| JDK                            | 21, configured in `JAVA_HOME`                        |
| Android Studio                 | Otter 2025.2.1 or newer                              |
| Android SDK                    | Platform 36 and Build Tools 36.0.0                   |
| Android Gradle Plugin          | 8.13.0                                               |
| Gradle wrapper                 | 8.14.3                                               |
| Android minimum                | API 26 / Android 8.0                                 |
| Android System WebView         | Chromium 94 or newer; update WebView on older phones |
| Compile / target SDK           | API 36                                               |

These settings follow the [official Capacitor 8 upgrade guide](https://capacitorjs.com/docs/updating/8-0) and the installed Capacitor Android build configuration. This app raises Capacitor's API 24 minimum to the specification's API 26 floor. SDK compatibility is not a claim that every device/WebView combination has been tested.

Install the Android prerequisites with Android Studio's SDK Manager. Set `ANDROID_HOME` to your SDK directory, or let Android Studio write `android/local.properties` with `sdk.dir`. The diagnostic script expects `ANDROID_HOME` or `ANDROID_SDK_ROOT`. Do not commit machine-specific paths.

```powershell
npm run android:check
npm run android:sync
cd android
.\gradlew.bat assembleDebug
```

On macOS/Linux, use `./gradlew assembleDebug` (or `bash ./gradlew assembleDebug`). The debug APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`. It is debug-signed for development installations, not a production release identity.

To use Android Studio, run `npm run android:open`. Run `npm run android:sync` after every web change you want included in an APK. There is no live development server URL in the shipping configuration.

### Build on GitHub without local Android tools

1. Open the repository's **Actions** tab and select **Build APK**.
2. Click **Run workflow**, choose `main`, and click **Run workflow** again.
3. Open the completed run and download **painter-debug-apk-N** from **Artifacts**, or use the download link in the run summary.
4. Extract the ZIP and transfer `app-debug.apk` to your Android phone. Open it and allow installation from that source if Android prompts you.

The manual workflow is `.github/workflows/build-apk.yml`. It installs Java 21 and Android SDK 36, runs unit tests, builds the web app, synchronizes Capacitor, and uploads an installable debug APK for 30 days. No signing secrets or local Android setup are needed. The separate **Verify and build Android** workflow also runs browser tests on pushes and pull requests.

Fresh GitHub runners may generate different debug signing keys, so an APK may not install over an earlier test build. Uninstalling the old app removes its local drawings; export anything you want to keep first. Use a stable production signing identity for releases and reliable updates. These workflows have not been executed in this local environment.

### Signed release

The provisional application ID is `com.androidpainter.app`. Finalize this and your signing-key ownership before distributing the first production release. Keep the same signing identity for updates.

Create or select your production keystore using Android Studio's **Generate Signed Bundle / APK** flow. Alternatively, the Gradle release configuration reads these environment variables:

- `PAINTER_KEYSTORE`: absolute path to your keystore.
- `PAINTER_STORE_PASSWORD`: keystore password.
- `PAINTER_KEY_ALIAS`: key alias.
- `PAINTER_KEY_PASSWORD`: signing-key password.

Set secrets securely in your shell or CI secret store, then run `gradlew.bat assembleRelease` for an APK or `gradlew.bat bundleRelease` for a Play bundle. Without these variables Gradle creates an **unsigned** release artifact. Never commit signing files or passwords. No production key has been created for you.

## Drawing and storage

- Tap for a dot, drag to draw, or choose a geometric shape and drag its bounding box.
- Two fingers pan and zoom; the second finger cancels the uncommitted stroke. Fit to screen resets the viewport.
- Shapes support outline, fill, both, and a square/circle constraint. Committed objects are not individually editable.
- Erasing removes ink rather than painting white. Canvas backgrounds remain fixed.
- The color panel exposes the platform RGB picker, six-digit HEX, opacity, separate fill color, swatches, and recent colors.
- Saves occur after 750 ms of inactivity, with a 5-second maximum interval during completed edits. Backgrounding and normal exit also attempt a save.
- Each project has a primary file, a previous valid backup, and a staged-write file. The gallery is reconstructed from these files; thumbnails are optional caches.
- Private projects survive restarts and normal app upgrades. Uninstalling or clearing app data removes them. Automatic Android cloud backup is disabled; PNG sharing preserves the picture, not editable history.
- Canvas dimensions range from 256 to 2048 pixels per side. Limits are 5,000 operations, 250,000 retained points, and 20 MiB of document JSON. A limit failure cancels the new operation and preserves existing work.

Native sharing exposes only the `exports/` cache directory through FileProvider. Export files older than 24 hours are cleaned on subsequent launches. The app requests no storage/photo permissions. The standard Capacitor Internet manifest permission remains, but the app does not make application network requests.

## Code map

- `src/app/App.tsx`: gallery, editor controls, autosave scheduling, lifecycle, and project actions.
- `src/drawing/model.ts`: versioned document format, geometry, and validation.
- `src/drawing/renderer.ts`: shared editor/export rendering and opacity masks.
- `src/drawing/Canvas.tsx`: imperative canvas rendering and pointer gestures outside React's per-move state updates.
- `src/storage/projects.ts`: serialized, verified writes and recovery; native and IndexedDB adapters.
- `src/platform/share.ts`: PNG encoding and native/browser export.
- `android/`: generated native project with SDK, signing, backup, and FileProvider configuration.
- `tests/` and `e2e/`: logic/recovery and real-browser integration tests.

See [SPEC.md](SPEC.md) for the product specification and [VALIDATION.md](VALIDATION.md) for verified behavior, remaining device checks, and implementation limitations.
