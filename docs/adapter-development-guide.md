# Site Adapter Development Guide

**Version:** 0.3.2
**Last Updated:** January 2026

---

## Introduction

This guide walks you through creating a site adapter for Deixis. A site adapter enables the Deixis annotation system to work on a specific website by providing site-specific DOM selectors and button injection logic.

**Time to create an adapter:** 30 minutes - 2 hours (depending on site complexity)

**Lines of code:** Typically 50-100 lines

---

## Prerequisites

### Knowledge Requirements

- Basic TypeScript syntax
- CSS selectors (querySelector API)
- Browser DevTools (Elements inspector)
- Chrome extension content script concepts

### Development Environment

- Bun runtime installed
- Chrome browser with DevTools
- Code editor with TypeScript support (VS Code recommended)
- Deixis repository cloned locally

---

## Adapter Development Workflow

```
1. Investigate Site Structure (Browser DevTools)
   ↓
2. Create Adapter File (TypeScript)
   ↓
3. Implement SiteAdapter Interface
   ↓
4. Register Adapter in Registry
   ↓
5. Add Host Permissions
   ↓
6. Build and Test
   ↓
7. Iterate and Refine
```

---

## Step-by-Step Guide

### Step 1: Investigate Site Structure

Before writing any code, you need to understand how images are structured on the target site.

#### 1.1 Navigate to Target Site

Open the website in Chrome and find a page with images you want to annotate.

**Example Sites:**
- ChatGPT: `https://chat.openai.com/` (AI-generated images in conversation)
- Claude: `https://claude.ai/` (images in chat messages)
- Midjourney: `https://www.midjourney.com/` (gallery images)

#### 1.2 Open DevTools

- Press `F12` or `Cmd+Opt+I` (Mac) / `Ctrl+Shift+I` (Windows)
- Click "Elements" tab

#### 1.3 Inspect Image Elements

Right-click an image and select "Inspect Element"

**Look for:**
- Image element: `<img>` tag
- Container elements: Parent `<div>` or other wrappers
- Consistent class names or data attributes
- Layout structure (flex, grid, absolute positioning)

#### 1.4 Find Patterns

Run these queries in the Console tab:

```javascript
// Find all images
document.querySelectorAll('img')

// Find images with specific attributes
document.querySelectorAll('img[src*="generated"]')

// Find image containers with class patterns
document.querySelectorAll('.message-content img')
document.querySelectorAll('[data-testid*="image"]')

// Inspect parent structure
const img = document.querySelector('img');
console.log(img.closest('[class*="container"]'));
```

#### 1.5 Document Your Findings

Create a notes file with:

```
Site: ChatGPT
URL Pattern: https://chat.openai.com/*

Image Structure:
- Images appear in: <div class="message-content">
- Image tag: <img class="rounded-lg" src="...">
- Container hierarchy:
  <div data-message-id="...">
    <div class="message-content">
      <div class="image-wrapper">
        <img src="...">

Selectors to use:
- Images: [data-message-id] img
- Container: img.closest('[data-message-id]')

Button injection point:
- Insert into: .image-wrapper
- Position: absolute top-left
- Show on hover: yes
```

---

### Step 2: Create Adapter File

Create a new file in `src/adapters/`:

```bash
touch src/adapters/chatgpt.ts
```

**Naming Convention**: Use lowercase, hyphenated names matching site domain
- `gemini.ts` for gemini.google.com
- `chatgpt.ts` for chat.openai.com
- `claude.ts` for claude.ai

---

### Step 3: Implement SiteAdapter Interface

#### 3.1 Basic Template

Start with this template:

```typescript
/**
 * [Site Name] Adapter
 * Site-specific DOM handling for [site description]
 */

import type { SiteAdapter, AnnotatableImage, ButtonInjectionConfig } from '../core/adapters/types';

export const [sitename]Adapter: SiteAdapter = {
  id: '[sitename]',
  name: '[Site Display Name]',
  matches: ['https://[domain]/*'],

  init() {
    console.log('[Deixis] [Site Name] adapter initialized');
  },

  destroy() {
    // Cleanup if needed
  },

  findImages(): AnnotatableImage[] {
    const images: AnnotatableImage[] = [];
    // TODO: Implement image detection
    return images;
  },

  getButtonInjectionPoint(image: HTMLImageElement): ButtonInjectionConfig | null {
    // TODO: Implement button positioning
    return null;
  },

  observeImageChanges(callback: (images: AnnotatableImage[]) => void): () => void {
    // TODO: Implement mutation observer
    const observer = new MutationObserver(() => {
      callback(this.findImages());
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  },
};
```

#### 3.2 Implement `findImages()`

This method must return all annotatable images on the page.

**Pattern 1: Images in Containers**

```typescript
findImages(): AnnotatableImage[] {
  const images: AnnotatableImage[] = [];

  // Use site-specific selector for containers
  const containers = document.querySelectorAll('.image-container');

  containers.forEach(container => {
    const img = container.querySelector('img') as HTMLImageElement;

    if (img && img.src && !img.src.startsWith('data:')) {
      images.push({
        element: img,
        url: img.src,
        bounds: img.getBoundingClientRect(),
        container: container as HTMLElement,
      });
    }
  });

  return images;
}
```

**Pattern 2: Direct Image Selection**

```typescript
findImages(): AnnotatableImage[] {
  const images: AnnotatableImage[] = [];

  // Select images directly with specific attributes
  const imageElements = document.querySelectorAll('img[data-type="generated"]');

  imageElements.forEach(img => {
    const imgEl = img as HTMLImageElement;

    if (imgEl.src && imgEl.naturalWidth > 100) {  // Filter thumbnails
      images.push({
        element: imgEl,
        url: imgEl.src,
        bounds: imgEl.getBoundingClientRect(),
        container: imgEl.parentElement || undefined,
      });
    }
  });

  return images;
}
```

**Pattern 3: Multiple Image Sources**

```typescript
findImages(): AnnotatableImage[] {
  const images: AnnotatableImage[] = [];

  // Method 1: Chat message images
  document.querySelectorAll('.message img').forEach(img => {
    const imgEl = img as HTMLImageElement;
    if (imgEl.src) {
      images.push({
        element: imgEl,
        url: imgEl.src,
        bounds: imgEl.getBoundingClientRect(),
        container: imgEl.closest('.message') as HTMLElement,
      });
    }
  });

  // Method 2: Gallery images
  document.querySelectorAll('.gallery-item img').forEach(img => {
    const imgEl = img as HTMLImageElement;
    if (imgEl.src) {
      images.push({
        element: imgEl,
        url: imgEl.src,
        bounds: imgEl.getBoundingClientRect(),
        container: imgEl.closest('.gallery-item') as HTMLElement,
      });
    }
  });

  return images;
}
```

**Best Practices:**

- Filter out icons, avatars, thumbnails (check `naturalWidth`, `src` pattern)
- Avoid data URLs (`img.src.startsWith('data:')`)
- Handle missing containers gracefully
- Use type assertions for HTMLElement (`as HTMLElement`)

#### 3.3 Implement `getButtonInjectionPoint()`

This method determines where the annotation button should appear for each image.

**Pattern 1: Absolute Positioning in Container**

```typescript
getButtonInjectionPoint(image: HTMLImageElement): ButtonInjectionConfig | null {
  const container = image.closest('.image-wrapper') as HTMLElement;
  if (!container) return null;

  return {
    container,
    position: 'prepend',  // Insert as first child
    style: {
      position: 'absolute',
      top: '12px',
      left: '12px',
      zIndex: '9999',
    },
    showOnHover: true,
    hoverTarget: container,  // Show button when hovering container
  };
}
```

**Pattern 2: Relative Positioning (Flex/Grid Layouts)**

