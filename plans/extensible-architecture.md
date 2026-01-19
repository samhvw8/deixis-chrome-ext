# Extensible Multi-Site Architecture Plan

**Date:** 2026-01-19
**Status:** Proposed
**Objective:** Design a modular architecture that allows Deixis annotation system to work across multiple websites (ChatGPT, Higgsfield.ai, etc.)

---

## Executive Summary

The current Deixis codebase is tightly coupled to Gemini.google.com. This plan defines an **Adapter Pattern** architecture that separates site-agnostic annotation logic (Core Engine) from site-specific DOM handling (Site Adapters), enabling easy extension to new websites.

---

## Current State Analysis

### Codebase Structure

```
entrypoints/
  content.tsx              # Main content script (SITE-SPECIFIC)
  background.ts            # Background service worker (PARTIALLY SITE-SPECIFIC)
  popup/                   # Extension popup (GENERIC)
  content/
    components/
      AnnotationOverlay.tsx    # Canvas annotation engine (GENERIC)
      AnnotationToolbar.tsx    # Tool selection UI (GENERIC)
      ColorPicker.tsx          # Color picker UI (GENERIC)
      ToolButton.tsx           # Button component (GENERIC)
      Toast.tsx                # Notification (GENERIC)
      Divider.tsx              # UI divider (GENERIC)
      index.ts                 # Component exports (GENERIC)
    icons/
      index.tsx                # Icon components (GENERIC)
    styles.css                 # Shadow DOM styles (GENERIC)
```

### Coupling Analysis

| Location | Component | Site-Specific | Generic | Notes |
|----------|-----------|---------------|---------|-------|
| `content.tsx` | `matches` pattern | **YES** | - | Hardcoded `gemini.google.com/*` |
| `content.tsx` | `injectDeixisButtons()` | **YES** | - | `.overlay-container` selector |
| `content.tsx` | `injectLightboxButton()` | **YES** | - | `.generated-image-expansion-dialog-action-buttons` selector |
| `content.tsx` | Image detection | **YES** | - | `img.image` selector |
| `content.tsx` | Shadow DOM overlay | - | **YES** | Generic container injection |
| `content.tsx` | `openAnnotation()` | - | **YES** | Takes imageUrl + bounds |
| `content.tsx` | `closeAnnotation()` | - | **YES** | Generic cleanup |
| `content.tsx` | `handleCopy/handleSave` | - | **YES** | Generic clipboard/download |
| `background.ts` | Context menu | **YES** | - | `documentUrlPatterns` hardcoded |
| `background.ts` | Tab capture | - | **YES** | Generic screenshot |
| `AnnotationOverlay.tsx` | All logic | - | **YES** | Completely site-agnostic |
| `AnnotationToolbar.tsx` | All logic | - | **YES** | Completely site-agnostic |

### Key Findings

1. **80% of code is already generic** - The annotation engine, toolbar, and UI components have no site dependencies
2. **Site coupling is concentrated** in 3 areas:
   - URL matching patterns
   - DOM selectors for button injection
   - Image element detection
3. **No configuration system** exists for site-specific behavior

---

## Proposed Architecture

### High-Level Design

```
                           +------------------+
                           |   WXT Config     |
                           |  (multi-site)    |
                           +--------+---------+
                                    |
         +---------------------+----+----+---------------------+
         |                     |         |                     |
+--------v--------+   +--------v--------+   +--------v--------+
|  Gemini Adapter |   | ChatGPT Adapter |   | Higgsfield Adapt|
|  (gemini.ts)    |   |  (chatgpt.ts)   |   | (higgsfield.ts) |
+--------+--------+   +--------+--------+   +--------+---------+
         |                     |                     |
         +----------+----------+----------+----------+
                    |                     |
         +----------v----------+ +--------v---------+
         |    Adapter Loader   | |  Site Registry   |
         |  (detects current)  | | (site configs)   |
         +----------+----------+ +--------+---------+
                    |                     |
         +----------v---------------------v----------+
         |              Core Engine                  |
         |  +---------------+ +-------------------+  |
         |  | Overlay Mgr   | | Annotation Engine |  |
         |  | (shadow DOM)  | | (canvas + state)  |  |
         |  +---------------+ +-------------------+  |
         +-------------------------------------------+
```

