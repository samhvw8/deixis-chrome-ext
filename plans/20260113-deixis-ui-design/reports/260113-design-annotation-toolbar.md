# Design Report: Deixis Annotation Toolbar UI/UX

**Date:** 2026-01-13
**Author:** UI/UX Designer
**Version:** 1.0

---

## Executive Summary

Designed and implemented a complete UI/UX system for Deixis, a Chrome extension for visual annotation in Gemini Chat. The design focuses on utility and function with a dark overlay aesthetic that works on any image background.

---

## Design Decisions

### 1. Design Direction: Utility & Function

**Rationale:** Annotation tools need to be unobtrusive yet instantly accessible. Users are focused on their images, not the tool interface. A dark, compact toolbar provides high contrast visibility without competing for attention.

**Alternatives considered:**
- Glassmorphism (too performance-heavy, contrast issues)
- Neubrutalism (too playful for productivity tool)
- Light theme (poor visibility on light images)

### 2. Color Strategy

**Primary surface:** `rgba(24, 24, 27, 0.95)` - Near-opaque dark zinc
- 95% opacity provides solid backdrop with subtle transparency
- Zinc base (not pure black) feels less harsh
- Backdrop blur adds premium depth

**Annotation colors:** High saturation for visibility
- Default green (#22C55E) - High visibility on most images
- 8 color options covering the spectrum
- White option for dark images

### 3. Component Architecture

**Modular approach:**
- Each component is self-contained
- Composable for different layouts
- Type-safe with full TypeScript

**Accessibility first:**
- All buttons have ARIA labels
- Keyboard navigation throughout
- Focus visible states
- Reduced motion support

### 4. Interaction Design

**Tooltip delay:** 500ms
- Long enough to not trigger on accidental hover
- Short enough to be helpful for exploration

**Animation timing:**
- 150ms for micro-interactions (instant feel)
- 200ms for larger transitions (smooth)
- Easing: `cubic-bezier(0.25, 1, 0.5, 1)` (natural deceleration)

---

## Component Specifications

### Toolbar Layout

```
[Draw][Rect][Circle][Arrow][Text] | [Color] | [Undo][Clear] | [Cancel][Done]
```

**Dimensions:**
- Tool buttons: 36x36px (with 32x32 icon area)
- Color picker: 36x36px trigger
- Action buttons: Auto-width with padding

### ToolButton States

| State | Background | Border | Icon |
|-------|------------|--------|------|
| Default | transparent | none | #A1A1AA |
| Hover | #27272A | none | #FAFAFA |
| Active | #3F3F46 | 1px #52525B | #FAFAFA |
| Disabled | transparent | none | #71717A |

### Color Picker

**Trigger:** 24px color swatch with chevron indicator
**Dropdown:** 4x2 grid, 20px swatches, 4px gaps
**Selected indicator:** White ring with shadow

### Toast

**Position:** Bottom-center, 16px from edge
**Animation:** Slide up + fade (200ms)
**Auto-dismiss:** 3 seconds
**Types:** Success (green accent), Error (red accent), Info (neutral)

---

## File Structure

```
/Users/samhv/workspace/Deixis/
├── docs/
│   └── design-guidelines.md       # Complete design system
├── plans/
│   └── 20260113-deixis-ui-design/
│       ├── plan.md                # Overview
│       ├── phase-01-design-system.md
│       ├── phase-02-components.md
│       └── phase-03-integration.md
├── entrypoints/
│   └── content/
│       ├── styles.css             # Tailwind + custom CSS
│       ├── components/
│       │   ├── index.ts           # Exports
│       │   ├── ToolButton.tsx
│       │   ├── ColorPicker.tsx
│       │   ├── Toast.tsx
│       │   ├── Divider.tsx
│       │   └── AnnotationToolbar.tsx
│       └── icons/
│           └── index.tsx          # SVG icons
├── tailwind.config.js
└── postcss.config.js
```

---

## Accessibility Compliance

| Criterion | Status | Notes |
|-----------|--------|-------|
| Color contrast (4.5:1) | Pass | Text #FAFAFA on #18181B = 15.3:1 |
| Keyboard navigation | Pass | Tab, Enter, Space, shortcuts |
| Focus visible | Pass | 2px blue outline offset |
| Screen reader | Pass | ARIA labels on all buttons |
| Reduced motion | Pass | `prefers-reduced-motion` respected |
| Touch targets | N/A | Desktop Chrome only |

---

## Performance Considerations

- No external font loading (system stack)
- SVG icons inline (no network requests)
- CSS transitions hardware-accelerated
- Minimal JavaScript for interactions
- Backdrop blur only on toolbar (not full page)

---

## Future Recommendations

1. **Stroke width control** - Add slider for annotation line thickness
2. **Recent colors** - Show last 4 used colors
3. **Tool memory** - Remember last used tool between sessions
4. **Redo support** - Add Ctrl+Shift+Z for redo
5. **Position toggle** - Allow top/bottom toolbar placement

---

## Unresolved Questions

1. Should stroke width be user-configurable or fixed at 3px?
2. Optimal tooltip positioning when toolbar is at screen edge?
3. Should color picker remember last selection across sessions?