```typescript
getButtonInjectionPoint(image: HTMLImageElement): ButtonInjectionConfig | null {
  const container = image.parentElement as HTMLElement;
  if (!container) return null;

  return {
    container,
    position: 'prepend',
    style: {
      position: 'relative',
      marginRight: '8px',  // Space from next element
    },
    showOnHover: false,  // Always visible
  };
}
```

**Pattern 3: Before/After Injection**

```typescript
getButtonInjectionPoint(image: HTMLImageElement): ButtonInjectionConfig | null {
  const container = image.parentElement as HTMLElement;
  if (!container) return null;

  return {
    container,
    position: 'before',  // Insert before container
    style: {
      position: 'absolute',
      top: '8px',
      right: '8px',
      zIndex: '100',
    },
    showOnHover: true,
    hoverTarget: container.parentElement as HTMLElement,
  };
}
```

**Positioning Options:**

| Position | Behavior | Use Case |
|----------|----------|----------|
| `prepend` | Insert as first child | Absolute positioned button inside container |
| `append` | Insert as last child | Button after image in flex layout |
| `before` | Insert before container | Button outside container |
| `after` | Insert after container | Button below image |

**Style Guidelines:**

- Use `position: absolute` for overlay buttons
- Use `position: relative` for inline buttons
- Set `zIndex: 9999` for overlays
- Use `top`, `left`, `right`, `bottom` for positioning
- Add margins for spacing in flex/grid layouts

#### 3.4 Implement `getLightboxInjectionPoint()` (Optional)

If the site has lightbox/modal views for images, implement this method.

```typescript
getLightboxInjectionPoint(): ButtonInjectionConfig | null {
  // Find lightbox container (common patterns)
  const lightboxActions = document.querySelector('.modal-actions, .dialog-buttons, [role="dialog"] .actions') as HTMLElement;

  if (!lightboxActions) return null;

  return {
    container: lightboxActions,
    position: 'prepend',
    showOnHover: false,  // Always visible in modal
    style: {
      position: 'relative',
      marginRight: '8px',
    },
  };
}
```

**Detection Tips:**

- Look for modals: `[role="dialog"]`, `.modal`, `.overlay`
- Find action buttons: `.modal-footer`, `.dialog-actions`
- Test by clicking image to open lightbox, then inspect

#### 3.5 Implement `observeImageChanges()`

Watch for dynamically loaded images (infinite scroll, AJAX, SPA navigation).

**Standard Implementation:**

```typescript
observeImageChanges(callback: (images: AnnotatableImage[]) => void): () => void {
  const observer = new MutationObserver(() => {
    callback(this.findImages());
  });

  observer.observe(document.body, {
    childList: true,    // Watch for added/removed nodes
    subtree: true,      // Watch entire tree
  });

  return () => observer.disconnect();
}
```

**Optimized Implementation (with debounce):**

```typescript
observeImageChanges(callback: (images: AnnotatableImage[]) => void): () => void {
  let timeoutId: number;

  const observer = new MutationObserver(() => {
    // Debounce: only call callback after 200ms of no changes
    clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => {
      callback(this.findImages());
    }, 200);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  return () => {
    observer.disconnect();
    clearTimeout(timeoutId);
  };
}
```

**Targeted Observation (Performance):**

```typescript
observeImageChanges(callback: (images: AnnotatableImage[]) => void): () => void {
  const observer = new MutationObserver(() => {
    callback(this.findImages());
  });

  // Only observe specific container (not entire body)
  const container = document.querySelector('#chat-messages');
  if (container) {
    observer.observe(container, { childList: true, subtree: true });
  }

  return () => observer.disconnect();
}
```

#### 3.6 Implement `processImageUrl()` (Optional)

Transform image URLs if needed (CDN URLs, proxy URLs, authentication).