### Layer Responsibilities

| Layer | Responsibility | Changes Needed |
|-------|---------------|----------------|
| **WXT Config** | Declare all supported site URL patterns | Extend `matches` array |
| **Site Adapters** | DOM selectors, button injection, image detection | NEW: Create adapter files |
| **Adapter Loader** | Detect current site, load correct adapter | NEW: Create loader |
| **Site Registry** | Configuration map for all supported sites | NEW: Create registry |
| **Core Engine** | Annotation logic, UI rendering, state management | REFACTOR: Extract from content.tsx |

---

## Component Designs

### 1. Site Adapter Interface

```typescript
// src/core/adapters/types.ts

export interface SiteAdapter {
  /** Unique site identifier */
  id: string;

  /** Human-readable site name */
  name: string;

  /** URL patterns this adapter handles */
  matches: string[];

  /** Initialize adapter on page load */
  init(): void;

  /** Clean up on unload */
  destroy(): void;

  /** Find all annotatable images on page */
  findImages(): AnnotatableImage[];

  /** Get injection point for annotation button on image container */
  getButtonInjectionPoint(image: HTMLImageElement): ButtonInjectionConfig | null;

  /** Get injection point for lightbox/dialog button */
  getLightboxInjectionPoint?(): ButtonInjectionConfig | null;

  /** Watch for dynamically loaded images */
  observeImageChanges(callback: (images: AnnotatableImage[]) => void): () => void;

  /** Site-specific image URL processing (handle CDN, proxies, etc.) */
  processImageUrl?(url: string): string | Promise<string>;
}

export interface AnnotatableImage {
  element: HTMLImageElement;
  url: string;
  bounds: DOMRect;
  container?: HTMLElement;
}

export interface ButtonInjectionConfig {
  /** Container element to inject button into */
  container: HTMLElement;
  /** Where to insert button relative to container */
  position: 'prepend' | 'append' | 'before' | 'after';
  /** CSS positioning for button (absolute, relative, etc.) */
  style?: Partial<CSSStyleDeclaration>;
  /** Show button on hover only */
  showOnHover?: boolean;
  /** Element to attach hover listeners to (defaults to container) */
  hoverTarget?: HTMLElement;
}
```

### 2. Gemini Adapter (Reference Implementation)

```typescript
// src/adapters/gemini.ts

import type { SiteAdapter, AnnotatableImage, ButtonInjectionConfig } from '../core/adapters/types';

export const geminiAdapter: SiteAdapter = {
  id: 'gemini',
  name: 'Google Gemini',
  matches: ['https://gemini.google.com/*'],

  init() {
    console.log('[Deixis] Gemini adapter initialized');
  },

  destroy() {
    // Cleanup if needed
  },

  findImages(): AnnotatableImage[] {
    const images: AnnotatableImage[] = [];
    const containers = document.querySelectorAll('.overlay-container');

    containers.forEach(container => {
      const img = container.querySelector('img.image') as HTMLImageElement;
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
    const container = image.closest('.overlay-container') as HTMLElement;
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

  getLightboxInjectionPoint(): ButtonInjectionConfig | null {
    const container = document.querySelector('.generated-image-expansion-dialog-action-buttons') as HTMLElement;
    if (!container) return null;

    return {
      container,
      position: 'prepend',
      showOnHover: false,
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

### 3. ChatGPT Adapter (Example)

```typescript
// src/adapters/chatgpt.ts

import type { SiteAdapter, AnnotatableImage, ButtonInjectionConfig } from '../core/adapters/types';

