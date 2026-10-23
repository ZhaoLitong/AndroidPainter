# Android Painter — Project Specification

Status: proposed implementation baseline  
Platform: Android APK built with Capacitor  
Application language: TypeScript  
Rendering: HTML Canvas 2D  
Date: 2026-10-23

## 1. Purpose

Build an offline Android drawing app that lets users draw with a finger, choose any standard RGB color, adjust pen sizes, create basic geometric shapes, erase content, and save or share their work.

The initial release prioritizes predictable tools, responsive input, and reliable local saving. It is a drawing app for casual use, not a professional painting suite.

## 2. Scope

### Included in the initial release

- Single-layer drawings on a fixed-size canvas.
- Tap-to-dot and drag-to-draw pen input.
- Full RGB color picker, HEX entry, transparency, and recent colors.
- Adjustable pen and eraser sizes.
- Line, rectangle, ellipse, and triangle tools.
- Outline, fill, and outline-plus-fill options for closed shapes.
- Eraser that removes drawing pixels while preserving the document background.
- Undo, redo, and undoable clear.
- Two-finger canvas pan and zoom, plus a fit-to-screen action.
- Local project gallery, naming, autosave, and reopening.
- PNG export to Android's share sheet.
- Offline use without accounts or a backend.

### Deferred

- Layers, flood fill, gradients, textured brushes, and pressure-sensitive strokes.
- Selecting, moving, resizing, or recoloring committed strokes and shapes.
- Image import, tracing, text, animation, and infinite canvases.
- Cloud backup, collaboration, accounts, subscriptions, and analytics.
- Direct publishing to social platforms and dedicated gallery export.
- JPEG, SVG, and editable project-file exchange.
- iOS distribution. Browser execution is a development convenience, not an initial supported product.

## 3. Technology and Android compatibility

### Stack

- React with TypeScript and Vite for application UI and bundling.
- Capacitor for the Android container and native integration.
- Canvas 2D for drawing; Pointer Events for input; `requestAnimationFrame` for display updates.
- Capacitor Filesystem for private project storage and temporary export files.
- Capacitor Share for Android sharing.
- Capacitor App for lifecycle and Android back-button handling.
- Strict TypeScript checking, a lockfile, and reproducible build scripts.

Drawing input and rendering must not depend on React rerendering for every pointer move. React manages tool controls and document state summaries; the drawing controller manages high-frequency input.

### Version selection

At project initialization, select a maintained stable Capacitor major and compatible plugin versions. Record exact versions of Capacitor, Node.js, JDK, Gradle, Android Gradle Plugin, and Android SDK in the setup documentation. Verify requirements against that Capacitor release's official documentation before committing the build configuration.

Proposed product support floor: Android 8.0 / API 26. The actual `minSdk` is the greater of API 26 and the selected Capacitor/plugin requirements. If this raises the product support floor, document the change before implementation proceeds. Do not lower framework requirements to claim broader compatibility.

- `minSdk` controls installation eligibility.
- `compileSdk` must satisfy the selected Capacitor and plugin requirements.
- `targetSdk` must satisfy those requirements and the applicable Google Play requirement if publishing there.
- APK recipients do not need an Android SDK or developer tools installed.
- Supported devices must provide a compatible Android System WebView. Test actual WebView versions and record them in release validation.
- Detect required canvas and input APIs at startup and show a clear compatibility message if unavailable. Advanced optional APIs, such as coalesced pointer events, must have fallbacks.

Deliver a signed release APK for direct installation. Produce an Android App Bundle separately if Google Play distribution becomes required. Keep signing credentials outside source control and preserve the signing identity for app updates.

## 4. User journeys and interface

### Project gallery

- Show saved projects with name, thumbnail, and last-modified date, newest first.
- Create, open, rename, and delete projects.
- Confirm project deletion; explain that deletion is permanent.
- Use an empty-state action to create the first drawing.
- Show a useful storage or recovery error instead of silently hiding an unreadable project.

### New project

