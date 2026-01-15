# Deixis - Product Specification

> Chrome Extension for Visual Annotation in Gemini Chat

**Version:** 1.0 (Phase 1)  
**Last Updated:** January 2026

---

## Problem Statement

Non-designers using Gemini + Nano Banana Pro for image generation/editing struggle to express **where** and **how** they want changes using text alone. They lack design vocabulary, must prompt multiple times, model quality degrades over turns, leading to frustration and abandonment.

**Solution:** Enable users to draw visual annotations directly on images within Gemini chat to communicate intent precisely to AI.

---

## User Story

**As** a Gemini user without design background,

**I want** to draw/mark directly on images in chat to show AI what I want to change and where,

**So that** AI understands my intent from the first prompt, reducing the need to explain repeatedly.

---

## Target Users

- Non-designers creating visual content (posters, infographics, social media images)
- Users who lack technical vocabulary for design/photography
- Anyone struggling to describe spatial changes ("move left", "make bigger") via text

---

## User Journey

```
TRIGGER
User is chatting with Gemini, sees an image (AI-generated or uploaded) 
that needs editing but is difficult to describe in text.

ENTRY POINTS (2 methods)
├── Right-click on image → Context menu "Annotate with Deixis"
└── Click image to enlarge (lightbox) → Annotation tools appear

ANNOTATION MODE
User sees image with toolbar overlay
    → Select tool (draw / shape / text / arrow)
    → Select color
    → Draw/mark on image
    → Undo if needed
    → Continue annotating or Done

EXIT & OUTPUT
User clicks Done
    → Annotated image downloaded (PNG)
    → Annotated image copied to clipboard
    → User pastes into chat input + writes prompt

SUCCESS
AI receives annotated image → Understands region/intent → Output matches expectation
```

---

## Functional Requirements

### Entry Points

#### FR-1: Context Menu Entry
```
GIVEN user is on gemini.google.com with an image in chat
WHEN user right-clicks on the image
THEN context menu displays option "Annotate with Deixis"
AND clicking the option opens annotation mode
```

#### FR-2: Lightbox Integration
```
GIVEN user is on gemini.google.com
WHEN user clicks an image to enlarge (lightbox view)
THEN annotation toolbar appears on the lightbox
```

### Annotation Tools

#### FR-3: Freehand Draw
```
GIVEN annotation mode is active
WHEN user selects Draw tool and drags on image
THEN a freehand line appears following the cursor
AND the line uses the selected color
```

#### FR-4: Rectangle Tool
```
GIVEN annotation mode is active
WHEN user selects Rectangle tool and drags on image
THEN a rectangle appears from start point to end point
AND rectangle has outline only (no fill)
```

#### FR-5: Circle/Ellipse Tool
```
GIVEN annotation mode is active
WHEN user selects Circle tool and drags on image
THEN an ellipse appears within the drag bounds
AND ellipse has outline only (no fill)
```

#### FR-6: Arrow Tool
```
GIVEN annotation mode is active
WHEN user selects Arrow tool and drags on image
THEN an arrow appears from start point to end point
AND arrowhead points to the end position
```

#### FR-7: Text Label
```
GIVEN annotation mode is active
WHEN user selects Text tool and clicks on image
THEN a text input appears at click position
AND user can type text
AND pressing Enter or clicking outside confirms the text
```

### Color & Editing

#### FR-8: Color Picker
```
GIVEN annotation mode is active
WHEN user clicks color selector
THEN user can choose color for subsequent annotations
AND default color is green (#00FF00 or similar high-visibility color)
```

#### FR-9: Undo
```
GIVEN user has drawn at least 1 annotation
WHEN user clicks Undo button or presses Ctrl+Z
THEN the most recent annotation is removed
AND undo can be repeated until no annotations remain
```

#### FR-10: Clear All
```
GIVEN user has drawn annotations
WHEN user clicks Clear All
THEN all annotations are removed
AND original image is displayed
```

### Output

#### FR-11: Save & Copy
```
GIVEN user has drawn annotations
WHEN user clicks Done/Save
THEN annotated image is downloaded to device (PNG format)
AND annotated image is copied to clipboard
AND user sees confirmation message "Copied to clipboard"
```

#### FR-12: Cancel
```
GIVEN annotation mode is active
WHEN user clicks Cancel or presses Escape
THEN annotation mode closes
AND nothing is saved or copied
```

---

## Out of Scope (Phase 1)

| Excluded Feature | Rationale |
|------------------|-----------|
| Auto-attach to Gemini chat input | Technical complexity; defer to Phase 2 |
| Image editing (crop, filter, brightness) | This is an annotation tool, not an editor |
| Layer management | Phase 2 scope |
| Move/scale existing annotations | MVP uses undo instead; Phase 2 |
| Annotation history/save | Not needed for MVP |
| Cross-device sync | Not needed for MVP |
| Support for sites other than Gemini | Focus on Gemini first |
| Mobile support | Desktop Chrome only |

---

## UI/UX Guidelines

### Toolbar
- Minimal, non-intrusive overlay
- Position: top or side of image (avoid blocking content)
- Tools displayed as icons with tooltips

### Visual Feedback
- Selected tool highlighted
- Current color displayed
- Cursor changes based on selected tool

### Accessibility
- Keyboard shortcuts for common actions (Ctrl+Z for undo)
- High contrast default color (green) for visibility on most images

---

## Technical Assumptions

1. Gemini web UI allows right-click on images (context menu not blocked)
2. Gemini lightbox can be overlaid by extension content
3. User knows how to paste from clipboard into chat
4. Images in Gemini chat are accessible by extension (no CORS blocking)

---

## Dependencies

| Dependency | Purpose |
|------------|---------|
| Chrome Extension Manifest V3 | Extension framework |
| Canvas API | Drawing functionality |
| Clipboard API | Copy annotated image |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Gemini UI changes | Extension breaks | Use resilient selectors; monitor for updates |
| CORS blocks image access | Cannot annotate image | Fall back to capturing visible tab |
| Clipboard API restrictions | Cannot copy image | Provide download as primary, clipboard as secondary |

---

## Open Questions

1. What is the DOM structure of Gemini's lightbox? Where should extension inject?
2. Should output image maintain original dimensions or resize?
3. Should stroke width be fixed or user-configurable?

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Prompt turns to achieve desired result | Reduce from 5+ to 1-2 |
| User task completion rate | Increase (qualitative feedback) |
| Extension daily active users | Growth indicator |

---

## Phase 2 Preview (Future Scope)

If Phase 1 validates the core hypothesis, Phase 2 will add:

- **Layer system** — for precise manual adjustments
- **Move/scale objects** — when AI can't achieve exact positioning
- **Standalone web app** — for complex editing workflows
- **Auto-attach to chat** — seamless integration with Gemini input

---

## Appendix: Example Use Cases

### Use Case 1: Keep Specific Element
User draws green outline around a character → Prompts "Keep only this character, remove everything else"

### Use Case 2: Add Element to Region
User draws rectangle in corner → Labels "Add Christmas tree here"

### Use Case 3: Indicate Direction
User draws arrow from object pointing left → Prompts "Move this to where the arrow points"

### Use Case 4: Resize Request
User draws larger rectangle around small text → Labels "Make text fill this area"

---

*Specification by: Product Requirements Session*  
*Product Name: Deixis (Greek: δεῖξις — "pointing, showing")*