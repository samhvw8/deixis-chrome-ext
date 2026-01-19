/**
 * Deixis Button Factory
 * Creates annotation buttons with Shadow DOM isolation
 */

export interface DeixisButtonOptions {
  /** Click handler for the button */
  onClick: () => void;
  /** Custom CSS styles to apply to the host element */
  style?: Partial<CSSStyleDeclaration>;
  /** Show button on hover only */
  showOnHover?: boolean;
  /** Element to attach hover listeners to */
  hoverTarget?: HTMLElement;
  /** Button size variant */
  variant?: 'default' | 'large';
}

/**
 * CSS class applied to all Deixis button host elements
 */
export const DEIXIS_BUTTON_CLASS = 'deixis-host';

/**
 * Create a Deixis annotation button with Shadow DOM isolation
 */
export function createDeixisButton(options: DeixisButtonOptions): HTMLElement {
  const host = document.createElement('div');
  host.className = DEIXIS_BUTTON_CLASS;

  const shadow = host.attachShadow({ mode: 'closed' });

  const isLarge = options.variant === 'large';
  const size = isLarge ? 48 : 32;
  const iconSize = isLarge ? 24 : 18;

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
        background: ${isLarge ? 'transparent' : 'rgba(60, 64, 67, 0.75)'};
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
        background: ${isLarge ? 'rgba(34, 197, 94, 0.2)' : 'rgba(34, 197, 94, 0.9)'};
        color: ${isLarge ? '#22C55E' : 'white'};
      }

      .deixis-btn:focus-visible {
        outline: 2px solid #22C55E;
        outline-offset: 2px;
      }

      .deixis-btn svg {
        width: ${iconSize}px;
        height: ${iconSize}px;
        fill: currentColor;
      }

      /* Tooltip - only for default variant */
      ${!isLarge ? `
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
      ` : ''}
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

  // Click handlers
  const button = shadow.querySelector('.deixis-btn');
  const handleClick = (e: Event) => {
    e.stopPropagation();
    e.preventDefault();
    options.onClick();
  };

  button?.addEventListener('click', handleClick);
  host.addEventListener('click', handleClick);

  return host;
}
