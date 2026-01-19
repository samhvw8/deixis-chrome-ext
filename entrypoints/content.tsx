/**
 * Deixis Content Script
 * Uses adapter pattern for multi-site support
 * Uses Shadow DOM for CSS isolation from host page
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { AnnotationOverlay } from './content/components/AnnotationOverlay';
import { getAdapterForUrl } from '../src/core/adapters/registry';
import type { SiteAdapter } from '../src/core/adapters/types';
import { createDeixisButton, DEIXIS_BUTTON_CLASS, getOverlayStyles } from '../src/core/ui';

// Container ID for Shadow DOM host
const DEIXIS_CONTAINER_ID = 'deixis-annotation-root';

// State
let reactRoot: ReactDOM.Root | null = null;
let shadowRoot: ShadowRoot | null = null;
let isAnnotationOpen = false;
let currentAdapter: SiteAdapter | null = null;
let cleanupObserver: (() => void) | null = null;

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
 * Inject annotation buttons for all images on page using the current adapter
 */
function injectButtons() {
  if (!currentAdapter) return;

  const images = currentAdapter.findImages();

  images.forEach(({ element, url, container }) => {
    // Skip if already injected
    if (container?.querySelector(`.${DEIXIS_BUTTON_CLASS}`)) return;

    const config = currentAdapter!.getButtonInjectionPoint(element);
    if (!config) return;

    const button = createDeixisButton({
      onClick: () => openAnnotation(url, element.getBoundingClientRect()),
      style: config.style,
      showOnHover: config.showOnHover,
      hoverTarget: config.hoverTarget || config.container,
    });

    // Inject button based on position
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

  // Lightbox button (if adapter supports it)
  injectLightboxButton();
}

/**
 * Inject button into lightbox/expansion dialog if adapter supports it
 */
function injectLightboxButton() {
  if (!currentAdapter?.getLightboxInjectionPoint) return;

  const lightboxConfig = currentAdapter.getLightboxInjectionPoint();
  if (!lightboxConfig) return;

  // Skip if already injected
  if (lightboxConfig.container.querySelector(`.${DEIXIS_BUTTON_CLASS}`)) return;

  // Find current lightbox image (site-specific selector)
  const lightboxImg = document.querySelector('.expansion-dialog img, .cdk-overlay-pane img') as HTMLImageElement;
  if (!lightboxImg?.src) return;

  const button = createDeixisButton({
    onClick: () => openAnnotation(lightboxImg.src),
    style: lightboxConfig.style,
    showOnHover: lightboxConfig.showOnHover,
    variant: 'large',
  });

  lightboxConfig.container.insertBefore(button, lightboxConfig.container.firstChild);
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

  // Watch for new images (SPA navigation, dynamic content)
  cleanupObserver = adapter.observeImageChanges(() => {
    injectButtons();
  });

  // Setup message listeners
  setupMessageListener();
  setupEventListeners();

  // Notify background
  browser.runtime.sendMessage({
    type: 'DEIXIS_READY',
    adapterId: adapter.id,
  });
}

// Content script definition
export default defineContentScript({
  matches: ['https://gemini.google.com/*'],

  main() {
    console.log('[Deixis] Content script loaded');
    initializeDeixis();
  },
});