export const chatgptAdapter: SiteAdapter = {
  id: 'chatgpt',
  name: 'ChatGPT',
  matches: ['https://chat.openai.com/*', 'https://chatgpt.com/*'],

  init() {
    console.log('[Deixis] ChatGPT adapter initialized');
  },

  destroy() {},

  findImages(): AnnotatableImage[] {
    const images: AnnotatableImage[] = [];

    // ChatGPT uses <img> tags inside message containers
    // Selector will need investigation on actual site
    const messageImages = document.querySelectorAll('[data-message-author-role] img');

    messageImages.forEach(img => {
      const imgEl = img as HTMLImageElement;
      if (imgEl.src && !imgEl.src.startsWith('data:')) {
        images.push({
          element: imgEl,
          url: imgEl.src,
          bounds: imgEl.getBoundingClientRect(),
          container: imgEl.parentElement || undefined,
        });
      }
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
        left: '8px',
        zIndex: '100',
      },
      showOnHover: true,
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

### 4. Site Registry

```typescript
// src/core/adapters/registry.ts

import type { SiteAdapter } from './types';
import { geminiAdapter } from '../../adapters/gemini';
import { chatgptAdapter } from '../../adapters/chatgpt';
// import { higgsFieldAdapter } from '../../adapters/higgsfield';

/**
 * Registry of all supported site adapters
 * Add new adapters here to enable Deixis on additional sites
 */
export const siteAdapters: SiteAdapter[] = [
  geminiAdapter,
  chatgptAdapter,
  // higgsFieldAdapter,
];

/**
 * Get all URL patterns for manifest.json
 */
export function getAllMatches(): string[] {
  return siteAdapters.flatMap(adapter => adapter.matches);
}

/**
 * Find adapter for current page
 */
export function getAdapterForUrl(url: string): SiteAdapter | null {
  for (const adapter of siteAdapters) {
    for (const pattern of adapter.matches) {
      if (matchesPattern(url, pattern)) {
        return adapter;
      }
    }
  }
  return null;
}

/**
 * Match URL against Chrome extension pattern
 */
function matchesPattern(url: string, pattern: string): boolean {
  // Convert Chrome pattern to regex
  const regexPattern = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special chars
    .replace(/\*/g, '.*'); // Convert * to .*

  return new RegExp(`^${regexPattern}$`).test(url);
}
```

### 5. Adapter Loader (Refactored Content Script)

```typescript
// entrypoints/content.tsx (REFACTORED)

import React from 'react';
import ReactDOM from 'react-dom/client';
import { AnnotationOverlay } from './content/components/AnnotationOverlay';
import { getAdapterForUrl } from '../src/core/adapters/registry';
import type { SiteAdapter, AnnotatableImage } from '../src/core/adapters/types';
import { createDeixisButton, getOverlayStyles } from '../src/core/ui';

const DEIXIS_CONTAINER_ID = 'deixis-annotation-root';
const DEIXIS_BUTTON_CLASS = 'deixis-host';

let reactRoot: ReactDOM.Root | null = null;
let shadowRoot: ShadowRoot | null = null;
let isAnnotationOpen = false;
let currentAdapter: SiteAdapter | null = null;
let cleanupObserver: (() => void) | null = null;

/**
 * Initialize Deixis with the appropriate site adapter
 */
function initializeDeixis() {
  const adapter = getAdapterForUrl(window.location.href);

  if (!adapter) {
    console.warn('[Deixis] No adapter found for this site');
    return;
  }

  currentAdapter = adapter;
  console.log(`[Deixis] Loaded adapter: ${adapter.name}`);

  // Initialize adapter
  adapter.init();

  // Initial button injection
  injectButtons();

  // Watch for new images
  cleanupObserver = adapter.observeImageChanges(() => {
    injectButtons();
  });

  // Setup message listeners
  setupMessageListener();

  // Notify background
  browser.runtime.sendMessage({
    type: 'DEIXIS_READY',
    adapterId: adapter.id,
  });
}

/**
 * Inject annotation buttons for all images on page
 */
function injectButtons() {
  if (!currentAdapter) return;

  const images = currentAdapter.findImages();

  images.forEach(({ element, url, container }) => {
    // Skip if already injected
    if (container?.querySelector(`.${DEIXIS_BUTTON_CLASS}`)) return;

    const config = currentAdapter.getButtonInjectionPoint(element);
    if (!config) return;

    const button = createDeixisButton({
      onClick: () => openAnnotation(url, element.getBoundingClientRect()),
      style: config.style,
      showOnHover: config.showOnHover,
      hoverTarget: config.hoverTarget || config.container,
    });

    // Inject button
    switch (config.position) {
      case 'prepend':
        config.container.insertBefore(button, config.container.firstChild);
        break;
      case 'append':
        config.container.appendChild(button);
        break;
      case 'before':
        config.container.parentElement?.insertBefore(button, config.container);
        break;
      case 'after':
        config.container.parentElement?.insertBefore(button, config.container.nextSibling);
        break;
    }
  });

  // Lightbox button
  const lightboxConfig = currentAdapter.getLightboxInjectionPoint?.();
  if (lightboxConfig && !lightboxConfig.container.querySelector(`.${DEIXIS_BUTTON_CLASS}`)) {
    // Find current lightbox image
    const lightboxImg = document.querySelector('.expansion-dialog img, .cdk-overlay-pane img') as HTMLImageElement;
    if (lightboxImg?.src) {
      const button = createDeixisButton({
        onClick: () => openAnnotation(lightboxImg.src),
        style: lightboxConfig.style,
        showOnHover: lightboxConfig.showOnHover,
        variant: 'large',
      });
      lightboxConfig.container.insertBefore(button, lightboxConfig.container.firstChild);
    }
  }
}

// ... rest of openAnnotation, closeAnnotation, handleCopy, handleSave
// remain the same (already generic)

export default defineContentScript({
  // Use dynamic matches from registry (configured in wxt.config.ts)
  matches: ['<all_urls>'], // Filtered by manifest host_permissions

  main() {
    initializeDeixis();
  },
});
```

### 6. Core UI Utilities

```typescript
// src/core/ui/button.ts

export interface DeixisButtonOptions {
  onClick: () => void;
  style?: Partial<CSSStyleDeclaration>;
  showOnHover?: boolean;
  hoverTarget?: HTMLElement;
  variant?: 'default' | 'large';
}

/**
 * Create a Deixis annotation button with Shadow DOM isolation
 */
export function createDeixisButton(options: DeixisButtonOptions): HTMLElement {
  const host = document.createElement('div');
  host.className = 'deixis-host';

  const shadow = host.attachShadow({ mode: 'closed' });

  const isLarge = options.variant === 'large';
  const size = isLarge ? 48 : 32;

  shadow.innerHTML = `
    <style>
      :host {
        position: absolute;
        z-index: 9999;
        opacity: ${options.showOnHover ? '0' : '1'};
        transition: opacity 0.2s ease;
        pointer-events: auto;
      }
      :host(.visible) {
        opacity: 1;
      }
      .deixis-btn {
        width: ${size}px;
        height: ${size}px;
        border-radius: 9999px;
        background: rgba(60, 64, 67, 0.75);
        color: rgb(196, 199, 197);
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s ease, color 0.2s ease;
        pointer-events: auto;
      }
      .deixis-btn:hover {
        background: rgba(34, 197, 94, 0.9);
        color: white;
      }
      .deixis-btn svg {
        width: ${isLarge ? 24 : 18}px;
        height: ${isLarge ? 24 : 18}px;
        fill: currentColor;
      }
    </style>
    <button class="deixis-btn" aria-label="Annotate with Deixis" title="Annotate with Deixis">
      <svg viewBox="0 0 24 24">
        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
      </svg>
    </button>
  `;

  // Apply custom styles
  if (options.style) {
    Object.assign(host.style, options.style);
  }

  // Hover visibility
  if (options.showOnHover && options.hoverTarget) {
    options.hoverTarget.addEventListener('mouseenter', () => host.classList.add('visible'));
    options.hoverTarget.addEventListener('mouseleave', () => host.classList.remove('visible'));
  }

  // Click handler
  const button = shadow.querySelector('.deixis-btn');
  button?.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    options.onClick();
  });

  return host;
}
```

### 7. Updated WXT Config

```typescript
// wxt.config.ts

import { defineConfig } from 'wxt';
import react from '@vitejs/plugin-react';
import { getAllMatches } from './src/core/adapters/registry';

export default defineConfig({
  vite: () => ({
    plugins: [
      react({
        jsxRuntime: 'classic',
      }),
    ],
  }),
  manifest: {
    name: 'Deixis - Visual Annotation',
    description: 'Draw visual annotations on images to communicate intent precisely',
    version: '2.0.0',
    permissions: ['activeTab', 'contextMenus', 'clipboardWrite', 'tabs'],
    host_permissions: [
      'https://gemini.google.com/*',
      'https://chat.openai.com/*',
      'https://chatgpt.com/*',
      'https://higgsfield.ai/*',
      // Add new sites here
    ],
  },
});
```

### 8. Updated Background Script

```typescript
// entrypoints/background.ts

import { getAllMatches } from '../src/core/adapters/registry';

export default defineBackground(() => {
  // Create context menu on install with all supported sites
  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.create({
      id: 'deixis-annotate',
      title: 'Annotate with Deixis',
      contexts: ['image'],
      // Include all adapter URL patterns
      documentUrlPatterns: getAllMatches(),
    });
  });

  // ... rest remains the same
});
```

---

## Proposed File Structure

```
src/
  core/
    adapters/
      types.ts           # SiteAdapter interface, AnnotatableImage, etc.
      registry.ts        # Adapter registration and URL matching
      index.ts           # Exports
    engine/
      overlay-manager.ts # Shadow DOM creation, React mounting
      annotation-state.ts # Annotation state management (extracted)
      index.ts
    ui/
      button.ts          # createDeixisButton factory
      styles.ts          # getOverlayStyles (extracted from content.tsx)
      index.ts
    types/
      index.ts           # Shared types

  adapters/
    gemini.ts            # Gemini adapter
    chatgpt.ts           # ChatGPT adapter
    higgsfield.ts        # Higgsfield adapter
    index.ts             # Adapter exports

entrypoints/
  content.tsx            # REFACTORED: Uses adapter loader pattern
  background.ts          # REFACTORED: Dynamic URL patterns
  popup/                 # Unchanged
  content/
    components/          # Unchanged (already generic)
    icons/               # Unchanged
    styles.css           # Unchanged
```

---

## Migration Path

### Phase 1: Extract Core Engine (1-2 days)

1. Create `src/core/` directory structure
2. Extract `getOverlayStyles()` to `src/core/ui/styles.ts`
3. Extract button creation to `src/core/ui/button.ts`
4. Define `SiteAdapter` interface in `src/core/adapters/types.ts`
5. Create registry in `src/core/adapters/registry.ts`

**Verification:** Existing Gemini functionality unchanged.

### Phase 2: Create Gemini Adapter (0.5 days)

1. Create `src/adapters/gemini.ts` implementing `SiteAdapter`
2. Extract DOM selectors from `content.tsx` into adapter
3. Update `content.tsx` to use adapter loader pattern
4. Update `background.ts` to use registry for context menu

**Verification:** Gemini annotation still works.

### Phase 3: Add ChatGPT Adapter (1 day)

1. Investigate ChatGPT DOM structure for images
2. Create `src/adapters/chatgpt.ts`
3. Add URL patterns to `wxt.config.ts`
4. Test button injection and annotation flow

**Verification:** Annotation works on both Gemini and ChatGPT.

### Phase 4: Add Higgsfield Adapter (0.5 days)

1. Investigate Higgsfield.ai DOM structure
2. Create `src/adapters/higgsfield.ts`
3. Add URL patterns
4. Test

**Verification:** All three sites working.

---

## Adding a New Site (Developer Guide)

### Step 1: Investigate Site Structure

```javascript
// Run in browser console on target site
// Find image elements
document.querySelectorAll('img').forEach(img => console.log(img, img.closest('[class]')));

// Find image containers
// Look for consistent class names or data attributes
```

### Step 2: Create Adapter File

```bash
touch src/adapters/newsite.ts
```

### Step 3: Implement Adapter

```typescript
// src/adapters/newsite.ts
import type { SiteAdapter } from '../core/adapters/types';

export const newsiteAdapter: SiteAdapter = {
  id: 'newsite',
  name: 'New Site Name',
  matches: ['https://newsite.com/*'],

  init() {},
  destroy() {},

  findImages() {
    // Implement image detection
    return [];
  },

  getButtonInjectionPoint(image) {
    // Implement button positioning
    return null;
  },

  observeImageChanges(callback) {
    // Implement mutation observer
    return () => {};
  },
};
```

### Step 4: Register Adapter

```typescript
// src/core/adapters/registry.ts
import { newsiteAdapter } from '../../adapters/newsite';

export const siteAdapters: SiteAdapter[] = [
  geminiAdapter,
  chatgptAdapter,
  newsiteAdapter, // Add here
];
```

### Step 5: Update Host Permissions

```typescript
// wxt.config.ts
host_permissions: [
  // ...existing
  'https://newsite.com/*',
],
```

### Step 6: Test

```bash
bun run dev
# Navigate to new site
# Verify buttons appear on images
# Test full annotation flow
```

---

## Architecture Decision Records

### ADR-1: Adapter Pattern vs Plugin System

**Status:** Accepted

**Context:** Need extensibility for multiple sites with different DOM structures.

**Decision:** Use Adapter pattern (compile-time) rather than dynamic plugin system.

**Consequences:**
- (+) Type safety across all adapters
- (+) Simpler implementation, no plugin loading complexity
- (+) Smaller bundle - only needed adapters included
- (-) Requires rebuild to add new sites
- (-) Cannot add sites without code changes

**Rationale:** For a Chrome extension targeting a finite set of known sites, compile-time configuration is simpler and safer than runtime plugin loading.

### ADR-2: Centralized Registry vs Distributed Config

**Status:** Accepted

**Context:** Where to define URL patterns and adapter mappings.

**Decision:** Single registry file (`registry.ts`) with all adapters.

**Consequences:**
- (+) Single source of truth for supported sites
- (+) Easy to see all supported sites at a glance
- (+) URL matching logic in one place
- (-) Registry grows with each site (minimal concern)

### ADR-3: Shadow DOM for Button Isolation

**Status:** Preserved (existing pattern)

**Context:** Injected buttons must not be affected by host page CSS.

**Decision:** Each button gets its own Shadow DOM (closed mode).

**Consequences:**
- (+) Complete CSS isolation from host
- (+) Consistent styling across all sites
- (-) Slightly more complex button creation

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Site DOM changes break adapter | Medium | Medium | Version adapters, monitor for changes |
| New site has unique image loading | Medium | Low | Adapter pattern accommodates custom logic |
| Performance with many adapters | Low | Low | Only one adapter active at a time |
| React hydration issues in Shadow DOM | Low | Medium | Already working in current implementation |

---

## Success Criteria

1. Gemini annotation continues working identically
2. Adding a new site requires only:
   - One new adapter file (~50-100 lines)
   - One line added to registry
   - One line in host_permissions
3. Core engine has zero site-specific code
4. All adapters share common button/overlay styling

---

## Timeline Estimate

| Phase | Task | Effort |
|-------|------|--------|
| 1 | Extract Core Engine | 1-2 days |
| 2 | Create Gemini Adapter | 0.5 days |
| 3 | Add ChatGPT Adapter | 1 day |
| 4 | Add Higgsfield Adapter | 0.5 days |
| **Total** | | **3-4 days** |

---

## Appendix: Potential Future Adapters

| Site | URL Pattern | Notes |
|------|-------------|-------|
| Claude.ai | `https://claude.ai/*` | Anthropic's chat interface |
| Pika.art | `https://pika.art/*` | AI video generation |
| Midjourney | `https://www.midjourney.com/*` | AI image generation |
| Leonardo.ai | `https://app.leonardo.ai/*` | AI art platform |
| Ideogram | `https://ideogram.ai/*` | AI image generation |

---

*Architecture Design by: Claude Code Planning Agent*
*Plan Version: 1.0*
