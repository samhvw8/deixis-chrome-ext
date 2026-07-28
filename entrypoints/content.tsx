/**
 * Deixis Content Script
 * Uses adapter pattern for multi-site support
 * Uses Shadow DOM for CSS isolation from host page
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { AnnotationOverlay } from './content/components/AnnotationOverlay';
import { OverlayErrorBoundary } from './content/components/OverlayErrorBoundary';
import { getAdapterForUrl, getAllMatches } from '../src/core/adapters/registry';
import type { SiteAdapter } from '../src/core/adapters/types';
import { createDeixisButton, DEIXIS_BUTTON_CLASS, getOverlayStyles } from '../src/core/ui';
import { createLogger, initLogging } from '../src/core/logger';

const logger = createLogger();

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
function openAnnotation(imageUrl: string) {
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
      React.createElement(
        OverlayErrorBoundary,
        { onError: closeAnnotation },
        React.createElement(AnnotationOverlay, {
          imageUrl: imageUrl,
          onClose: closeAnnotation,
          onCopy: handleCopy,
          onSave: handleSave,
        })
      )
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
 * Handle copy action - copy to clipboard and attach to chat input when supported
 */
async function handleCopy(dataUrl: string, promptText?: string) {
  try {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob })
    ]);
    logger.log('Copied to clipboard');

    // Auto-attach to the site's chat input when the adapter supports it,
    // inserting the generated prompt text alongside the image.
    // (clipboard copy above remains the fallback if attaching fails)
    if (currentAdapter?.attachToChat) {
      const file = new File([blob], `deixis-annotation-${Date.now()}.png`, { type: 'image/png' });
      const attached = await currentAdapter.attachToChat(file, promptText);
      if (!attached) {
        logger.warn('Adapter could not attach to the chat input — the clipboard copy stands');
      }
    }
  } catch (error) {
    logger.error('Failed to copy to clipboard:', error);
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

  images.forEach(({ element }) => {
    const config = currentAdapter!.getButtonInjectionPoint(element);
    if (!config) return;

    // Skip if already injected. Check the exact slot this button occupies, not
    // just the parent: 'before'/'after' place it as a sibling of the container,
    // so a parent-wide query would let the first image's button suppress every
    // other image under the same parent.
    const isInjected = (() => {
      switch (config.position) {
        case 'prepend':
        case 'append':
          return !!config.container.querySelector(`:scope > .${DEIXIS_BUTTON_CLASS}`);
        case 'before':
          return !!config.container.previousElementSibling?.classList.contains(
            DEIXIS_BUTTON_CLASS
          );
        case 'after':
          return !!config.container.nextElementSibling?.classList.contains(DEIXIS_BUTTON_CLASS);
        default:
          return false;
      }
    })();
    if (isInjected) return;

    const button = createDeixisButton({
      // Read element.src live at click time, not a captured value — the button
      // is created once but the image's src can still be updated by the site
      // (e.g. set asynchronously after injection) before the user clicks
      onClick: () => openAnnotation(element.src),
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
  const lightbox = currentAdapter?.lightbox;
  if (!lightbox) return;

  const lightboxConfig = lightbox.getInjectionPoint();
  if (!lightboxConfig) return;

  // Skip if already injected
  if (lightboxConfig.container.querySelector(`:scope > .${DEIXIS_BUTTON_CLASS}`)) return;

  // The adapter owns the site-specific lightbox selector
  const lightboxImg = lightbox.getImage();
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
function setupEventListeners(): () => void {
  const handleAnnotate = ((e: CustomEvent) => {
    if (e.detail?.imageSrc) {
      openAnnotation(e.detail.imageSrc);
    }
  }) as EventListener;

  window.addEventListener('deixis:annotate', handleAnnotate);
  return () => window.removeEventListener('deixis:annotate', handleAnnotate);
}

/**
 * Listen for messages from background script (context menu)
 */
let messageListenerAttached = false;

function setupMessageListener() {
  // Registered once per JS context. initializeDeixis() can run again after a
  // bfcache restore, and a second listener would open the overlay twice.
  if (messageListenerAttached) return;
  messageListenerAttached = true;

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
    logger.warn('No adapter found for this site');
    return;
  }

  currentAdapter = adapter;
  logger.log(`Loaded adapter: ${adapter.name}`);

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
  const cleanupEventListeners = setupEventListeners();

  // Tear everything down when the page goes away so the observer and the
  // adapter don't outlive the document.
  //
  // A bfcache navigation does NOT re-run this script — it freezes and later
  // resumes this same JS context. So teardown must not be one-shot: if the page
  // is only being frozen (event.persisted), re-initialize on the matching
  // pageshow instead of leaving the tab permanently without buttons.
  const teardown = () => {
    cleanupObserver?.();
    cleanupObserver = null;
    cleanupEventListeners();
    adapter.destroy();
    currentAdapter = null;
  };

  const handlePageHide = (event: PageTransitionEvent) => {
    teardown();
    if (!event.persisted) {
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('pageshow', handlePageShow);
    }
  };

  const handlePageShow = (event: PageTransitionEvent) => {
    // Only a restore from bfcache needs re-initialization; the initial load
    // already ran initializeDeixis().
    if (!event.persisted) return;
    window.removeEventListener('pagehide', handlePageHide);
    window.removeEventListener('pageshow', handlePageShow);
    initializeDeixis();
  };

  window.addEventListener('pagehide', handlePageHide);
  window.addEventListener('pageshow', handlePageShow);

  // Notify background
  browser.runtime.sendMessage({
    type: 'DEIXIS_READY',
    adapterId: adapter.id,
  });
}

// Content script definition
export default defineContentScript({
  // Derived from the adapter registry so adding an adapter doesn't require
  // editing this file (or wxt.config.ts, which uses the same source).
  matches: getAllMatches(),

  main() {
    initLogging();
    logger.log('Content script loaded');
    initializeDeixis();
  },
});
