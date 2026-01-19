# Deixis Architecture Documentation

**Version:** 0.3.0-beta
**Last Updated:** January 2026

---

## Overview

Deixis uses an **Adapter Pattern** architecture that separates site-agnostic annotation logic (Core Engine) from site-specific DOM handling (Site Adapters). This design enables the extension to work across multiple AI platforms while maintaining a single, well-tested annotation engine.

---

## Architectural Principles

### 1. Separation of Concerns

```
Site-Specific Logic (Adapters)
    ↓
Site Registry (Adapter Management)
    ↓
Core Engine (Site-Agnostic)
```

- **Site Adapters**: Handle only DOM interaction and site-specific selectors
- **Core Engine**: Implements all annotation logic, state management, and rendering
- **No Cross-Contamination**: Site-specific code never touches annotation logic

### 2. Single Responsibility

Each component has one clear responsibility:

| Component | Single Responsibility |
|-----------|----------------------|
| Site Adapter | Find images and injection points on a specific site |
| Site Registry | Match URLs to adapters and manage adapter lifecycle |
| Core Engine | Render annotations, manage state, handle user interactions |
| Button Factory | Create isolated, styled buttons with Shadow DOM |
| Overlay Manager | Mount React components in Shadow DOM containers |

### 3. Open/Closed Principle

- **Open for Extension**: Add new sites by creating new adapters
- **Closed for Modification**: Core engine never changes for new sites

---

## System Architecture

### High-Level Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Chrome Extension                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                  Site Adapters                         │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐            │  │
│  │  │  Gemini  │  │ ChatGPT  │  │  Future  │            │  │
│  │  │ Adapter  │  │ Adapter  │  │ Adapters │            │  │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘            │  │
│  │       │             │             │                    │  │
│  │       └─────────────┴─────────────┘                    │  │
│  └───────────────────────┬─────────────────────────────────┘  │
│                          │                                     │
│  ┌───────────────────────▼─────────────────────────────────┐  │
│  │              Site Registry                               │  │
│  │  - Adapter registration                                  │  │
│  │  - URL pattern matching                                  │  │
│  │  - Adapter lookup and initialization                     │  │
│  └───────────────────────┬─────────────────────────────────┘  │
│                          │                                     │
│  ┌───────────────────────▼─────────────────────────────────┐  │
│  │              Content Script (Adapter Loader)             │  │
│  │  - Detect current site                                   │  │
│  │  - Load appropriate adapter                              │  │
│  │  - Inject annotation buttons                             │  │
│  │  - Handle button clicks → open overlay                   │  │
│  └───────────────────────┬─────────────────────────────────┘  │
│                          │                                     │
│  ┌───────────────────────▼─────────────────────────────────┐  │
│  │                 Core Engine                              │  │
│  │  ┌──────────────────┐  ┌──────────────────────────────┐ │  │
│  │  │ Overlay Manager  │  │   Annotation Engine          │ │  │
│  │  │ - Shadow DOM     │  │   - Canvas rendering         │ │  │
│  │  │ - React mounting │  │   - State management         │ │  │
│  │  │ - Style isolation│  │   - Tool handlers            │ │  │
│  │  │                  │  │   - Transform calculations   │ │  │
│  │  │                  │  │   - Export pipeline          │ │  │
│  │  └──────────────────┘  └──────────────────────────────┘ │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │            UI Components (React)                         │  │
│  │  - AnnotationOverlay.tsx                                 │  │
│  │  - AnnotationToolbar.tsx                                 │  │
│  │  - ColorPicker.tsx                                       │  │
│  │  - Toast.tsx                                             │  │
│  │  - ToolButton.tsx                                        │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Component Specifications

### 1. Site Adapter Interface

**Location:** `src/core/adapters/types.ts`

#### Interface Definition