```typescript
processImageUrl(url: string): string {
  // Example: Convert thumbnail URL to full-size URL
  return url.replace('/thumbnails/', '/images/').replace('_thumb.jpg', '.jpg');
}

// Async example for fetching signed URLs
async processImageUrl(url: string): Promise<string> {
  if (url.startsWith('/api/image/')) {
    const response = await fetch(url);
    const data = await response.json();
    return data.signedUrl;
  }
  return url;
}
```

---

### Step 4: Register Adapter

Add your adapter to the registry:

```typescript
// src/core/adapters/registry.ts

import type { SiteAdapter } from './types';
import { geminiAdapter } from '../../adapters/gemini';
import { chatgptAdapter } from '../../adapters/chatgpt';  // Import your adapter

export const siteAdapters: SiteAdapter[] = [
  geminiAdapter,
  chatgptAdapter,  // Add to array
];
```

---

### Step 5: Add Host Permissions

Update `wxt.config.ts` to include your site's URL:

```typescript
// wxt.config.ts

export default defineConfig({
  // ... other config
  manifest: {
    // ... other manifest fields
    host_permissions: [
      'https://gemini.google.com/*',
      'https://chat.openai.com/*',  // Add your site
      'https://chatgpt.com/*',      // Include all URL variants
    ],
  },
});
```

---

### Step 6: Build and Test

#### 6.1 Build Extension

```bash
bun run build
```

Check for TypeScript errors. Fix any type mismatches.

#### 6.2 Load Extension in Chrome

1. Navigate to `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select `.output/chrome-mv3` directory

#### 6.3 Test on Target Site

1. Navigate to your target site (e.g., `https://chat.openai.com/`)
2. Open DevTools Console
3. Look for initialization message: `[Deixis] ChatGPT adapter initialized`
4. Verify buttons appear on images (hover if `showOnHover: true`)
5. Click button to open annotation overlay
6. Test full workflow: draw → rotate → resize → export

#### 6.4 Debug Issues

**No buttons appearing:**
- Check Console for errors
- Verify `findImages()` returns images: Add `console.log(this.findImages())` in `findImages()`
- Check URL pattern matches: `window.location.href` should match pattern in `matches`
- Verify host permissions in `chrome://extensions/` → Extension details

**Buttons in wrong position:**
- Inspect button element in DevTools
- Check computed styles (may be overridden by host page)
- Adjust `zIndex`, `position`, or `top/left/right/bottom` values
- Try different `position` value ('prepend' vs 'before')

**Buttons not appearing on new images:**
- Check `observeImageChanges()` is being called
- Add console.log in observer callback to verify it fires
- Test scrolling/loading more content

**Annotation overlay not opening:**
- Check image URL is valid (not data URL)
- Look for errors in Console when button clicked
- Verify `onClick` handler fires (add console.log in button.ts)

---

### Step 7: Iterate and Refine

#### Test Edge Cases

- [ ] Images loaded after page load (infinite scroll)
- [ ] Images in modals/lightboxes
- [ ] Multiple images in same container
- [ ] Very small images (icons, avatars) - should be filtered out
- [ ] Images with unusual URL formats
- [ ] Page navigation (SPA route changes)

#### Performance Testing

- [ ] Page with 50+ images loads smoothly
- [ ] MutationObserver doesn't cause lag
- [ ] Button injection completes in < 100ms

#### Polish

- [ ] Remove console.log statements (or use conditional logging)
- [ ] Add JSDoc comments for complex selectors
- [ ] Test on different screen sizes
- [ ] Verify keyboard accessibility (Tab to button, Enter to activate)

---

## Example Adapters

### Example 1: Simple Static Site