- Default name: `Untitled drawing`, with a suffix when necessary.
- Default canvas: 1080 × 1440 document pixels, white background.
- Also offer 1024 × 1024 and 1440 × 1080 presets.
- Allow custom integer dimensions from 256 to 2048 pixels per side, with a maximum of 4,194,304 total pixels.
- Choose a solid RGB background or transparency at creation. Background and dimensions remain fixed for that document in the initial release.

### Drawing workspace

- Top controls: project name, save status, undo, redo, and an overflow menu.
- Main area: canvas surrounded by a visually distinct workspace. Show a checkerboard behind transparent canvas areas.
- Bottom controls: tool selection, current color, and size; open secondary controls in sheets or panels.
- Overflow actions: fit canvas, clear canvas, share PNG, and return to gallery.
- Preserve the drawing and selected tool across orientation changes. Restore a usable viewport after resizing.
- Display `Saving`, `Saved`, and `Save failed` states. Never show `Saved` before persistence succeeds.
- Android Back dismisses an open panel first, then returns from the editor to the gallery after saving. If saving fails, offer retry or an explicit exit-without-saving choice.

## 5. Drawing behavior

### Coordinates and input

- Store geometry in document pixels, independent of screen density, orientation, and zoom.
- Convert pointer coordinates through the inverse viewport transform before drawing.
- One pointer draws with the selected tool; capture it until completion or cancellation.
- Clip rendered content to canvas bounds. Starting outside the canvas must not create an operation; a stroke that leaves and reenters remains clipped without connecting unrelated gestures.
- Disable browser scrolling, text selection, and default touch handling over the drawing surface. Keep normal interaction in tool panels.
- Treat `pointercancel`, focus loss, and app interruption as cancellation of the active preview; never leave the controller in a drawing state.
- Accept ordinary stylus input as a fixed-width pointer. Pressure and palm rejection are not promised in the initial release.

### Pen

- Default: opaque black, 8 document pixels wide.
- Width range: 1–128 document pixels, controlled by a slider with a numeric value.
- A tap produces a round dot at the selected width.
- Dragging produces a continuous stroke with round caps and joins.
- Apply deterministic smoothing and point simplification without visibly changing intended corners or creating gaps during fast movement.
- Capture tool settings when a stroke begins; later settings changes affect only subsequent operations.

### Color

- Support all 24-bit sRGB color values and an opacity range of 0–100%.
- Provide hue and saturation/value controls, a color preview, six-digit HEX input, and an opacity slider.
- Accept HEX with or without `#`, normalize valid values, and keep the previous valid color when input is invalid.
- Provide common color swatches and the 12 most recently used distinct color/opacity combinations.
- Outline and fill colors are independently configurable for closed shapes.
- Apply opacity once per complete stroke or shape. Input sampling density and overlapping segments within one stroke must not darken it unexpectedly; separate strokes may overlap and darken normally.
- Color availability does not promise calibrated or wide-gamut output on every display.

### Shapes

- Line: drag from the first endpoint to the second.
- Rectangle and ellipse: drag between opposite corners of a bounding box.
- Triangle: an isosceles triangle inscribed in the dragged bounding box, apex at its top-center and base along its bottom edge.
- Support dragging in any direction by normalizing the bounding box.
- Show a live preview; commit one operation when the pointer is released.
- Closed shapes support outline, fill, or both. Outline width uses the pen width range.
- A constraint toggle creates squares or circles from rectangle or ellipse tools. It uses the larger absolute drag dimension for both axes while preserving drag direction.
- Cancel shape gestures smaller than 2 screen pixels; a tap with a shape tool does not create a dot.
- Committed shapes cannot be selected or transformed in this release; users undo and redraw them.

### Eraser

- Width range: 1–256 document pixels; round caps and joins; a tap erases a dot.
- Erase drawing content using destination-out compositing or equivalent mask semantics.
- Erase strokes and shapes consistently. Erasing reveals the fixed background or transparency; it never paints a background-colored stroke.
- Default to full-strength erasing, with no eraser-opacity setting in this release.
- One continuous eraser gesture is one undoable operation.

### Pan and zoom

