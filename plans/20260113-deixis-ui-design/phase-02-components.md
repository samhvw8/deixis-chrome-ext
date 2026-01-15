# Phase 02: Components

**Status:** Complete
**Date:** 2026-01-13

---

## Overview

React component library for Deixis annotation toolbar.

---

## Components Built

### 1. ToolButton
Icon button with tooltip, active state, keyboard support.

**Props:**
- `icon` - React node
- `tooltip` - Hover text
- `shortcut` - Keyboard shortcut hint
- `isActive` - Selected state
- `disabled` - Disabled state
- `onClick` - Handler

**States:** Default, Hover, Active/Selected, Disabled, Focus

### 2. ColorPicker
Dropdown color selector with 8 annotation colors.

**Features:**
- 24px current color indicator
- 4x2 dropdown grid
- Click outside to close
- Keyboard accessible

**Default colors:** Green, Red, Blue, Yellow, Orange, Purple, Cyan, White

### 3. Toast
Bottom-center notification with auto-dismiss.

**Features:**
- Slide up + fade animation
- Success/Error/Info types
- 3s auto-dismiss (configurable)
- `useToast` hook for state management

### 4. Divider
Visual separator for toolbar sections.

### 5. AnnotationToolbar
Main toolbar composing all components.

**Layout:** [Tools] | [Color] | [Undo/Clear] | [Done/Cancel]

**Keyboard Shortcuts:**
- D/R/C/A/T: Tool selection
- Ctrl+Z: Undo
- Escape: Cancel

---

## Icon Set

Custom SVG icons (20x20, 1.5px stroke):
- PencilIcon (draw)
- SquareIcon (rectangle)
- CircleIcon (circle/ellipse)
- ArrowIcon (arrow)
- TypeIcon (text)
- UndoIcon
- TrashIcon (clear)
- CheckIcon (done)
- CloseIcon (cancel)
- ChevronDownIcon (dropdown)

---

## Related Files

- `/entrypoints/content/components/ToolButton.tsx`
- `/entrypoints/content/components/ColorPicker.tsx`
- `/entrypoints/content/components/Toast.tsx`
- `/entrypoints/content/components/Divider.tsx`
- `/entrypoints/content/components/AnnotationToolbar.tsx`
- `/entrypoints/content/components/index.ts`
- `/entrypoints/content/icons/index.tsx`

---

## Success Criteria

- [x] ToolButton with all states
- [x] ColorPicker with dropdown
- [x] Toast with animation
- [x] AnnotationToolbar composition
- [x] SVG icon set complete
- [x] TypeScript compilation passing
- [x] Accessibility (ARIA, keyboard nav)

---

## Next Steps

Phase 03: Integration with content script