```typescript
// src/adapters/static-gallery.ts

import type { SiteAdapter, AnnotatableImage, ButtonInjectionConfig } from '../core/adapters/types';

export const staticGalleryAdapter: SiteAdapter = {
  id: 'static-gallery',
  name: 'Static Gallery',
  matches: ['https://gallery.example.com/*'],

  init() {
    console.log('[Deixis] Static Gallery adapter initialized');
  },

  destroy() {},

  findImages(): AnnotatableImage[] {
    const images: AnnotatableImage[] = [];
    const imageElements = document.querySelectorAll('.gallery img');

    imageElements.forEach(img => {
      const imgEl = img as HTMLImageElement;
      images.push({
        element: imgEl,
        url: imgEl.src,
        bounds: imgEl.getBoundingClientRect(),
        container: imgEl.parentElement || undefined,
      });
    });

    return images;
  },

  getButtonInjectionPoint(image: HTMLImageElement): ButtonInjectionConfig | null {
    const container = image.parentElement;
    if (!container) return null;

    return {
      container,
      position: 'prepend',
      style: {
        position: 'absolute',
        top: '8px',
        right: '8px',
        zIndex: '100',
      },
      showOnHover: true,
      hoverTarget: container,
    };
  },

  observeImageChanges(callback) {
    const observer = new MutationObserver(() => callback(this.findImages()));
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  },
};
```

### Example 2: Complex Dynamic Site

```typescript
// src/adapters/ai-chat.ts

import type { SiteAdapter, AnnotatableImage, ButtonInjectionConfig } from '../core/adapters/types';

export const aiChatAdapter: SiteAdapter = {
  id: 'ai-chat',
  name: 'AI Chat Platform',
  matches: ['https://chat.ai.example.com/*'],

  init() {
    console.log('[Deixis] AI Chat adapter initialized');
  },

  destroy() {},

  findImages(): AnnotatableImage[] {
    const images: AnnotatableImage[] = [];

    // Find images in chat messages
    const messageImages = document.querySelectorAll('[data-message-role="assistant"] img');

    messageImages.forEach(img => {
      const imgEl = img as HTMLImageElement;

      // Filter out small images (avatars, icons)
      if (imgEl.naturalWidth < 100 || imgEl.naturalHeight < 100) return;

      // Filter out data URLs
      if (imgEl.src.startsWith('data:')) return;

      const container = imgEl.closest('[data-message-id]') as HTMLElement;

      images.push({
        element: imgEl,
        url: imgEl.src,
        bounds: imgEl.getBoundingClientRect(),
        container,
      });
    });

    return images;
  },

  getButtonInjectionPoint(image: HTMLImageElement): ButtonInjectionConfig | null {
    const imageWrapper = image.closest('.image-wrapper') as HTMLElement;
    if (!imageWrapper) return null;

    return {
      container: imageWrapper,
      position: 'prepend',
      style: {
        position: 'absolute',
        top: '12px',
        left: '12px',
        zIndex: '9999',
      },
      showOnHover: true,
      hoverTarget: imageWrapper,
    };
  },

  getLightboxInjectionPoint(): ButtonInjectionConfig | null {
    const lightboxActions = document.querySelector('[role="dialog"] .actions') as HTMLElement;
    if (!lightboxActions) return null;

    return {
      container: lightboxActions,
      position: 'prepend',
      showOnHover: false,
      style: {
        position: 'relative',
        marginRight: '8px',
      },
    };
  },

  observeImageChanges(callback) {
    let timeoutId: number;

    const observer = new MutationObserver(() => {
      clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        callback(this.findImages());
      }, 200);
    });

    const chatContainer = document.querySelector('#chat-messages');
    if (chatContainer) {
      observer.observe(chatContainer, { childList: true, subtree: true });
    }

    return () => {
      observer.disconnect();
      clearTimeout(timeoutId);
    };
  },

  processImageUrl(url: string): string {
    // Convert thumbnail URLs to full-size
    return url.replace('/thumb/', '/full/');
  },
};
```

---

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Buttons not appearing | Selector doesn't match images | Verify selectors in Console with `document.querySelectorAll()` |
| Buttons in wrong position | CSS conflicts or wrong positioning | Inspect computed styles, adjust `style` in ButtonInjectionConfig |
| Buttons disappear on scroll | Container removed from DOM | Use `observeImageChanges()` to re-inject |
| Extension not loading | Host permissions missing | Add URL to `host_permissions` in wxt.config.ts |
| TypeScript errors | Type mismatch or missing types | Add type assertions (`as HTMLElement`) |
| Performance issues | MutationObserver firing too often | Add debouncing or target specific container |