```typescript
export interface SiteAdapter {
  /** Unique site identifier (e.g., "gemini", "chatgpt") */
  id: string;

  /** Human-readable site name (e.g., "Google Gemini") */
  name: string;

  /** URL patterns this adapter handles (Chrome extension format) */
  matches: string[];

  /** Initialize adapter on page load */
  init(): void;

  /** Clean up on unload */
  destroy(): void;

  /** Find all annotatable images on page */
  findImages(): AnnotatableImage[];

  /** Get injection point for annotation button on image container */
  getButtonInjectionPoint(image: HTMLImageElement): ButtonInjectionConfig | null;

  /** Get injection point for lightbox/dialog button (optional) */
  getLightboxInjectionPoint?(): ButtonInjectionConfig | null;

  /** Watch for dynamically loaded images */
  observeImageChanges(callback: (images: AnnotatableImage[]) => void): () => void;

  /** Site-specific image URL processing (optional) */
  processImageUrl?(url: string): string | Promise<string>;
}
```

#### Supporting Types

```typescript
export interface AnnotatableImage {
  element: HTMLImageElement;     // The image DOM element
  url: string;                   // Image source URL
  bounds: DOMRect;               // Current bounding rectangle
  container?: HTMLElement;       // Optional container element
}

export interface ButtonInjectionConfig {
  container: HTMLElement;        // Where to inject button
  position: 'prepend' | 'append' | 'before' | 'after';
  style?: Partial<CSSStyleDeclaration>;  // Custom positioning styles
  showOnHover?: boolean;         // Show button only on hover
  hoverTarget?: HTMLElement;     // Element for hover listeners
}
```

#### Responsibilities

1. **Image Detection**: Locate all annotatable images using site-specific selectors
2. **Button Placement**: Determine where annotation buttons should appear
3. **Dynamic Content**: Watch for new images loaded via AJAX/dynamic rendering
4. **URL Processing**: Handle site-specific URL transformations (CDNs, proxies, etc.)

#### Design Constraints

- **Minimal Logic**: Adapters should contain only DOM queries and selectors
- **No State**: Adapters should be stateless (no instance variables beyond initialization)
- **Fast Queries**: `findImages()` called frequently, must be efficient
- **No Assumptions**: Don't assume image count or layout structure

---

### 2. Site Registry

**Location:** `src/core/adapters/registry.ts`

#### Purpose

Central registration and lookup system for all site adapters.

#### Core Functions

```typescript
// Get all URL patterns for manifest
export function getAllMatches(): string[]

// Find adapter for a given URL
export function getAdapterForUrl(url: string): SiteAdapter | null
```

#### Pattern Matching

Uses Chrome extension pattern format with glob-style wildcards:

- `https://gemini.google.com/*` - Matches all pages under domain
- `*://example.com/*` - Matches any protocol
- `https://example.com/path/*` - Matches specific path prefix

#### Adding New Adapters

1. Import adapter at top of file
2. Add to `siteAdapters` array
3. No other changes required (patterns extracted automatically)

```typescript
import { geminiAdapter } from '../../adapters/gemini';
import { newsiteAdapter } from '../../adapters/newsite';

export const siteAdapters: SiteAdapter[] = [
  geminiAdapter,
  newsiteAdapter,  // Just add here
];
```

---

### 3. Content Script (Adapter Loader)

**Location:** `entrypoints/content.tsx`

#### Responsibilities

1. **Adapter Detection**: Determine which adapter to use for current page
2. **Initialization**: Initialize selected adapter
3. **Button Injection**: Create and inject annotation buttons
4. **Event Handling**: Handle button clicks, open/close overlay
5. **Dynamic Observation**: Watch for new images and inject buttons

#### Lifecycle

```
Page Load
    ↓
getAdapterForUrl(window.location.href)
    ↓
adapter.init()
    ↓
Inject initial buttons (adapter.findImages() + adapter.getButtonInjectionPoint())
    ↓
Setup observer (adapter.observeImageChanges())
    ↓
[User clicks button]
    ↓
openAnnotation(imageUrl, bounds)
    ↓
Mount React overlay in Shadow DOM
    ↓
[User exports or closes]
    ↓
closeAnnotation()
    ↓
Cleanup React root
```

