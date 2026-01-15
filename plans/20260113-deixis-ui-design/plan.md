# Deixis UI/UX Design Plan

> Chrome Extension for Visual Annotation in Gemini Chat

**Created:** 2026-01-13
**Status:** In Progress

---

## Overview

Design system and React component library for the Deixis annotation toolbar overlay.

### Phases

| Phase | Status | Description |
|-------|--------|-------------|
| [Phase 01: Design System](/Users/samhv/workspace/Deixis/plans/20260113-deixis-ui-design/phase-01-design-system.md) | Complete | Color palette, typography, spacing, tokens |
| [Phase 02: Components](/Users/samhv/workspace/Deixis/plans/20260113-deixis-ui-design/phase-02-components.md) | Complete | React components with Tailwind CSS |
| [Phase 03: Integration](/Users/samhv/workspace/Deixis/plans/20260113-deixis-ui-design/phase-03-integration.md) | Pending | Content script integration |

---

## Key Deliverables

1. `/docs/design-guidelines.md` - Complete design system documentation
2. `/entrypoints/content/components/` - React component library
3. `/entrypoints/content/icons/` - SVG icon set
4. `/entrypoints/content/styles.css` - Tailwind CSS with custom tokens

---

## Design Decisions

### Direction: Utility & Function
Dark overlay with high contrast. Compact, professional Chrome extension aesthetic.

### Color Strategy
- Dark translucent surface (`rgba(24, 24, 27, 0.95)`)
- High-visibility annotation colors (green default)
- Works on any image background

### Component Architecture
- Modular, composable components
- Full keyboard accessibility
- Tooltip support for icon-only buttons
- Responsive animation with reduced-motion support

---

## Next Steps

1. Integrate toolbar into content script
2. Implement canvas annotation layer
3. Add context menu entry point
4. Test on Gemini lightbox