### Debugging Tips

**Enable verbose logging:**

```typescript
init() {
  console.log('[Deixis] Adapter initialized');
  console.log('[Deixis] Found images:', this.findImages());
}
```

**Inspect button injection:**

```typescript
getButtonInjectionPoint(image: HTMLImageElement): ButtonInjectionConfig | null {
  const container = image.closest('.container') as HTMLElement;
  console.log('[Deixis] Container for image:', container);

  if (!container) {
    console.warn('[Deixis] No container found for image:', image);
    return null;
  }

  // ... return config
}
```

**Test selectors in Console:**

```javascript
// Find all images
console.log(document.querySelectorAll('.message img'));

// Test container lookup
const img = document.querySelector('img');
console.log(img.closest('[data-message-id]'));

// Verify button injection point exists
console.log(document.querySelector('.modal-actions'));
```

---

## Best Practices

### Selectors

- Use specific selectors (prefer classes/data attributes over tag names)
- Avoid brittle selectors that depend on DOM hierarchy depth
- Test selectors in multiple scenarios (empty page, full page, after navigation)

### Performance

- Keep `findImages()` fast (avoid complex queries)
- Use targeted observation (observe specific container, not whole body)
- Debounce observer callbacks if site has frequent DOM changes

### Error Handling

- Always check for null/undefined before using DOM elements
- Return empty array from `findImages()` if no images found (don't throw)
- Return null from `getButtonInjectionPoint()` if container missing

### Maintainability

- Add comments explaining unusual selectors
- Document site-specific quirks
- Include URL to site in file header for easy reference

---

## Checklist for Submission

Before submitting a new adapter:

- [ ] Adapter implements all required methods of `SiteAdapter` interface
- [ ] Adapter registered in `src/core/adapters/registry.ts`
- [ ] Host permissions added to `wxt.config.ts`
- [ ] TypeScript compiles without errors (`bun run compile`)
- [ ] Extension builds successfully (`bun run build`)
- [ ] Tested on actual site with multiple images
- [ ] Buttons appear correctly on hover/always
- [ ] Annotation overlay opens when button clicked
- [ ] Full annotation workflow tested (draw, edit, export)
- [ ] Lightbox support tested (if applicable)
- [ ] Dynamic image loading tested (if applicable)
- [ ] Console has no errors
- [ ] Code follows existing adapter patterns (see `gemini.ts`)

---

## Getting Help

### Resources

- Review `src/adapters/gemini.ts` for reference implementation
- Check `src/core/adapters/types.ts` for interface documentation
- See `docs/architecture.md` for system overview

### Common Questions

**Q: How do I handle images loaded after page load?**
A: Implement `observeImageChanges()` with a MutationObserver.

**Q: What if the site uses Shadow DOM for images?**
A: Query within shadow roots: `element.shadowRoot?.querySelector('img')`

**Q: How do I test without publishing the extension?**
A: Use "Load unpacked" in Developer mode to load from local build output.

**Q: Can I support multiple URL patterns for one site?**
A: Yes, add multiple patterns to `matches` array: `['https://site.com/*', 'https://www.site.com/*']`

**Q: What if image URLs require authentication?**
A: Implement `processImageUrl()` to fetch authenticated URLs or transform proxy URLs.

---

## Conclusion

You now have everything you need to create a site adapter for Deixis. The process is straightforward:

1. Investigate the site's DOM structure
2. Implement the `SiteAdapter` interface
3. Register and test

Most adapters take 30 minutes to 2 hours to complete. Start with a simple implementation and iterate based on testing.

Happy adapter building!

---

**Document Version:** 1.0
**Last Updated:** January 2026
