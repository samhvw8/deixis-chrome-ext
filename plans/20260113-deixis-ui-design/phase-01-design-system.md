# Phase 01: Design System

**Status:** Complete
**Date:** 2026-01-13

---

## Overview

Established the design foundation for Deixis annotation overlay.

---

## Key Insights

### Product Context
- Chrome extension overlay on images
- Must work on any image background (light/dark/colorful)
- Non-designers as primary users
- Tool-focused, minimal distraction

### Design Direction
**Utility & Function** - Dark overlay with high contrast, compact, professional

### Style Inspirations
- Flat Design + Micro-interactions (productivity tools)
- Dark Mode (OLED) + Minimalism (developer tools)
- Glassmorphism for overlay depth

---

## Requirements

### Functional
- 5 annotation tools: Draw, Rectangle, Circle, Arrow, Text
- 8 high-visibility colors (green default)
- Undo/Clear actions
- Done/Cancel workflow
- Keyboard shortcuts

### Visual
- Works on any image background
- High contrast (WCAG AA minimum)
- Compact but usable (36px touch targets)
- Professional Chrome extension aesthetic

---

## Architecture

### Color System
| Category | Token | Value |
|----------|-------|-------|
| Surface | `--surface-primary` | `rgba(24, 24, 27, 0.95)` |
| Surface | `--surface-hover` | `rgba(39, 39, 42, 1)` |
| Surface | `--surface-active` | `rgba(63, 63, 70, 1)` |
| Border | `--border-subtle` | `rgba(63, 63, 70, 0.8)` |
| Text | `--text-primary` | `#FAFAFA` |
| Text | `--text-secondary` | `#A1A1AA` |
| Annotation | `--anno-green` | `#22C55E` (default) |

### Typography
- Font: Inter, system stack
- Sizes: 11px (tooltip), 12px (label), 13px (base)
- Weight: 400-600

### Spacing
4px grid: 4, 8, 12, 16, 24, 32px

### Animation
- Micro: 150ms
- Standard: 200ms
- Easing: `cubic-bezier(0.25, 1, 0.5, 1)`

---

## Related Files

- `/docs/design-guidelines.md` - Full specification
- `/tailwind.config.js` - Tailwind tokens
- `/entrypoints/content/styles.css` - CSS implementation

---

## Success Criteria

- [x] Color palette defined with CSS custom properties
- [x] Typography scale established
- [x] Spacing system on 4px grid
- [x] Component specifications documented
- [x] Tailwind configuration complete
- [x] Base CSS with Tailwind layers

---

## Next Steps

Proceed to Phase 02: Components
