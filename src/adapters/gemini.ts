/**
 * Gemini Adapter
 * Site-specific DOM handling for Google Gemini (gemini.google.com)
 */

import type { SiteAdapter, AnnotatableImage, ButtonInjectionConfig } from '../core/adapters/types';
import { ADAPTER_MATCHES } from '../core/adapters/matches';
import { createLogger } from '../core/logger';

const logger = createLogger();

/** Selectors for the image shown inside Gemini's expanded-image dialog. */
const LIGHTBOX_IMAGE_SELECTORS = ['.expansion-dialog img', '.cdk-overlay-pane img'];

/**
 * Selectors for Gemini's hidden upload input, most-specific first. Scoping to an
 * image-accepting input avoids hijacking an unrelated file field on the page.
 */
const FILE_INPUT_SELECTORS = [
  'input[type="file"][accept*="image"]',
  'input[type="file"]',
];

export const geminiAdapter: SiteAdapter = {
  id: 'gemini',
  name: 'Google Gemini',
  // Single source: wxt.config.ts derives host_permissions from the same table.
  matches: ADAPTER_MATCHES.gemini,

  init() {
    logger.log('Gemini adapter initialized');
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

  lightbox: {
    getInjectionPoint(): ButtonInjectionConfig | null {
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

    getImage(): HTMLImageElement | null {
      for (const selector of LIGHTBOX_IMAGE_SELECTORS) {
        const img = document.querySelector<HTMLImageElement>(selector);
        if (img?.src) return img;
      }
      return null;
    },
  },

  observeImageChanges(callback: (images: AnnotatableImage[]) => void): () => void {
    // Gemini streams responses into the DOM, so mutations arrive in a constant
    // burst — and injecting our own buttons mutates the DOM too. Coalesce every
    // burst into a single callback per frame so the observer can't spin.
    let frame: number | null = null;

    const observer = new MutationObserver(() => {
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        callback(this.findImages());
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
    };
  },

  async attachToChat(file: File, promptText?: string): Promise<boolean> {
    const imageTransfer = new DataTransfer();
    imageTransfer.items.add(file);

    // Locate the Quill-based prompt editor; selectors ordered most-specific to
    // most-generic to survive UI changes. Re-queried at call time because the
    // input area re-renders when an image is added.
    const findEditor = (): HTMLElement | null => {
      const selectors = [
        'rich-textarea .ql-editor',
        'div.ql-editor[contenteditable="true"]',
        'div[contenteditable="true"][role="textbox"]',
      ];
      for (const selector of selectors) {
        const el = document.querySelector<HTMLElement>(selector);
        if (el) return el;
      }
      return null;
    };

    // Insert the generated prompt text into the editor. Gemini's Quill editor
    // ignores synthetic paste events (isTrusted=false) but responds to
    // execCommand('insertText'), which fires the real input event Quill listens
    // for. Deferred so it runs after the image upload re-renders the input.
    const insertPrompt = (): Promise<void> =>
      new Promise((resolve) => {
        if (!promptText) {
          resolve();
          return;
        }
        setTimeout(() => {
          const editor = findEditor();
          if (!editor) {
            resolve();
            return;
          }
          editor.focus();
          const selection = window.getSelection();
          if (selection) {
            const range = document.createRange();
            range.selectNodeContents(editor);
            range.collapse(false); // caret at end
            selection.removeAllRanges();
            selection.addRange(range);
          }
          document.execCommand('insertText', false, promptText);
          logger.log('Inserted generated prompt into Gemini chat input');
          resolve();
        }, 120);
      });

    // Strategy 1: Gemini's uploader uses a hidden file input — setting .files and
    // firing 'change' is shared with the page world, so it survives isolated-world
    // event restrictions.
    const fileInput = FILE_INPUT_SELECTORS.reduce<HTMLInputElement | null>(
      (found, selector) => found ?? document.querySelector<HTMLInputElement>(selector),
      null
    );
    if (fileInput) {
      fileInput.files = imageTransfer.files;
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      logger.log('Attached annotated image via Gemini file input');
      await insertPrompt();
      return true;
    }

    // Strategy 2: synthetic paste of the image on the prompt editor.
    const editor = findEditor();
    if (!editor) {
      logger.warn('Gemini chat input not found — falling back to clipboard');
      return false;
    }
    editor.focus();
    editor.dispatchEvent(
      new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: imageTransfer,
      })
    );
    logger.log('Attached annotated image to Gemini chat input via paste');
    await insertPrompt();
    return true;
  },
};
