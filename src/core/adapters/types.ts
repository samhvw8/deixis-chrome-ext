/**
 * Site Adapter Types
 * Defines the interface for site-specific DOM handling
 */

/**
 * Represents an image that can be annotated
 */
export interface AnnotatableImage {
  /** The image element */
  element: HTMLImageElement;
  /** The image URL */
  url: string;
  /** Current bounding rectangle of the image */
  bounds: DOMRect;
  /** Optional container element for the image */
  container?: HTMLElement;
}

/**
 * Configuration for button injection
 */
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

/**
 * Interface that all site adapters must implement
 */
export interface SiteAdapter {
  /** Unique site identifier */
  id: string;

  /** Human-readable site name */
  name: string;

  /** URL patterns this adapter handles (Chrome extension pattern format) */
  matches: string[];

  /** Initialize adapter on page load */
  init(): void;

  /** Clean up on unload */
  destroy(): void;

  /** Find all annotatable images on page */
  findImages(): AnnotatableImage[];

  /** Get injection point for annotation button on image container */
  getButtonInjectionPoint(image: HTMLImageElement): ButtonInjectionConfig | null;

  /**
   * Support for the site's lightbox / expanded-image dialog (optional).
   *
   * Grouped because the two halves are useless apart: a button with no image to
   * annotate, or an image with nowhere to put the button. Two independent
   * optional methods let an adapter declare one and not the other, which the
   * content script then had to catch at runtime.
   */
  lightbox?: {
    /** Where to inject the annotate button inside the open dialog. */
    getInjectionPoint(): ButtonInjectionConfig | null;
    /** The image currently displayed in that dialog. */
    getImage(): HTMLImageElement | null;
  };

  /** Watch for dynamically loaded images */
  observeImageChanges(callback: (images: AnnotatableImage[]) => void): () => void;

  /**
   * Attach an image file directly to the site's chat input (optional), and
   * insert the given prompt text alongside it.
   *
   * Async because attaching is: a site may need to await an upload before the
   * result is known. Resolve `true` only once the file is actually attached —
   * the caller falls back to the clipboard copy on `false`.
   */
  attachToChat?(file: File, promptText?: string): Promise<boolean>;
}
