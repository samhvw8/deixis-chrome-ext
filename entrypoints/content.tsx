/**
 * Deixis Content Script
 * Handles Gemini page integration with proper DOM selectors
 * Uses Shadow DOM for CSS isolation from host page
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { AnnotationOverlay } from './content/components/AnnotationOverlay';

// Container ID for Shadow DOM host
const DEIXIS_CONTAINER_ID = 'deixis-annotation-root';
const DEIXIS_BUTTON_CLASS = 'deixis-host';

// State
let reactRoot: ReactDOM.Root | null = null;
let shadowRoot: ShadowRoot | null = null;
let isAnnotationOpen = false;

/**
 * Get the CSS styles for the annotation overlay Shadow DOM
 */
function getOverlayStyles(): string {
  return `
    /* Reset styles within shadow DOM */
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    /* Design tokens */
    :host {
      --deixis-surface: rgba(18, 18, 18, 0.95);
      --deixis-surface-hover: rgba(38, 38, 38, 0.95);
      --deixis-border: rgba(255, 255, 255, 0.1);
      --deixis-text: #FAFAFA;
      --deixis-text-muted: rgba(255, 255, 255, 0.6);
      --deixis-primary: #22C55E;
      --deixis-primary-hover: #16A34A;
      --deixis-danger: #EF4444;
      --deixis-radius: 8px;
      --deixis-radius-sm: 4px;
      --deixis-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
      --deixis-transition: 150ms ease-out;
    }

    /* Toolbar container */
    .deixis-toolbar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: var(--deixis-surface);
      border: 1px solid var(--deixis-border);
      border-radius: var(--deixis-radius);
      box-shadow: var(--deixis-shadow);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    /* Tool button */
    .deixis-tool-btn {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      padding: 0;
      background: transparent;
      border: 1px solid transparent;
      border-radius: var(--deixis-radius-sm);
      color: var(--deixis-text-muted);
      cursor: pointer;
      transition: all var(--deixis-transition);
    }

    .deixis-tool-btn:hover {
      background: var(--deixis-surface-hover);
      color: var(--deixis-text);
    }

    .deixis-tool-btn:focus-visible {
      outline: 2px solid var(--deixis-primary);
      outline-offset: 2px;
    }

    .deixis-tool-btn[data-active="true"] {
      background: rgba(34, 197, 94, 0.15);
      border-color: rgba(34, 197, 94, 0.3);
      color: var(--deixis-primary);
    }

    .deixis-tool-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    /* Divider */
    .deixis-divider {
      width: 1px;
      height: 24px;
      background: var(--deixis-border);
      margin: 0 4px;
    }

    /* Action buttons */
    .deixis-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border-radius: var(--deixis-radius-sm);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all var(--deixis-transition);
      font-family: inherit;
    }

    .deixis-btn-primary {
      background: var(--deixis-primary);
      border: 1px solid var(--deixis-primary);
      color: white;
    }

    .deixis-btn-primary:hover {
      background: var(--deixis-primary-hover);
      border-color: var(--deixis-primary-hover);
    }

    .deixis-btn-secondary {
      background: transparent;
      border: 1px solid var(--deixis-border);
      color: var(--deixis-text-muted);
    }

    .deixis-btn-secondary:hover {
      background: var(--deixis-surface-hover);
      color: var(--deixis-text);
    }

    /* Toast notification */
    .deixis-toast {
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 20px;
      background: var(--deixis-surface);
      border: 1px solid var(--deixis-border);
      border-radius: var(--deixis-radius);
      color: var(--deixis-text);
      font-size: 14px;
      font-weight: 500;
      box-shadow: var(--deixis-shadow);
      animation: deixis-toast-in 0.2s ease-out;
      z-index: 30;
    }

    .deixis-toast[data-type="success"] {
      border-color: rgba(34, 197, 94, 0.3);
    }

    .deixis-toast[data-type="success"]::before {
      content: '';
      width: 8px;
      height: 8px;
      background: var(--deixis-primary);
      border-radius: 50%;
    }

    @keyframes deixis-toast-in {
      from {
        opacity: 0;
        transform: translateX(-50%) translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
    }

    /* Overlay */
    .deixis-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.9);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    /* Canvas container */
    .deixis-canvas-container {
      position: relative;
      margin-top: 80px;
      border-radius: var(--deixis-radius);
      overflow: hidden;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }

    /* Text input */
    .deixis-text-input {
      position: absolute;
      background: rgba(0, 0, 0, 0.8);
      border: 2px solid currentColor;
      border-radius: var(--deixis-radius-sm);
      padding: 4px 8px;
      font-size: 14px;
      font-weight: bold;
      outline: none;
      min-width: 100px;
      font-family: inherit;
    }

    /* Instructions */
    .deixis-instructions {
      position: fixed;
      bottom: 20px;
      color: rgba(255, 255, 255, 0.5);
      font-size: 12px;
    }

    .deixis-kbd {
      background: rgba(255, 255, 255, 0.1);
      padding: 2px 6px;
      border-radius: var(--deixis-radius-sm);
      font-family: monospace;
    }

    /* Reduced motion */
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
    }

    /* Color Picker */
    .deixis-color-picker-btn {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      padding: 0;
      background: transparent;
      border: 1px solid transparent;
      border-radius: var(--deixis-radius-sm);
      cursor: pointer;
      transition: all var(--deixis-transition);
    }

    .deixis-color-picker-btn:hover {
      background: var(--deixis-surface-hover);
    }

    .deixis-color-picker-btn.active {
      background: var(--deixis-surface-hover);
    }

    .deixis-color-picker-dropdown {
      position: absolute;
      top: calc(100% + 8px);
      left: 50%;
      transform: translateX(-50%);
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 4px;
      padding: 8px;
      background: var(--deixis-surface);
      border: 1px solid var(--deixis-border);
      border-radius: var(--deixis-radius);
      box-shadow: var(--deixis-shadow);
      z-index: 100;
      pointer-events: auto;
    }

    .deixis-color-swatch {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 2px solid transparent;
      cursor: pointer;
      transition: transform var(--deixis-transition), border-color var(--deixis-transition);
      pointer-events: auto;
      padding: 0;
      background: none;
    }

    .deixis-color-swatch:hover {
      transform: scale(1.1);
    }

    .deixis-color-swatch[data-selected="true"] {
      border-color: white;
    }

    .deixis-custom-color {
      position: relative;
      overflow: hidden;
    }

    .deixis-custom-color input[type="color"] {
      -webkit-appearance: none;
      -moz-appearance: none;
      appearance: none;
      width: 32px;
      height: 32px;
      border: none;
      padding: 0;
      cursor: pointer;
      background: transparent;
    }

    .deixis-custom-color input[type="color"]::-webkit-color-swatch-wrapper {
      padding: 0;
    }

    .deixis-custom-color input[type="color"]::-webkit-color-swatch {
      border: none;
      border-radius: 50%;
    }

    .deixis-custom-color input[type="color"]::-moz-color-swatch {
      border: none;
      border-radius: 50%;
    }

    /* Tooltip */
    .deixis-tooltip {
      position: absolute;
      padding: 4px 8px;
      background: var(--deixis-surface);
      border: 1px solid var(--deixis-border);
      border-radius: var(--deixis-radius-sm);
      color: var(--deixis-text);
      font-size: 12px;
      white-space: nowrap;
      pointer-events: none;
      z-index: 50;
    }
  `;
}