#### Button Injection Logic

```typescript
function injectButtons() {
  const images = currentAdapter.findImages();

  images.forEach(({ element, url, container }) => {
    const config = currentAdapter.getButtonInjectionPoint(element);
    if (!config) return;

    const button = createDeixisButton({
      onClick: () => openAnnotation(url, element.getBoundingClientRect()),
      style: config.style,
      showOnHover: config.showOnHover,
      hoverTarget: config.hoverTarget || config.container,
    });

    // Inject based on position
    switch (config.position) {
      case 'prepend': config.container.insertBefore(button, config.container.firstChild); break;
      case 'append': config.container.appendChild(button); break;
      case 'before': config.container.parentElement?.insertBefore(button, config.container); break;
      case 'after': config.container.parentElement?.insertBefore(button, config.container.nextSibling); break;
    }
  });
}
```

---

### 4. Button Factory

**Location:** `src/core/ui/button.ts`

#### Purpose

Create fully isolated annotation buttons using Shadow DOM.

#### Interface

```typescript
export interface DeixisButtonOptions {
  onClick: () => void;
  style?: Partial<CSSStyleDeclaration>;
  showOnHover?: boolean;
  hoverTarget?: HTMLElement;
  variant?: 'default' | 'large';
}

export function createDeixisButton(options: DeixisButtonOptions): HTMLElement
```

#### Shadow DOM Isolation

Each button gets:
- Closed Shadow DOM (cannot be inspected or modified by host page)
- Encapsulated styles (no CSS leakage in or out)
- Event handlers attached inside shadow boundary

#### Button Structure

```
<div class="deixis-host">  <!-- Host element injected into page -->
  #shadow-root (closed)
    <style>...</style>     <!-- Isolated styles -->
    <button class="deixis-btn">
      <svg>...</svg>       <!-- Annotation icon -->
    </button>
```

#### Hover Behavior

When `showOnHover: true`:
- Button has `opacity: 0` by default
- Hover listeners on `hoverTarget` add `.visible` class
- Transition smoothly to `opacity: 1`

---

### 5. Overlay Manager

**Location:** `entrypoints/content.tsx` (integrated into content script)

#### Responsibilities

1. Create full-screen Shadow DOM container
2. Mount React root inside Shadow DOM
3. Inject styles into shadow boundary
4. Handle cleanup on close

#### Shadow DOM Structure

```
<div id="deixis-annotation-root">  <!-- Host element -->
  #shadow-root (open)
    <style>
      /* Injected from content/styles.css */
      /* Includes Tailwind, component styles, animations */
    </style>
    <div id="react-root">
      <AnnotationOverlay />  <!-- React app renders here -->
    </div>
```

#### Style Isolation

Styles injected into Shadow DOM include:
- Tailwind CSS utilities
- Component-specific styles
- Animation keyframes
- Design token CSS variables

No host page styles leak in. No Deixis styles leak out.

---

### 6. Annotation Engine

**Location:** `entrypoints/content/components/AnnotationOverlay.tsx`

#### Architecture

The annotation engine is a finite state machine with multiple layers:

```
State Layers:
├─ Drawing State (idle | drawing | dragging | resizing | rotating)
├─ Tool State (draw | rect | ellipse | arrow | text)
├─ Selection State (selected annotation | null)
├─ Transform State (drag offset, resize anchor, rotation origin)
└─ History State (undo/redo stack)
```

#### Core Capabilities

1. **Canvas Rendering**
   - Double-buffered canvas (background image + annotation layer)
   - High-DPI support (devicePixelRatio scaling)
   - Efficient redraw on state changes

2. **Annotation Types**
   - Freehand paths (smooth Bezier curves)
   - Rectangles (with rotation support)
   - Ellipses (with rotation support)
   - Arrows (directional with rotation)
   - Text labels (planned)

