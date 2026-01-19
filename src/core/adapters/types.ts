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

  /** Get injection point for lightbox/dialog button (optional) */
  getLightboxInjectionPoint?(): ButtonInjectionConfig | null;

  /** Watch for dynamically loaded images */
  observeImageChanges(callback: (images: AnnotatableImage[]) => void): () => void;

  /** Site-specific image URL processing (handle CDN, proxies, etc.) */
  processImageUrl?(url: string): string | Promise<string>;
}
