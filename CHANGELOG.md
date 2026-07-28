# Changelog

All notable changes to Deixis are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/); versions follow [SemVer](https://semver.org/).

## [Unreleased]

### Fixed
- Undo could run backwards: a toolbar edit applied by click left its gesture open, so its older snapshot landed on the history stack after a newer one
- Returning to the page via the browser's Back button (bfcache) permanently disabled the extension in that tab — no annotate buttons and no chat attachment until a manual reload
- Blur regions drifted off the content they redact after a window resize, and generated prompts named the wrong region for each annotation
- Blur read past the edge of the canvas, darkening the rightmost and bottom blocks
- Blur did up to 16× the per-frame pixel work after the source-resolution change, lagging strokes on large images
- Releasing a key mid-drag split one toolbar slider drag into several undo steps; gestures interrupted by `pointercancel` or window blur were never closed
- Diagnostic logs emitted during startup were dropped before the logging preference finished loading, including the adapter init message the adapter guide tells authors to look for
- Annotations added while the image was still loading stayed invisible until the next edit
- With `before`/`after` button placement, the first image's button suppressed injection for every sibling image under the same parent
- Export failures were silent; they now explain that the site blocks reading the image and point to the right-click entry point, which does grant capture permission
- The toolbar icon's tooltip shipped WXT's scaffold default, "Default Popup Title"

### Changed
- Undo history is capped at 50 steps
- `SiteAdapter.getLightboxInjectionPoint()` and `getLightboxImage()` are replaced by a single optional `lightbox` object — the two were only ever valid together
- `SiteAdapter.attachToChat()` is now async and resolves once the file is genuinely attached
- Match patterns moved to an import-free module so the build config no longer pulls adapter runtime code into Node
- Releases publish to 10% of users first, and the tag/version guard accepts prerelease tags

### Removed
- `SiteAdapter.processImageUrl()` — declared and documented but never called from any code path

## [0.6.0] - 2026-07-13

### Added
- Generate an editable text prompt from the annotations (tool, color, position region, and label) via a "Generate prompt" toolbar action
- Copy now inserts the generated prompt into Gemini's chat input alongside the attached image
- Callout numbers attach to nearby shapes in the prompt so they read as references (e.g. "1. a red box around the center-left")
- Double-click a text annotation to re-edit its content in place

### Fixed
- Load the annotation image reliably on Gemini: read the image src live at click time and snapshot the page's decoded `<img>` when a direct load fails (revoked blob: URLs)
- Insert prompt text via `execCommand('insertText')` — Gemini's editor ignores synthetic paste events

## [0.5.0] - 2026-07-12

### Added
- Auto-attach annotated image directly to Gemini's chat input on Copy (hidden file input first, synthetic paste fallback; clipboard copy remains as backup)
- Edit existing text annotations: select with move tool to change font size, color, background, outline, and opacity via the toolbar
- Double-click a text annotation (move tool) to re-edit its content in place
- Font size slider (10-72px) for text annotations
- Dashed bounding box around selected text annotations
- Optional `attachToChat()` method on the `SiteAdapter` interface

### Fixed
- Undo (Ctrl+Z) now reverts property/content edits to a selected annotation instead of deleting it
- Selecting an annotation no longer overwrites the toolbar defaults used for new annotations
- Stale selection no longer mutates annotations after switching tools
- Manifest version in `wxt.config.ts` synced with `package.json` (was stuck at 0.3.2)

## [0.4.1] - 2026-07

### Changed
- Copy/Download buttons show inline "Saved" feedback instead of toast notifications

## [0.4.0] - 2026-07

### Added
- 5 quick-win annotation tools: Line, Highlight, Blur/Redact, Stamp, Callout
- Git-based versioning displayed in popup
- One-click "Reload Extension + Page" for development
- Light/Dark theme toggle in popup

## [0.3.2] - 2026-01

### Added
- Adapter Pattern architecture for multi-site support with Gemini reference implementation

### Fixed
- Anchor-locked resize and rotation offset calculations for rotated annotations
- Lightbox button positioning in flex containers
