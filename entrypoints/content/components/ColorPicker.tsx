import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDownIcon } from '../icons';

export interface ColorOption {
  value: string;
  name: string;
}

export const ANNOTATION_COLORS: ColorOption[] = [
  { value: '#22C55E', name: 'Green' },
  { value: '#EF4444', name: 'Red' },
  { value: '#3B82F6', name: 'Blue' },
  { value: '#EAB308', name: 'Yellow' },
  { value: '#F97316', name: 'Orange' },
  { value: '#A855F7', name: 'Purple' },
  { value: '#06B6D4', name: 'Cyan' },
  { value: '#FFFFFF', name: 'White' },
];

export interface ColorPickerProps {
  /** Currently selected color value */
  selectedColor: string;
  /** Callback when color is selected */
  onColorChange: (color: string) => void;
  /** Available colors (defaults to ANNOTATION_COLORS) */
  colors?: ColorOption[];
  /** Tooltip text */
  tooltip?: string;
  /** Whether the picker is disabled */
  disabled?: boolean;
  /** External trigger to close the picker (changes to this value close the picker) */
  closeTrigger?: unknown;
}

/**
 * ColorPicker - A dropdown color picker for annotation colors.
 *
 * Design specs:
 * - Current color displayed as 20x20px swatch
 * - Dropdown shows 4x2 grid of color options
 * - Click outside or select to close
 * - Keyboard accessible
 */
export const ColorPicker: React.FC<ColorPickerProps> = ({
  selectedColor,
  onColorChange,
  colors = ANNOTATION_COLORS,
  tooltip = 'Color',
  disabled = false,
  closeTrigger,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipTimeoutRef = useRef<number | null>(null);
  const isFirstRender = useRef(true);

  // Close dropdown when closeTrigger changes (e.g., tool selection)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setIsOpen(false);
  }, [closeTrigger]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // In Shadow DOM, event.target might be retargeted to the shadow host
      // Use composedPath() to get the actual target path through shadow boundaries
      const path = event.composedPath();
      const isInsideContainer = containerRef.current && path.includes(containerRef.current);

      if (!isInsideContainer) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      // Use capture phase to catch events in Shadow DOM
      document.addEventListener('mousedown', handleClickOutside, true);
      // Also listen on the window for Shadow DOM events
      window.addEventListener('mousedown', handleClickOutside, true);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
      window.removeEventListener('mousedown', handleClickOutside, true);
    };
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleToggle = useCallback(() => {
    if (!disabled) {
      setIsOpen((prev) => !prev);
      setShowTooltip(false);
    }
  }, [disabled]);

  const handleColorSelect = useCallback(
    (color: string) => {
      console.log('[Deixis] Color selected:', color);
      onColorChange(color);
      setIsOpen(false);
    },
    [onColorChange]
  );

  const handleMouseEnter = useCallback(() => {
    if (!isOpen) {
      tooltipTimeoutRef.current = window.setTimeout(() => {
        setShowTooltip(true);
      }, 500);
    }
  }, [isOpen]);

  const handleMouseLeave = useCallback(() => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = null;
    }
    setShowTooltip(false);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
      }
    };
  }, []);

  const selectedColorName = colors.find((c) => c.value === selectedColor)?.name || 'Custom';

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Trigger button */}
      <button
        type="button"
        className={`deixis-color-picker-btn ${isOpen ? 'active' : ''}`}
        onClick={handleToggle}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        disabled={disabled}
        aria-label={`${tooltip}: ${selectedColorName}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {/* Current color indicator */}
        <span
          style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            border: '2px solid',
            display: 'inline-block',
            backgroundColor: selectedColor,
            borderColor:
              selectedColor === '#FFFFFF' ? 'rgba(255,255,255,0.3)' : 'transparent',
            boxShadow:
              selectedColor === '#FFFFFF'
                ? 'inset 0 0 0 1px rgba(0,0,0,0.1)'
                : 'none',
          }}
        />
        <span
          style={{
            position: 'absolute',
            bottom: 4,
            right: 4,
            transition: 'transform 150ms',
            transform: isOpen ? 'rotate(180deg)' : 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ChevronDownIcon size={12} />
        </span>

        {/* Tooltip */}
        {showTooltip && !disabled && !isOpen && (
          <span
            className="deixis-tooltip"
            style={{
              top: 'calc(100% + 8px)',
              left: '50%',
              transform: 'translateX(-50%)',
            }}
            role="tooltip"
          >
            {tooltip}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className="deixis-color-picker-dropdown"
          role="listbox"
          aria-label="Select annotation color"
        >
          {colors.map((color) => (
            <button
              key={color.value}
              type="button"
              className="deixis-color-swatch"
              data-selected={color.value === selectedColor}
              onMouseDown={(e) => {
                // Prevent the click-outside handler from closing before selection
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.stopPropagation();
                handleColorSelect(color.value);
              }}
              style={{
                backgroundColor: color.value,
                boxShadow:
                  color.value === '#FFFFFF'
                    ? 'inset 0 0 0 1px rgba(0,0,0,0.2)'
                    : 'none',
              }}
              role="option"
              aria-selected={color.value === selectedColor}
              aria-label={color.name}
              title={color.name}
            />
          ))}
          {/* Custom color picker */}
          <div
            className="deixis-color-swatch deixis-custom-color"
            title="Custom color"
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            <input
              type="color"
              value={selectedColor}
              onInput={(e) => {
                // Real-time color update while dragging
                e.stopPropagation();
                const target = e.target as HTMLInputElement;
                console.log('[Deixis] Color dragging:', target.value);
                onColorChange(target.value);
              }}
              onChange={(e) => {
                // Final color selection - just update color, don't close dropdown
                // Let user close via click-outside, Escape, or tool change
                e.stopPropagation();
                onColorChange(e.target.value);
              }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: 32,
                height: 32,
                padding: 0,
                border: 'none',
                cursor: 'pointer',
                background: 'transparent',
                // Hide the default input appearance but keep it functional
                WebkitAppearance: 'none',
                MozAppearance: 'none',
              }}
            />
            {/* Rainbow overlay (visual only) */}
            <span
              style={{
                position: 'absolute',
                top: 2,
                left: 2,
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)',
                pointerEvents: 'none',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ColorPicker;
