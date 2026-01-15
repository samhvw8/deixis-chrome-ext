# Deixis - Product Specification

> Chrome Extension for Visual Annotation in Gemini Chat

**Version:** 1.1 (Phase 1 - Implemented)
**Last Updated:** January 2026

---

## Implementation Status

| Feature | Status | Notes |
|---------|--------|-------|
| Context Menu Entry | Implemented | Right-click "Annotate with Deixis" |
| Freehand Draw | Implemented | With configurable brush size |
| Rectangle Tool | Implemented | Outline only |
| Circle/Ellipse Tool | Implemented | Outline only |
| Arrow Tool | Implemented | With arrowhead |
| Text Label | Implemented | With background color & outline options |
| Move Tool | Implemented | Drag existing annotations |
| Eraser Tool | Implemented | Object mode & stroke mode |
| Color Picker | Implemented | Preset + custom color picker |
| Undo | Implemented | Ctrl+Z keyboard shortcut |
| Clear All | Implemented | Removes all annotations |
| Copy to Clipboard | Implemented | With toast notification |
| Save/Download | Implemented | PNG format |
| Keyboard Shortcuts | Implemented | Photoshop-style (V, B, U, E, A, T, X) |

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

#### FR-3: Freehand Draw (Hotkey: B)
```
GIVEN annotation mode is active
WHEN user selects Draw tool and drags on image
THEN a freehand line appears following the cursor
AND the line uses the selected color and brush size
```

#### FR-4: Rectangle Tool (Hotkey: U)
```
GIVEN annotation mode is active
WHEN user selects Rectangle tool and drags on image
THEN a rectangle appears from start point to end point
AND rectangle has outline only (no fill)
AND stroke width matches brush size setting
```

#### FR-5: Circle/Ellipse Tool (Hotkey: E)
```
GIVEN annotation mode is active
WHEN user selects Circle tool and drags on image
THEN an ellipse appears within the drag bounds
AND ellipse has outline only (no fill)
AND stroke width matches brush size setting
```

#### FR-6: Arrow Tool (Hotkey: A)
```
GIVEN annotation mode is active
WHEN user selects Arrow tool and drags on image
THEN an arrow appears from start point to end point
AND arrowhead points to the end position
AND stroke width matches brush size setting
```

#### FR-7: Text Label (Hotkey: T)
```
GIVEN annotation mode is active
WHEN user selects Text tool and clicks on image
THEN a text input appears at click position
AND user can type text
AND pressing Enter or clicking outside confirms the text
AND pressing Escape discards the text
AND text supports optional background color
AND text supports optional outline with configurable width
```

#### FR-7a: Move Tool (Hotkey: V)
```
GIVEN annotation mode is active
WHEN user selects Move tool
THEN cursor changes to grab cursor
AND clicking on any annotation selects it for dragging
AND dragging moves the annotation to new position
```

#### FR-7b: Eraser Tool (Hotkey: X)
```
GIVEN annotation mode is active
WHEN user selects Eraser tool
THEN user can choose between Object mode and Stroke mode

Object Mode:
- Clicking on any annotation deletes it entirely

Stroke Mode:
- Dragging over freehand strokes erases points within radius
- Non-freehand annotations are not affected
```

### Color & Editing

#### FR-8: Color Picker
```
GIVEN annotation mode is active
WHEN user clicks color selector
THEN user can choose from preset colors OR use custom color picker
AND default color is red (#EF4444)
AND color applies to subsequent annotations
```

#### FR-8a: Brush Size
```
GIVEN annotation mode is active with draw/rectangle/circle/arrow tool
WHEN user adjusts brush size slider (1-20px)
THEN stroke width of subsequent annotations changes accordingly
AND current brush size is displayed
```

#### FR-8b: Text Background Color
```
GIVEN text tool is selected
WHEN user toggles text background
THEN text annotations can have semi-transparent background
AND background color is configurable via color picker
```

#### FR-8c: Text Outline
```
GIVEN text tool is selected
WHEN user enables text outline
THEN text annotations have colored stroke outline
AND outline color and width (1-10px) are configurable
```

#### FR-9: Undo (Hotkey: Ctrl+Z)
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
| Scale/resize existing annotations | MVP uses undo instead; Phase 2 |
| Annotation history/save | Not needed for MVP |
| Cross-device sync | Not needed for MVP |
| Support for sites other than Gemini | Focus on Gemini first |
| Mobile support | Desktop Chrome only |

**Note:** Move tool was originally out of scope but has been implemented in v1.1.

---

## UI/UX Guidelines

### Toolbar
- Minimal, non-intrusive overlay at top of image
- Tools displayed as icons with tooltips
- Grouped into: Tools | Color & Settings | Edit Actions | Output Actions
- Shadow DOM for CSS isolation from host page

### Visual Feedback
- Selected tool highlighted with accent color
- Current color displayed in toolbar
- Cursor changes based on selected tool:
  - Move: grab/grabbing
  - Draw/Shape: crosshair
  - Text: text cursor
  - Eraser: crosshair

### Keyboard Shortcuts (Photoshop-style)
| Key | Action |
|-----|--------|
| V | Move tool |
| B | Brush/Draw tool |
| U | Rectangle tool |
| E | Ellipse tool |
| A | Arrow tool |
| T | Text tool |
| X | Eraser tool |
| Ctrl+Z | Undo |
| Escape | Cancel/Close |

### Accessibility
- All tools have keyboard shortcuts
- High contrast default color (red) for visibility
- Tooltips show tool name and shortcut

---

## Technical Implementation

### Stack
- **Framework:** WXT (Web Extension framework)
- **UI:** React 18 with TypeScript
- **Styling:** Tailwind CSS in Shadow DOM
- **Build:** Vite + bun

### Architecture
- Content script injects into Gemini pages
- Shadow DOM isolates extension CSS from host page
- Canvas API for drawing and rendering annotations
- Tab capture API fallback for CORS-restricted images

### Key Components
- `AnnotationOverlay.tsx` - Main annotation canvas and logic
- `AnnotationToolbar.tsx` - Tool selection and controls
- `ColorPicker.tsx` - Color selection with presets and custom picker
- `icons/index.tsx` - SVG icons for all tools

---

## Technical Assumptions

1. Gemini web UI allows right-click on images (context menu not blocked)
2. Gemini lightbox can be overlaid by extension content
3. User knows how to paste from clipboard into chat
4. Images in Gemini chat are accessible by extension (no CORS blocking)

---

## Dependencies

| Dependency | Purpose | Version |
|------------|---------|---------|
| WXT | Chrome Extension framework | 0.20.x |
| React | UI library | 18.x |
| TypeScript | Type safety | 5.x |
| Tailwind CSS | Styling | 3.x |
| Chrome Extension Manifest V3 | Extension framework | - |
| Canvas API | Drawing functionality | Native |
| Clipboard API | Copy annotated image | Native |
| Tab Capture API | CORS fallback | Native |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Gemini UI changes | Extension breaks | Use resilient selectors; monitor for updates |
| CORS blocks image access | Cannot annotate image | Fall back to capturing visible tab |
| Clipboard API restrictions | Cannot copy image | Provide download as primary, clipboard as secondary |

---

## Open Questions (Resolved)

| Question | Resolution |
|----------|------------|
| What is the DOM structure of Gemini's lightbox? | Content script injects overlay on right-click |
| Should output image maintain original dimensions or resize? | Resized to fit viewport, maintains aspect ratio |
| Should stroke width be fixed or user-configurable? | User-configurable via brush size slider (1-20px) |

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