/**
 * Create or get the Deixis Shadow DOM container for annotation overlay
 */
function getOverlayContainer(): { host: HTMLElement; shadow: ShadowRoot; mountPoint: HTMLElement } {
  let host = document.getElementById(DEIXIS_CONTAINER_ID);

  if (!host) {
    host = document.createElement('div');
    host.id = DEIXIS_CONTAINER_ID;
    host.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 2147483647;
      pointer-events: none;
    `;
    document.body.appendChild(host);

    // Create Shadow DOM
    shadowRoot = host.attachShadow({ mode: 'open' });

    // Inject styles
    const styleEl = document.createElement('style');
    styleEl.textContent = getOverlayStyles();
    shadowRoot.appendChild(styleEl);

    // Create mount point for React
    const mountPoint = document.createElement('div');
    mountPoint.id = 'deixis-react-mount';
    shadowRoot.appendChild(mountPoint);
  }

  const existingShadow = shadowRoot || host.shadowRoot;
  if (!existingShadow) {
    throw new Error('Shadow root not found');
  }

  const mountPoint = existingShadow.getElementById('deixis-react-mount');
  if (!mountPoint) {
    throw new Error('Mount point not found');
  }

  return { host, shadow: existingShadow, mountPoint };
}

/**
 * Open annotation mode for a given image
 */
function openAnnotation(imageUrl: string, imageBounds?: DOMRect) {
  if (isAnnotationOpen) return;

  isAnnotationOpen = true;

  const { host, mountPoint } = getOverlayContainer();
  host.style.pointerEvents = 'auto';

  if (!reactRoot) {
    reactRoot = ReactDOM.createRoot(mountPoint);
  }

  reactRoot.render(
    React.createElement(
      React.StrictMode,
      null,
      React.createElement(AnnotationOverlay, {
        imageUrl: imageUrl,
        imageBounds: imageBounds,
        onClose: closeAnnotation,
        onCopy: handleCopy,
        onSave: handleSave,
      })
    )
  );
}

/**
 * Close annotation mode
 */
function closeAnnotation() {
  isAnnotationOpen = false;

  const host = document.getElementById(DEIXIS_CONTAINER_ID);
  if (host) {
    host.style.pointerEvents = 'none';
  }

  if (reactRoot) {
    reactRoot.render(null);
  }
}

/**
 * Handle copy action - copy to clipboard only
 */
async function handleCopy(dataUrl: string) {
  try {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob })
    ]);
    console.log('[Deixis] Copied to clipboard');
  } catch (error) {
    console.error('[Deixis] Failed to copy to clipboard:', error);
  }

  closeAnnotation();
}

/**
 * Handle save action - download PNG file
 */
async function handleSave(dataUrl: string) {
  // Download PNG
  const link = document.createElement('a');
  link.download = `deixis-annotation-${Date.now()}.png`;
  link.href = dataUrl;
  link.click();

  closeAnnotation();
}

/**
 * Inject Deixis button into image containers
 * Based on Gemini's DOM structure:
 * - .overlay-container inside GENERATED-IMAGE / SINGLE-IMAGE
 * - Existing controls on right side, we add on left side
 */
function injectDeixisButtons() {
  // Find all overlay containers (image containers in Gemini)
  const containers = document.querySelectorAll('.overlay-container');

  containers.forEach((container) => {
    // Skip if already injected
    if (container.querySelector(`.${DEIXIS_BUTTON_CLASS}`)) return;

    // Create shadow host for button
    const host = document.createElement('div');
    host.className = DEIXIS_BUTTON_CLASS;

    // Attach shadow DOM for style isolation
    const shadow = host.attachShadow({ mode: 'closed' });

    // Inject styles matching Gemini's design
    shadow.innerHTML = `
      <style>
        :host {
          position: absolute;
          top: 12px;
          left: 12px;
          z-index: 9999;
          opacity: 0;
          transition: opacity 0.2s ease;
          pointer-events: auto;
        }

        :host(.visible) {
          opacity: 1;
        }

        .deixis-btn {
          width: 32px;
          height: 32px;
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

        .deixis-btn:focus-visible {
          outline: 2px solid #22C55E;
          outline-offset: 2px;
        }

        .deixis-btn svg {
          width: 18px;
          height: 18px;
          fill: currentColor;
        }

        /* Tooltip */
        .deixis-btn::after {
          content: 'Annotate';
          position: absolute;
          left: 100%;
          margin-left: 8px;
          padding: 4px 8px;
          background: rgba(60, 64, 67, 0.95);
          color: white;
          border-radius: 4px;
          font-size: 12px;
          font-family: -apple-system, BlinkMacSystemFont, sans-serif;
          white-space: nowrap;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s ease;
        }

        .deixis-btn:hover::after {
          opacity: 1;
        }
      </style>

      <button class="deixis-btn" aria-label="Annotate with Deixis" title="Annotate with Deixis">
        <svg viewBox="0 0 24 24">
          <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
        </svg>
      </button>
    `;

    // Add hover listeners to show/hide button (mimic Gemini behavior)
    container.addEventListener('mouseenter', () => host.classList.add('visible'));
    container.addEventListener('mouseleave', () => host.classList.remove('visible'));

    // Add click handler
    const button = shadow.querySelector('.deixis-btn');
    const handleClick = (e: Event) => {
      e.stopPropagation();
      e.preventDefault();

      console.log('[Deixis] Button clicked');

      // Find image in container
      const img = container.querySelector('img.image') as HTMLImageElement;
      console.log('[Deixis] Found image:', img);

      if (img) {
        const bounds = img.getBoundingClientRect();
        console.log('[Deixis] Image bounds:', bounds);
        openAnnotation(img.src, bounds);
      } else {
        console.warn('[Deixis] No image found');
      }
    };

    button?.addEventListener('click', handleClick);
    // Also add click handler to host element for external clicks
    host.addEventListener('click', handleClick);

    // Insert at the beginning of overlay-container
    container.insertBefore(host, container.firstChild);
  });
}

/**
 * Inject button into lightbox/expansion dialog
 * Target: .generated-image-expansion-dialog-action-buttons
 */
function injectLightboxButton() {
  const lightboxContainer = document.querySelector('.generated-image-expansion-dialog-action-buttons');
  if (!lightboxContainer) return;

  // Skip if already injected
  if (lightboxContainer.querySelector(`.${DEIXIS_BUTTON_CLASS}`)) return;

  // Find the image in the lightbox
  const dialogImg = document.querySelector('.expansion-dialog img, .cdk-overlay-pane img') as HTMLImageElement;
  if (!dialogImg?.src) return;

  // Create shadow host for button (larger for lightbox)
  const host = document.createElement('div');
  host.className = DEIXIS_BUTTON_CLASS;

  const shadow = host.attachShadow({ mode: 'closed' });

  shadow.innerHTML = `
    <style>
      :host {
        display: inline-flex;
        position: relative;
        z-index: 9999;
        pointer-events: auto;
      }

      .deixis-btn {
        width: 48px;
        height: 48px;
        border-radius: 9999px;
        background: transparent;
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
        background: rgba(34, 197, 94, 0.2);
        color: #22C55E;
      }

      .deixis-btn:focus-visible {
        outline: 2px solid #22C55E;
        outline-offset: 2px;
      }

      .deixis-btn svg {
        width: 24px;
        height: 24px;
        fill: currentColor;
      }
    </style>

    <button class="deixis-btn" aria-label="Annotate with Deixis" title="Annotate with Deixis">
      <svg viewBox="0 0 24 24">
        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
      </svg>
    </button>
  `;

  const button = shadow.querySelector('.deixis-btn');
  button?.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    openAnnotation(dialogImg.src);
  });

  // Also add click handler to host element for external clicks
  host.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    openAnnotation(dialogImg.src);
  });

  // Insert at the beginning of the action buttons
  lightboxContainer.insertBefore(host, lightboxContainer.firstChild);
}

/**
 * Set up MutationObserver for dynamically loaded images (Angular app)
 */
function setupMutationObserver() {
  const observer = new MutationObserver(() => {
    // Inject buttons for regular images
    injectDeixisButtons();

    // Inject button for lightbox if open
    injectLightboxButton();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  return observer;
}

/**
 * Listen for custom events from the page
 */
function setupEventListeners() {
  // Listen for custom annotate event
  window.addEventListener('deixis:annotate', ((e: CustomEvent) => {
    if (e.detail?.imageSrc) {
      openAnnotation(e.detail.imageSrc);
    }
  }) as EventListener);
}

/**
 * Listen for messages from background script (context menu)
 */
function setupMessageListener() {
  browser.runtime.onMessage.addListener((message) => {
    if (message.type === 'DEIXIS_OPEN_ANNOTATION' && message.imageUrl) {
      openAnnotation(message.imageUrl);
    }
  });
}

// Content script definition
export default defineContentScript({
  matches: ['https://gemini.google.com/*'],

  main() {
    console.log('[Deixis] Content script loaded with Gemini DOM integration');

    // Setup all listeners and observers
    setupMessageListener();
    setupEventListeners();
    setupMutationObserver();

    // Initial injection
    injectDeixisButtons();
    injectLightboxButton();

    // Notify background script
    browser.runtime.sendMessage({ type: 'DEIXIS_READY' });
  },
});
