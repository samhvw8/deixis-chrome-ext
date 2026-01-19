# Deixis - Visual Annotation for AI

> **Stop describing. Start pointing.**

**Version:** 0.3.1
**Tagline:** Annotate images in AI chats. Show what you mean instead of describing it with words.

Ever tried to describe "that small thing in the upper-left corner behind the other thing"? Deixis ends the guessing game. Draw directly on images in AI chat interfaces to show exactly what you mean—circle the object you want removed, arrow to the spot that needs fixing, highlight the area that should change.

Deixis (Greek: "to show, to point out") is a Chrome extension that enables precise visual communication through freehand drawings, shapes, and annotations directly on images across multiple AI platforms.

---

## Features

- **Multi-Site Support** - Works across multiple AI platforms with an extensible adapter architecture
  - Currently supported: Google Gemini

- **Comprehensive Annotation Tools**
  - Freehand drawing with smooth stroke rendering
  - Geometric shapes (rectangles, ellipses, arrows)
  - Rotation with visual feedback and snap-to-angle
  - Precise resize with anchor-locked transformations
  - Multi-color palette (8 high-visibility colors)

- **Advanced Editing**
  - Selection and transformation of annotations
  - Rotation-aware resize handles with correct anchor locking
  - Undo/redo support
  - Clear all annotations

- **Export Options**
  - Copy annotated image to clipboard
  - Download as PNG with annotations embedded
  - Preserves original image quality

- **User Experience**
  - Non-intrusive hover-to-reveal buttons on images
  - Shadow DOM isolation prevents style conflicts
  - Keyboard shortcuts for faster workflow
  - High-contrast dark theme overlay works on any background

---

## Architecture

Deixis uses an **Adapter Pattern** architecture that separates site-agnostic annotation logic from site-specific DOM handling, enabling easy extension to new websites.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Chrome Extension                    │
├─────────────────────────────────────────────────────┤
│                                                       │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐    │
│  │   Gemini   │  │  ChatGPT   │  │  Future    │    │
│  │  Adapter   │  │  Adapter   │  │  Adapters  │    │
│  └─────┬──────┘  └──────┬─────┘  └──────┬─────┘    │
│        │                 │                │          │
│        └────────┬────────┴────────────────┘          │
│                 │                                     │
│        ┌────────▼──────────┐                         │
│        │   Site Registry   │                         │
│        │  (Adapter Loader) │                         │
│        └────────┬──────────┘                         │
│                 │                                     │
│        ┌────────▼──────────────────────┐             │
│        │       Core Engine              │             │
│        │  ┌──────────┐  ┌────────────┐ │             │
│        │  │ Overlay  │  │ Annotation │ │             │
│        │  │ Manager  │  │   Engine   │ │             │
│        │  └──────────┘  └────────────┘ │             │
│        └────────────────────────────────┘             │
│                                                       │
└─────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Layer | Responsibility |
|-------|---------------|
| **Site Adapters** | DOM selectors, button injection points, image detection |
| **Site Registry** | Adapter registration, URL matching, adapter lookup |
| **Core Engine** | Annotation rendering, state management, user interactions |
| **Overlay Manager** | Shadow DOM creation, React component mounting |

### File Structure

```
src/
  core/
    adapters/
      types.ts           # SiteAdapter interface definitions
      registry.ts        # Adapter registration and lookup
    ui/
      button.ts          # Button factory with Shadow DOM
      styles.ts          # Shared overlay styles
  adapters/
    gemini.ts            # Google Gemini adapter
    # Add new adapters here

entrypoints/
  content.tsx            # Main content script (adapter loader)
  background.ts          # Background service worker
  content/
    components/          # React UI components (site-agnostic)
      AnnotationOverlay.tsx
      AnnotationToolbar.tsx
      ColorPicker.tsx
      ...
```

---

## Adding Support for New Sites

Adding Deixis to a new website requires **3 simple steps**:

### Step 1: Create a Site Adapter

Create a new file in `src/adapters/` implementing the `SiteAdapter` interface:

```typescript
// src/adapters/newsite.ts
import type { SiteAdapter, AnnotatableImage, ButtonInjectionConfig } from '../core/adapters/types';

export const newsiteAdapter: SiteAdapter = {
  id: 'newsite',
  name: 'New Site Name',
  matches: ['https://newsite.com/*'],

  init() {
    console.log('[Deixis] NewSite adapter initialized');
  },

  destroy() {
    // Cleanup if needed
  },

  findImages(): AnnotatableImage[] {
    const images: AnnotatableImage[] = [];
    // TODO: Query site-specific image containers
    const containers = document.querySelectorAll('.image-container');

    containers.forEach(container => {
      const img = container.querySelector('img') as HTMLImageElement;
      if (img) {
        images.push({
          element: img,
          url: img.src,
          bounds: img.getBoundingClientRect(),
          container: container as HTMLElement,
        });
      }
    });

    return images;
  },

  getButtonInjectionPoint(image: HTMLImageElement): ButtonInjectionConfig | null {
    const container = image.closest('.image-container') as HTMLElement;
    if (!container) return null;

    return {
      container,
      position: 'prepend',
      style: {
        position: 'absolute',
        top: '12px',
        left: '12px',
        zIndex: '9999',
      },
      showOnHover: true,
      hoverTarget: container,
    };
  },

  observeImageChanges(callback: (images: AnnotatableImage[]) => void): () => void {
    const observer = new MutationObserver(() => {
      callback(this.findImages());
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  },
};
```

### Step 2: Register the Adapter