3. **Transformations**
   - **Translation**: Click and drag to move
   - **Rotation**: Rotation handle with snap-to-15° when Shift held
   - **Resize**: 8-point handles with anchor-locked resize for rotated shapes
   - **Correct Anchor Locking**: Edge handles maintain opposite corner position

4. **Selection System**
   - Click to select annotation
   - Bounding box visualization
   - Transform handles (move, rotate, resize)
   - Hit testing with rotation-aware bounds

5. **State Management**
   - Immutable state updates
   - Undo/redo with full history stack
   - Efficient serialization for clipboard/download

---

## Data Flow

### Button Click to Annotation Open

```
1. User hovers over image
   → Button fades in (CSS transition in Shadow DOM)

2. User clicks annotation button
   → onClick handler fires
   → openAnnotation(imageUrl, imageBounds)

3. Content script creates Shadow DOM container
   → Injects styles
   → Mounts React root
   → Renders <AnnotationOverlay imageUrl={url} />

4. AnnotationOverlay loads image
   → Creates canvas
   → Sets up event listeners
   → Enters 'idle' state

5. User selects tool and draws
   → Mouse events captured on canvas
   → State updates trigger re-render
   → Canvas redrawn with new annotation

6. User clicks "Done"
   → Export pipeline generates PNG
   → Copies to clipboard or downloads
   → closeAnnotation() called
   → Shadow DOM removed
   → React root unmounted
```

### Dynamic Image Detection

```
1. Page loads
   → Content script initializes
   → adapter.findImages() called
   → Buttons injected for initial images

2. User scrolls or interacts with page
   → MutationObserver fires (from adapter.observeImageChanges())
   → Callback invoked with new images
   → injectButtons() called again
   → New buttons injected (skip if already exists)

3. User navigates within single-page app
   → MutationObserver continues watching
   → New images detected automatically
   → Buttons appear immediately
```

---

## Extension Points

### Adding a New Annotation Tool

1. Add tool type to `AnnotationType` enum
2. Create rendering function in `drawAnnotation()`
3. Add event handlers for tool in `handleMouseDown/Move/Up()`
4. Add toolbar button in `AnnotationToolbar.tsx`
5. Add icon in `entrypoints/content/icons/index.tsx`

### Adding a New Site

1. Create adapter file implementing `SiteAdapter` interface
2. Register in `src/core/adapters/registry.ts`
3. Add URL to `host_permissions` in `wxt.config.ts`
4. Test and verify

### Adding a New Export Format

1. Add handler in `AnnotationOverlay.tsx` (e.g., `handleExportSVG()`)
2. Implement serialization logic (annotations to SVG/JSON/etc.)
3. Add button to toolbar
4. Wire up event handler

---

## Design Decisions & Rationale

### Why Adapter Pattern?

**Alternative Considered**: Configuration files (JSON/YAML)

**Decision**: Compile-time adapters with TypeScript

**Rationale**:
- Type safety across all adapters
- No runtime errors from malformed config
- Better IDE support (autocomplete, refactoring)
- Smaller bundle size (tree-shaking)
- Simpler implementation (no config parser)

**Trade-off**: Requires rebuild to add sites (acceptable for known, finite set of platforms)

### Why Closed Shadow DOM for Buttons?

**Alternative Considered**: Open Shadow DOM or no Shadow DOM

**Decision**: Closed Shadow DOM

**Rationale**:
- Complete isolation from host page CSS
- Host page cannot accidentally or maliciously modify buttons
- Consistent styling across all sites
- Prevents extension fingerprinting

**Trade-off**: Slightly more complex to debug (but worth it for isolation)

### Why Single Registry File?

**Alternative Considered**: Distributed adapter registration (each adapter self-registers)

**Decision**: Central registry file

**Rationale**:
- Single source of truth for supported sites
- Easy to see all adapters at a glance
- No module initialization order issues
- Simpler dependency graph

**Trade-off**: Registry file grows with each adapter (minimal concern)

### Why Canvas Instead of SVG?

