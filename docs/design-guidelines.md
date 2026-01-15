# Deixis Design Guidelines

> Visual Annotation Tool for Chrome Extension

**Version:** 1.0
**Last Updated:** January 2026

---

## Design Direction

**Personality:** Utility & Function
**Approach:** Dark overlay with high contrast for visibility on any image background. Compact, professional, tool-focused design that stays out of the way while being instantly accessible.

**Core Principles:**
- Non-intrusive overlay that works on any image
- High contrast for visibility across light/dark images
- Compact but usable (minimum 36px touch targets for desktop)
- Professional Chrome extension aesthetic
- Fast, responsive micro-interactions

---

## Color System

### Primary Palette (Dark Theme Overlay)

| Token | Value | Usage |
|-------|-------|-------|
| `--surface-primary` | `rgba(24, 24, 27, 0.95)` | Toolbar background |
| `--surface-hover` | `rgba(39, 39, 42, 1)` | Button hover state |
| `--surface-active` | `rgba(63, 63, 70, 1)` | Button active/selected state |
| `--border-subtle` | `rgba(63, 63, 70, 0.8)` | Dividers, borders |
| `--border-visible` | `rgba(82, 82, 91, 1)` | Active borders |

### Text Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--text-primary` | `#FAFAFA` | Primary text, icons |
| `--text-secondary` | `#A1A1AA` | Secondary text, muted icons |
| `--text-muted` | `#71717A` | Disabled states |

### Annotation Colors (High Visibility)

| Token | Value | Name | Usage |
|-------|-------|------|-------|
| `--anno-green` | `#22C55E` | Green | Default annotation color |
| `--anno-red` | `#EF4444` | Red | Alternate |
| `--anno-blue` | `#3B82F6` | Blue | Alternate |
| `--anno-yellow` | `#EAB308` | Yellow | Alternate |
| `--anno-orange` | `#F97316` | Orange | Alternate |
| `--anno-purple` | `#A855F7` | Purple | Alternate |
| `--anno-cyan` | `#06B6D4` | Cyan | Alternate |
| `--anno-white` | `#FFFFFF` | White | For dark images |

### Semantic Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--success` | `#22C55E` | Success states, confirmations |
| `--warning` | `#EAB308` | Warning states |
| `--error` | `#EF4444` | Error states |

---

## Typography

**Font Stack:** `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`

| Size | Value | Usage |
|------|-------|-------|
| `--text-xs` | `11px` | Tooltips, badges |
| `--text-sm` | `12px` | Button labels, secondary text |
| `--text-base` | `13px` | Primary UI text |

**Weight:**
- Regular: `400` - Body text
- Medium: `500` - Labels, buttons
- Semibold: `600` - Emphasis

**Letter Spacing:**
- Normal: `0`
- Tight: `-0.01em` - Headlines

---

## Spacing (4px Grid)

| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | `4px` | Icon gaps, micro spacing |
| `--space-2` | `8px` | Within components |
| `--space-3` | `12px` | Between related elements |
| `--space-4` | `16px` | Section padding |
| `--space-5` | `20px` | Major separation |

---

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | `4px` | Buttons, inputs |
| `--radius-md` | `6px` | Cards, dropdowns |
| `--radius-lg` | `8px` | Toolbar container |
| `--radius-full` | `9999px` | Pills, color swatches |

---

## Shadows

| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.3)` | Subtle lift |
| `--shadow-md` | `0 4px 12px rgba(0,0,0,0.4)` | Toolbar, dropdowns |
| `--shadow-lg` | `0 8px 24px rgba(0,0,0,0.5)` | Modals, overlays |

---

## Animation

**Timing:**
- Micro: `150ms` - Hover states, color changes
- Standard: `200ms` - Transitions, reveals
- Smooth: `250ms` - Larger movements

**Easing:**
- Default: `cubic-bezier(0.25, 1, 0.5, 1)` - Natural deceleration
- Bounce: `cubic-bezier(0.34, 1.56, 0.64, 1)` - Subtle spring (toast only)

**Reduced Motion:**
Always respect `prefers-reduced-motion: reduce`

---

## Component Specifications

### Toolbar Container

```css
.toolbar {
  background: var(--surface-primary);
  border-radius: var(--radius-lg);
  padding: var(--space-2);
  box-shadow: var(--shadow-md);
  border: 1px solid var(--border-subtle);
  backdrop-filter: blur(8px);
}
```

**Layout:** Horizontal flex with 4px gaps between tool buttons

### Tool Button

**Dimensions:** 32x32px (icon area), 36x36px with padding

**States:**
| State | Background | Border | Icon Color |
|-------|------------|--------|------------|
| Default | transparent | none | `--text-secondary` |
| Hover | `--surface-hover` | none | `--text-primary` |
| Active/Selected | `--surface-active` | `1px --border-visible` | `--text-primary` |
| Disabled | transparent | none | `--text-muted` |

### Color Picker

**Swatch Size:** 20x20px
**Swatch Radius:** `--radius-full`
**Current Color Indicator:** 24x24px with 2px white ring

**Dropdown:**
- 8 colors in 4x2 grid
- 4px gap between swatches
- 8px padding

### Divider

```css
.divider {
  width: 1px;
  height: 20px;
  background: var(--border-subtle);
  margin: 0 var(--space-2);
}
```

### Tooltip

```css
.tooltip {
  background: var(--surface-primary);
  color: var(--text-primary);
  font-size: var(--text-xs);
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-sm);
  pointer-events: none;
}
```

**Delay:** 500ms before show
**Position:** Below button, centered

### Toast Notification

```css
.toast {
  background: var(--surface-primary);
  color: var(--text-primary);
  font-size: var(--text-sm);
  padding: 12px 16px;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--border-subtle);
}
```

**Position:** Bottom-center, 16px from edge
**Animation:** Slide up + fade in
**Duration:** 3 seconds auto-dismiss

---

## Icon Set

All icons use 20x20px viewBox, stroke-based, 1.5px stroke width.

| Icon | Usage |
|------|-------|
| Pencil | Freehand draw tool |
| Square | Rectangle tool |
| Circle | Ellipse tool |
| ArrowUpRight | Arrow tool |
| Type | Text label tool |
| Palette | Color picker |
| RotateCcw | Undo |
| Trash2 | Clear all |
| Check | Done/Save |
| X | Cancel/Close |

**Source:** Custom SVG icons matching Lucide/Phosphor style

---

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Undo | `Ctrl+Z` / `Cmd+Z` |
| Cancel | `Escape` |
| Draw Tool | `D` |
| Rectangle | `R` |
| Circle | `C` |
| Arrow | `A` |
| Text | `T` |

---

## Cursor States

| Tool | Cursor |
|------|--------|
| Draw | `crosshair` |
| Rectangle | `crosshair` |
| Circle | `crosshair` |
| Arrow | `crosshair` |
| Text | `text` |
| Default | `default` |

---

## Accessibility

- All interactive elements: minimum 32x32px click area
- Focus visible ring: 2px offset, blue outline
- Tooltips for all icon-only buttons
- Support keyboard navigation (Tab, Enter, Space)
- Respect `prefers-reduced-motion`
- Minimum 4.5:1 contrast ratio for text

---

## Tailwind Configuration

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        'surface-primary': 'rgba(24, 24, 27, 0.95)',
        'surface-hover': 'rgba(39, 39, 42, 1)',
        'surface-active': 'rgba(63, 63, 70, 1)',
        'border-subtle': 'rgba(63, 63, 70, 0.8)',
        'border-visible': 'rgba(82, 82, 91, 1)',
        'anno': {
          green: '#22C55E',
          red: '#EF4444',
          blue: '#3B82F6',
          yellow: '#EAB308',
          orange: '#F97316',
          purple: '#A855F7',
          cyan: '#06B6D4',
          white: '#FFFFFF',
        }
      },
      fontSize: {
        'xs': '11px',
        'sm': '12px',
        'base': '13px',
      },
      borderRadius: {
        'sm': '4px',
        'md': '6px',
        'lg': '8px',
      },
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.25, 1, 0.5, 1)',
      }
    }
  }
}
```
