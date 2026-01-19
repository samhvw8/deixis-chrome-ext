/**
 * Overlay Styles
 * CSS styles for the annotation overlay Shadow DOM
 */

/**
 * Get the CSS styles for the annotation overlay Shadow DOM
 */
export function getOverlayStyles(): string {
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