- Two pointers pan and pinch-zoom the viewport, from 25% to 800% of the fit-to-screen scale.
- If a second pointer arrives during a drawing gesture, cancel that uncommitted gesture and begin viewport navigation.
- Once navigation starts, suppress drawing until all pointers are lifted.
- Zoom around the gesture midpoint and keep some canvas reachable when panning.
- Pan and zoom never modify drawing geometry or create history entries.
- Fit-to-screen resets navigation without changing artwork.

### Undo, redo, and clear

- Record one history entry per completed stroke, eraser gesture, shape, or clear action.
- Undo reverses the most recent active operation; redo reapplies it.
- A new drawing operation after undo discards the redo branch.
- Clear requires confirmation and is undoable; it removes drawing content, not the document background.
- Color, size, tool, and viewport changes do not enter drawing history.
- Retain all document operations during a session within the resource limits below; do not silently discard undo entries.
- Save the active operation sequence only. After reopening, saved operations remain undoable, but the previous session's redo branch is not restored.

## 6. Rendering architecture

Separate the implementation into UI, input/gesture controller, document/history model, renderer, persistence service, and native export adapter.

- The operation model is the source of truth; displayed bitmaps are derived caches.
- Render at document resolution into a transparent content surface and display it through a viewport transform.
- Keep background rendering separate from content so erasing behaves correctly.
- Preview the active operation without repeatedly rebuilding the entire saved drawing.
- For eraser previews, composite against content correctly; an isolated transparent overlay cannot erase an underlying canvas.
- A full-resolution working surface may hold the committed content plus the current preview. Use transparent masks or temporary surfaces as needed to apply stroke opacity once.
- Bound temporary surfaces and rendering checkpoints by an explicit memory budget. Evict caches without losing vector operations.
- Undo/redo may rebuild from a compatible checkpoint and replay subsequent operations. Clear and eraser operations must replay in order.
- Cache keys must include document revision and renderer version; never display a cache from an abandoned redo branch.
- Export uses the same operation renderer and compositing rules as the editor, without viewport scaling or UI overlays.
- Avoid unbounded point arrays, full-document bitmap snapshots per history entry, and allocations on every pointer event.

Initial project structure:

```text
src/
  app/                 application setup and navigation
  components/          shared UI controls
  features/gallery/    saved-project browsing
  features/editor/     editor UI and tool controls
  drawing/             geometry, input, renderer, history, document types
  storage/             project persistence and migrations
  platform/            Capacitor adapters and browser development adapters
  styles/              application styles and design tokens
android/               generated and maintained Capacitor Android project
tests/                 unit, integration, and end-to-end tests
```

## 7. Document model and persistence

### Editable document format

Use versioned JSON with these logical fields:

| Field                                | Purpose                                                     |
| ------------------------------------ | ----------------------------------------------------------- |
| `schemaVersion`                      | File-format migration version                               |
| `rendererVersion`                    | Geometry interpretation and smoothing version               |
| `id`, `name`                         | Stable identifier and display name                          |
| `createdAt`, `updatedAt`, `revision` | Timestamps and monotonic document revision                  |
| `width`, `height`, `background`      | Document dimensions and solid RGB or transparent background |
| `operations`                         | Ordered, active drawing operations                          |

Each operation has an ID and a discriminated type: pen, eraser, line, rectangle, ellipse, triangle, or clear. Store the relevant geometry and captured style. Pen and eraser operations store simplified document-space points; shapes store normalized geometry. Store opacity explicitly. Never persist device-dependent screen coordinates.

Validate dimensions, numeric finiteness, operation types, point counts, color values, and schema versions before rendering loaded data. A newer unsupported schema must produce an explanatory error and must not be overwritten.

### Storage and recovery

