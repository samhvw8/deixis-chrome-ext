# Phase 03: Integration

**Status:** Pending
**Date:** 2026-01-13

---

## Overview

Integration of annotation toolbar with Chrome extension content script.

---

## Requirements

### Entry Points
1. Right-click context menu "Annotate with Deixis"
2. Click image to enlarge (lightbox) - toolbar appears

### Content Script Updates
- Mount React toolbar on image lightbox
- Create canvas overlay for drawing
- Handle annotation state
- Implement save/copy functionality

---

## Implementation Steps

- [ ] Update content.ts to inject React root
- [ ] Create AnnotationOverlay container component
- [ ] Implement canvas drawing layer
- [ ] Connect toolbar to canvas state
- [ ] Add context menu registration in background.ts
- [ ] Implement PNG export + clipboard copy
- [ ] Handle lightbox detection on Gemini

---

## Architecture

```
ContentScript
├── AnnotationOverlay (container)
│   ├── CanvasLayer (drawing surface)
│   ├── AnnotationToolbar (UI controls)
│   └── Toast (notifications)
├── ContextMenu handler
└── Lightbox detector
```

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Gemini UI changes | Use resilient selectors, mutation observer |
| CORS image access | Fall back to tab capture |
| Clipboard API restrictions | Download as primary, clipboard secondary |

---

## Success Criteria

- [ ] Toolbar appears on image lightbox
- [ ] Drawing works on canvas overlay
- [ ] Annotations persist during session
- [ ] Undo/Clear work correctly
- [ ] Done saves PNG + copies to clipboard
- [ ] Context menu entry functional
