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
    // most-generic to survive UI changes.
    const editorSelectors = [
      'rich-textarea .ql-editor',
      'div.ql-editor[contenteditable="true"]',
      'div[contenteditable="true"][role="textbox"]',
    ];
    let editor: HTMLElement | null = null;
    for (const selector of editorSelectors) {
      editor = document.querySelector<HTMLElement>(selector);
      if (editor) break;
    }

    // Insert the generated prompt text into the editor via a text/plain paste
    // (Quill handles pasted text reliably, incl. newlines).
    const insertPrompt = () => {
      if (!promptText || !editor) return;
      const textTransfer = new DataTransfer();
      textTransfer.setData('text/plain', promptText);
      editor.focus();
      editor.dispatchEvent(
        new ClipboardEvent('paste', {
          bubbles: true,
          cancelable: true,
          clipboardData: textTransfer,
        })
      );
      console.log('[Deixis] Inserted generated prompt into Gemini chat input');
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