- Store editable documents and thumbnails in app-private persistent storage using Capacitor Filesystem.
- Use stable project IDs for filenames; names are display metadata, not paths.
- Save after 750 ms without a committed change, with a maximum interval of 5 seconds during continuous completed edits.
- Queue saves by document and revision. An older save completion must never overwrite a newer revision or mark it saved.
- Attempt a flush when backgrounding and before normal editor exit. Do not rely on lifecycle callbacks alone for persistence.
- Use staged writes and retain a previous known-good revision. Verify the staged data before promotion; design startup recovery for interruption at every step instead of assuming every filesystem operation is atomic.
- On launch, load the latest valid saved revision and recover the previous valid revision if the latest is unreadable. Inform the user when recovery loses recent changes.
- Keep gallery metadata reconstructible from valid project files. Thumbnail failures must not invalidate a drawing.
- Keep the last valid save on write failure, retain unsaved work in memory, and show retry instructions. Do not report export or save success on failure.
- An abrupt process kill may lose changes since the last successful autosave; completed saves must remain readable.
- Store tool preferences separately from project content.
- Projects survive normal app restarts and app updates with the same application identity. Clearing app data or uninstalling removes private projects; disclose this in the app's storage/help information.

## 8. Export, sharing, and permissions

- Export PNG at the exact document dimensions, including the solid background or preserving transparency as configured.
- Exclude checkerboards, canvas borders, selection previews, and other editor UI.
- Export the latest committed in-memory revision even if an autosave is pending.
- Encode through a Blob-based flow where available to avoid unnecessary base64 copies. Adapt to the selected native plugin's supported file-writing interface.
- Create an export file in private cache and invoke Android's share sheet with a supported content URI and `image/png` MIME type.
- Validate the selected plugins' URI and file-sharing configuration on a physical Android device.
- Do not request broad storage, photo-library, camera, location, microphone, or contact permissions for the initial feature set.
- Sharing is initiated by the user. Opening the share sheet does not mean the recipient saved or received the image.
- Handle cancellation without showing an error. Clean old temporary exports on later launches, allowing time for recipient apps to read them.
- Do not include user artwork or document contents in diagnostic logs.

## 9. Resource limits and performance

These are engineering targets to validate in the first rendering prototype, not measured guarantees.

- Reference device: physical Android phone with 3–4 GB RAM and a 60 Hz display. Record its exact model, OS, and WebView version.
- Typical workload: default canvas, 500 operations, and up to 50,000 retained points.
- Target smooth drawing near 60 frames per second, with 95th-percentile input-to-visible-feedback latency below 50 ms on the reference device. Measure real-device feedback using frame instrumentation or high-speed video; event-to-render timings alone do not measure display latency.
- Typical gallery-to-editable-project load: under 2 seconds for the typical workload.
- Typical undo/redo response: under 250 ms for the typical workload.
- Target total app memory below 200 MiB for the typical workload, measured with Android profiling tools. Measure peak memory separately during export and replay.
- Limit rendering surfaces/checkpoints to an approximate 64 MiB raw-pixel budget. A 2048 × 2048 RGBA surface alone requires 16 MiB, before browser overhead.
- Initial document caps: 5,000 active operations, 250,000 retained points, and 20 MiB serialized editable data. Enforce limits before committing or saving an operation. Include the redo branch in the in-memory budget.
- If the current gesture exceeds a limit, cancel its preview and explain the limit. Do not partially commit it or silently delete previous work. Continue to allow export, undo, and opening another project.
- Tune these limits from device measurements and document any changes. Larger documents must never cause an intentional unbounded allocation.

## 10. Accessibility and usability

- Use touch targets at least 48 × 48 CSS pixels in the default mobile layout.
- Provide accessible labels and selected/disabled state for all controls; expose save and error status to TalkBack.
- Do not communicate selected tools or errors using color alone.
- Maintain readable contrast and support larger system text without hiding essential actions.
- Offer numeric color and size values alongside visual pickers.
- Respect Android safe areas and system navigation insets in both orientations.
- Provide a descriptive accessible label for the drawing canvas. Nonvisual freehand drawing is outside the initial accessibility scope; navigation, project management, and tool settings must remain accessible.

## 11. Verification and acceptance criteria

Use unit tests for document/history logic, coordinate transforms, validation, and geometry. Use browser integration tests for interaction and renderer behavior, plus Android device tests for WebView input, lifecycle, filesystem, and native sharing. Prefer pixel sampling or tolerance-based visual comparison over byte-identical PNG assertions across WebView versions.

