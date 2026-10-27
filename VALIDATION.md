# Validation and release status

This is an implemented development version, not a device-certified production release.

## Completed local verification

- Strict TypeScript compilation and production Vite build.
- Capacitor Android project generation and plugin/assets synchronization.
- Eleven unit tests: HEX normalization, constrained geometry, document validation, point budgets, immutable revisions, serialized/stale saves, failed promotions, corrupt-primary recovery, staged first-save recovery, future-version protection, and deletion.
- Four Chrome integration tests: create/draw/undo/redo/erase/autosave/reopen/PNG export; shapes/clear/rename/delete; per-stroke alpha and transparent erasing; second-pointer cancellation.
- Mobile gallery/editor screenshots inspected at 390 × 844 CSS pixels; no horizontal overflow in the editor.
- Runtime dependency audit: zero reported vulnerabilities. The patched Vitest 5.0.5 test runner removes the initial critical development-tool advisories. Three moderate development-only advisories remain in Capacitor CLI's `xcode` → `uuid` dependency chain; iOS project generation is not used by this Android app.

## Android build status

The local machine has Java 17, not the required Java 21, and no configured Android SDK 36. Native compilation, APK installation, and physical-device checks have not been performed. No signed release APK is included. Run the commands in README.md on a machine with the documented prerequisites, or execute the included GitHub Actions workflow for a debug artifact.

The SDK support floor is configured at API 26, with Chromium-based Android System WebView 55 or newer. This is compatibility configuration, not evidence of testing on Android 8.0. The project targets and compiles with API 36. No distribution or Google Play submission has occurred.

## Required before release

| Area           | Required verification                                                                               |
| -------------- | --------------------------------------------------------------------------------------------------- |
| Native build   | Compile debug/release with JDK 21 and SDK 36; inspect merged manifest and signing                   |
| Compatibility  | API 26 emulator, current Android emulator, physical budget/midrange phone; record WebView versions  |
| Native storage | Process death, app update, disk-full failures, staged-write interruption, backup recovery           |
| Native sharing | Open PNG in recipient apps, alpha/dimensions, cancellation, cache URI access                        |
| Lifecycle      | Android Back, background/resume, rotation, gesture interruption                                     |
| Accessibility  | TalkBack, large system text, landscape layouts, safe areas, control target sizes                    |
| Performance    | 500 operations / 50,000 points; real input-to-display latency, replay time, memory and export peaks |
| Distribution   | Final app ID/name/icon, production signing identity, install/update test, release notes             |

## Known implementation tradeoffs

- Current undo/redo replays the operation list; incremental commits avoid replaying older operations. No checkpoint cache is implemented yet. The specification's replay and latency targets require real-device measurement.
- The renderer maintains three document-resolution working surfaces and caps the viewport at four million pixels. Editor exports and thumbnails reuse a working surface, keeping explicit pixel surfaces near the 64 MiB budget at maximum dimensions. Browser/encoder overhead is additional; total peak memory still requires device measurement.
- The platform's native color input supplies its RGB color picker. HEX and opacity controls are implemented; a custom cross-device HSV panel is not included.
- Pen smoothing filters nearby points and uses quadratic curves. Advanced simplification, brush pressure, and palm rejection are not implemented.
- Viewport rendering uses CSS-pixel resolution to constrain memory; high-density screens may show softer edges while exported PNGs use full document resolution.
- Save validation serializes the current document. Very large histories may block the UI briefly; the resource caps are enforced, but performance is not yet calibrated on a physical phone.
- Temporary export cancellation is detected using the native plugin's cancellation error message and needs device verification.
- The gallery shows recoverable file errors. Unsupported future schemas are preserved and cannot be saved over by this version.
- Tool preferences and recent colors persist; eraser size resets to its default between app sessions.
