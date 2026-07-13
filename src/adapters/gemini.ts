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

  attachToChat(file: File, promptText?: string): boolean {
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
    const insertPrompt = () => {
      if (!promptText) return;
      setTimeout(() => {
        const editor = findEditor();
        if (!editor) return;
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
        console.log('[Deixis] Inserted generated prompt into Gemini chat input');
      }, 120);
    };

    // Strategy 1: Gemini's uploader uses a hidden file input — setting .files and
    // firing 'change' is shared with the page world, so it survives isolated-world
    // event restrictions.
    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    if (fileInput) {
      fileInput.files = imageTransfer.files;
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      console.log('[Deixis] Attached annotated image via Gemini file input');
      insertPrompt();
      return true;
    }

    // Strategy 2: synthetic paste of the image on the prompt editor.
    const editor = findEditor();
    if (!editor) {
      console.warn('[Deixis] Gemini chat input not found — falling back to clipboard');
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
    console.log('[Deixis] Attached annotated image to Gemini chat input via paste');
    insertPrompt();
    return true;
  },
};
