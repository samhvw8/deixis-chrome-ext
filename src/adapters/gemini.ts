/**
 * Gemini Adapter
 * Site-specific DOM handling for Google Gemini (gemini.google.com)
 */

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
      style: {
        position: 'relative',
        marginRight: '8px',
      },
    };
  },

  observeImageChanges(callback: (images: AnnotatableImage[]) => void): () => void {
    const observer = new MutationObserver(() => {
      callback(this.findImages());
    });

    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  },

  attachToChat(file: File): boolean {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);

    // Strategy 1: Gemini's uploader uses a hidden file input — setting .files and
    // firing 'change' is shared with the page world, so it survives isolated-world
    // event restrictions
    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    if (fileInput) {
      fileInput.files = dataTransfer.files;
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      console.log('[Deixis] Attached annotated image via Gemini file input');
      return true;
    }

    // Strategy 2: synthetic paste on the Quill-based prompt editor; selectors from
    // most specific to most generic to survive UI changes
    const selectors = [
      'rich-textarea .ql-editor',
      'div.ql-editor[contenteditable="true"]',
      'div[contenteditable="true"][role="textbox"]',
    ];

    let input: HTMLElement | null = null;
    for (const selector of selectors) {
      input = document.querySelector<HTMLElement>(selector);
      if (input) break;
    }
    if (!input) {
      console.warn('[Deixis] Gemini chat input not found — falling back to clipboard');
      return false;
    }

    input.focus();
    const pasteEvent = new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData: dataTransfer,
    });
    input.dispatchEvent(pasteEvent);

    console.log('[Deixis] Attached annotated image to Gemini chat input via paste');
    return true;
  },
};