Add your adapter to the registry in `src/core/adapters/registry.ts`:

```typescript
import { newsiteAdapter } from '../../adapters/newsite';

export const siteAdapters: SiteAdapter[] = [
  geminiAdapter,
  newsiteAdapter, // Add here
];
```

### Step 3: Update Host Permissions

Add the site URL to `wxt.config.ts`:

```typescript
manifest: {
  host_permissions: [
    'https://gemini.google.com/*',
    'https://newsite.com/*', // Add here
  ],
}
```

That's it! Run `bun run build` to compile and test.

---

## Development

### Prerequisites

- [Bun](https://bun.sh/) runtime
- Chrome or Firefox browser

### Setup

```bash
# Install dependencies
bun install

# Development mode (with hot reload)
bun run dev

# Build for production
bun run build

# Type checking
bun run compile

# Package for distribution
bun run zip
```

### Testing Your Adapter

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `.output/chrome-mv3` directory
5. Navigate to your target site
6. Verify buttons appear on images
7. Test annotation workflow: create, edit, rotate, resize, export

### Key Development Files

| File | Purpose |
|------|---------|
| `src/core/adapters/types.ts` | Interface definitions for adapters |
| `src/core/adapters/registry.ts` | Adapter registration and URL matching |
| `src/core/ui/button.ts` | Button factory with Shadow DOM isolation |
| `src/adapters/gemini.ts` | Reference implementation for Gemini |
| `entrypoints/content.tsx` | Main content script (adapter loader) |

---

## Recent Changes (v0.3.1)

- **Git-based versioning** - Popup displays version from git tags
- **Reload Extension + Page** - One-click reload for development workflow
- **Light/Dark theme toggle** - Popup respects user preference
- **Updated branding** - New tagline and multi-platform focus

## Previous Release (v0.3.0-beta)

This release focuses on the extensible architecture and critical rotation/resize fixes:

### Extensible Architecture
- Implemented Adapter Pattern for multi-site support
- Separated site-agnostic core from site-specific adapters
- Created reference implementation for Google Gemini
- Established clear interface for adding new sites

### Rotation & Resize Improvements
- Fixed anchor-locked resize for rotated annotations
- Corrected rotation offset calculations using new bounds
- Fixed single-dimension resize for edge handles on rotated shapes
- Eliminated incorrect rotation artifacts during offset conversion
- Improved visual feedback for rotation with snap-to-angle

### UI/UX Enhancements
- Relative positioning for lightbox buttons in flex containers
- Added margin to prevent button overlap in dialog views
- Maintained Shadow DOM isolation for style protection

---

## Technical Details

### Shadow DOM Isolation

All injected buttons use closed Shadow DOM to prevent:
- Host page CSS from affecting Deixis styles
- Deixis styles from leaking to host page
- JavaScript conflicts with host page

### Annotation Engine

The core annotation engine is completely site-agnostic and includes:
- **Canvas-based rendering** for smooth performance
- **Rotation-aware transformations** with correct anchor locking
- **Multi-layer state management** (drawing, selection, editing)
- **Undo/redo stack** for full edit history
- **Export pipeline** with high-quality PNG encoding

### Adapter Interface

The `SiteAdapter` interface provides a clean contract:

```typescript
interface SiteAdapter {
  id: string;                    // Unique identifier
  name: string;                  // Human-readable name
  matches: string[];             // URL patterns

  init(): void;                  // Initialize on page load
  destroy(): void;               // Cleanup

  findImages(): AnnotatableImage[];  // Locate images
  getButtonInjectionPoint(image): ButtonInjectionConfig | null;  // Button positioning
  getLightboxInjectionPoint?(): ButtonInjectionConfig | null;    // Lightbox support
  observeImageChanges(callback): () => void;  // Dynamic content watching
  processImageUrl?(url): string | Promise<string>;  // URL processing
}
```

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

## Contributing

Contributions are welcome, especially new site adapters.

### Adding a New Site Adapter

1. Fork the repository
2. Create adapter file in `src/adapters/yoursite.ts`
3. Follow the `SiteAdapter` interface
4. Use `src/adapters/gemini.ts` as reference
5. Register in `src/core/adapters/registry.ts`
6. Add host permissions to `wxt.config.ts`
7. Test thoroughly
8. Submit pull request with:
   - Adapter implementation
   - Documentation update
   - Screenshots of working integration

### Guidelines

- Keep adapters focused on DOM interaction only
- No site-specific business logic in core engine
- Maintain Shadow DOM isolation for buttons
- Test with dynamically loaded images
- Verify lightbox/modal support if applicable

---

## Browser Support

- Chrome 88+
- Edge 88+
- Firefox (experimental) - use `bun run build:firefox`

---

## License

MIT License - See [LICENSE](LICENSE) file for details

---

## Acknowledgments

- Design inspired by modern Chrome DevTools and Figma's annotation tools
- Icon set based on Lucide/Phosphor style guidelines
- Built with [WXT Framework](https://wxt.dev/) for modern extension development
- Annotation engine architecture informed by rotation/transformation best practices

---

## Roadmap

### Upcoming Site Adapters
- ChatGPT / OpenAI
- Claude.ai (Anthropic)
- Midjourney
- Leonardo.ai
- Pika.art

### Feature Enhancements
- Text annotation tool with editable labels
- Multi-select for bulk operations
- Annotation layers with visibility toggle
- Export with annotation metadata (JSON)
- Collaborative annotation sharing

---

**Built with precision. Designed for clarity.**
