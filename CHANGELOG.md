# Changelog

All notable changes to Deixis are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/); versions follow [SemVer](https://semver.org/).

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