**Alternative Considered**: SVG-based annotation rendering

**Decision**: Canvas with export to raster PNG

**Rationale**:
- Better performance for complex paths (freehand drawing)
- Simpler hit testing for selection
- Easier rotation/transform calculations
- Direct pixel manipulation for effects
- Final output is raster anyway (embedded in chat)

**Trade-off**: Cannot export to vector formats (acceptable for use case)

---

## Performance Considerations

### Button Injection

- **Challenge**: `findImages()` called frequently (MutationObserver fires often)
- **Mitigation**: Check if button already exists before injecting
- **Cost**: O(n) where n = number of images on page (typically < 20)

### Canvas Rendering

- **Challenge**: Redraw entire canvas on every state change
- **Mitigation**:
  - Efficient path rendering (no complex transforms)
  - Request animation frame for smooth updates
  - High-DPI scaling only when necessary
- **Cost**: 60 FPS achievable even with 50+ annotations

### Shadow DOM Overhead

- **Challenge**: Each button creates a Shadow DOM
- **Mitigation**: Shadow DOM creation is fast (< 1ms per button)
- **Cost**: Negligible (buttons created once, reused until page navigation)

### Memory Management

- **Challenge**: Large images in memory for annotation
- **Mitigation**:
  - Use blob URLs instead of base64
  - Clean up React roots on close
  - Disconnect MutationObservers when adapter destroyed
- **Cost**: Peak memory ~50MB for 2000x2000px image

---

## Testing Strategy

### Unit Tests (Planned)

- Adapter URL pattern matching
- Button injection logic
- Annotation geometry calculations (rotation, resize)
- Export pipeline

### Integration Tests (Manual)

- Button appears on image hover
- Annotation overlay opens on click
- Tools work correctly (draw, select, transform)
- Export to clipboard/download succeeds
- Buttons work in lightbox/modal views

### Cross-Site Tests

- Test each adapter on its target site
- Verify dynamic image detection
- Test with slow-loading images
- Verify no style conflicts

---

## Security Considerations

### Content Security Policy (CSP)

- Deixis uses inline styles in Shadow DOM (isolated from host CSP)
- No `eval()` or dynamic code execution
- All scripts bundled at compile time

### Image URL Handling

- Validate image URLs before loading (must be http/https)
- Respect CORS policies (canvas tainting)
- No sensitive data in URLs (all processing client-side)

### Host Page Isolation

- Shadow DOM prevents host page scripts from accessing Deixis internals
- Closed Shadow DOM prevents inspection of button internals
- No global variables exposed to host page
- All event handlers scoped to Shadow DOM

### Permissions

- `activeTab`: Required for taking screenshots (context menu)
- `clipboardWrite`: Required for copy-to-clipboard
- `host_permissions`: Required for content script injection (scoped to specific sites)

---

## Future Architecture Enhancements

### Potential Improvements

1. **Adapter Versioning**: Support multiple adapter versions for same site
2. **Adapter Configuration**: Allow adapters to expose configurable selectors
3. **Cross-Adapter Patterns**: Extract common patterns (lightbox detection, etc.)
4. **Performance Monitoring**: Telemetry for adapter performance (opt-in)
5. **Adapter Marketplace**: Community-contributed adapters with verification

### Scalability

Current architecture supports:
- 10-20 site adapters comfortably
- 100+ annotations per image
- 50+ images per page

Beyond these limits, consider:
- Lazy-loading adapters (dynamic import)
- Virtualized annotation rendering (only visible shapes)
- Web Worker for export pipeline

---

## References

- [WXT Framework Documentation](https://wxt.dev/)
- [Chrome Extension Manifest V3](https://developer.chrome.com/docs/extensions/mv3/)
- [Shadow DOM Specification](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_shadow_DOM)
- [Adapter Pattern (Gang of Four)](https://refactoring.guru/design-patterns/adapter)

---

**Document Version:** 1.0
**Last Reviewed:** January 2026