| ID  | Acceptance criterion                                                                                                                                                                         |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A01 | Release APK installs and launches on the selected minimum Android version and the latest stable Android version tested for release.                                                          |
| A02 | After installation, airplane mode permits creating, editing, autosaving, reopening, and locally generating PNG exports. External share destinations may have their own network requirements. |
| A03 | A pen tap creates one round dot; fast drags produce continuous strokes; each gesture has one undo entry.                                                                                     |
| A04 | HEX, picker, opacity, and width changes produce the expected next stroke; zoom does not change stored width or geometry.                                                                     |
| A05 | All shapes preview and commit correctly in every drag direction; constraint mode produces squares/circles.                                                                                   |
| A06 | Erasing across pen strokes and shapes reveals the background or transparency, and undo restores the previous content.                                                                        |
| A07 | Semitransparent strokes do not become darker merely because more input points were sampled; separate overlapping strokes composite normally.                                                 |
| A08 | Undo/redo works across drawing, shapes, erasing, and clear. Drawing after undo invalidates redo. Reopening preserves active operations and their undoability.                                |
| A09 | Adding a second pointer cancels the uncommitted drawing, starts navigation, and leaves no accidental mark. Drawing resumes only after all pointers lift.                                     |
| A10 | Fit, zoom, pan, and rotation preserve artwork; drawing at a transformed viewport maps to the correct document position.                                                                      |
| A11 | A successfully saved project survives force-stop and restart. Interrupted or failed saves leave a recoverable known-good revision.                                                           |
| A12 | Invalid, corrupt, or newer-version files show useful errors without overwriting source data. Gallery metadata can be rebuilt.                                                                |
| A13 | Shared PNG has correct dimensions, colors, alpha, and current committed content; a recipient app can open its URI.                                                                           |
| A14 | Save failure, disk-full conditions, and document limits produce actionable UI; the last saved project remains usable.                                                                        |
| A15 | The typical workload meets measured performance targets or any accepted target adjustment is recorded before release.                                                                        |
| A16 | Toolbar controls work with TalkBack and enlarged text, and the app requests no unnecessary runtime permissions.                                                                              |

Release validation must include an emulator at the minimum supported API, a current-API emulator, and at least one physical budget/midrange phone. Record tested APK, device, OS, WebView, results, and unresolved limitations. Include cold start, orientation changes, background/resume, process death, rapid input, storage failures, and repeated export.

## 12. Implementation milestones

1. **Compatibility and rendering prototype:** initialize the stack, record build versions, produce an installable APK, demonstrate drawing and true erasing, and measure input/memory on the reference phone. Resolve any support-floor conflict here.
2. **Drawing model and tools:** implement coordinates, history, deterministic rendering, colors, widths, shapes, pan/zoom, and transparent backgrounds. Satisfy A03–A10.
3. **Persistence and sharing:** add gallery, autosave, recovery, validation, thumbnails, and native PNG sharing. Satisfy A02 and A11–A14.
4. **Release hardening:** finish accessibility, resource-limit handling, physical-device performance, lifecycle checks, signing documentation, and acceptance verification. Satisfy all remaining criteria.

Planning estimate for one developer experienced with TypeScript and Capacitor: approximately 4–6 weeks for the functional scope and 6–10 weeks for a tested initial release. Re-estimate after the rendering prototype; multi-touch, memory behavior, and recovery are the largest uncertainties.

## 13. Definition of done

- Source code, dependency lockfile, Android project, and build scripts are committed.
- Setup instructions identify exact prerequisites and development, test, APK build, and signing steps.
- Type checking, required automated tests, and production web/Android builds pass.
- Acceptance results and the Android/WebView support matrix are documented.
- A signed release APK is available; credentials and signing keys are excluded from the repository.
- No unresolved defect causes known artwork loss, incorrect erasing, unusable drawing input, or invalid exported images within supported limits.
- User-facing help explains controls, local-only storage, uninstall behavior, and supported limits.

## 14. Decisions to finalize during implementation

The defaults above allow implementation to start. Before release, finalize application ID, display name/icon, signing-key ownership, distribution channel, and the physical reference device. Capacitor/toolchain versions and the effective minimum Android version must be finalized in milestone 1. No backend or recurring service is required by this specification.
