import React, { useState, useRef, useEffect, useCallback } from 'react';

export interface ToolButtonProps {
  /** Icon component to render */
  icon: React.ReactNode;
  /** Tooltip text shown on hover */
  tooltip: string;
  /** Keyboard shortcut hint (displayed in tooltip) */
  shortcut?: string;
  /** Whether the button is currently selected/active */
  isActive?: boolean;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Optional className override */
  className?: string;
  /** Button type for form context */
  type?: 'button' | 'submit' | 'reset';
  /** ARIA label for accessibility */
  ariaLabel?: string;
}

/**
 * ToolButton - A toolbar button with icon, tooltip, and active state support.
 *
 * Design specs:
 * - 36x36px click area (32x32 icon container)
 * - States: default, hover, active/selected, disabled
 * - Tooltip appears 500ms after hover
 * - Supports keyboard navigation
 */
export const ToolButton: React.FC<ToolButtonProps> = ({
  icon,
  tooltip,
  shortcut,
  isActive = false,
  disabled = false,
  onClick,
  className = '',
  type = 'button',
  ariaLabel,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tooltipTimeoutRef = useRef<number | null>(null);

  const tooltipText = shortcut ? `${tooltip} (${shortcut})` : tooltip;

  const handleMouseEnter = useCallback(() => {
    tooltipTimeoutRef.current = window.setTimeout(() => {
      setShowTooltip(true);
    }, 500);
  }, []);

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

  // Hide tooltip on click
  const handleClick = useCallback(() => {
    setShowTooltip(false);
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = null;
    }
    onClick?.();
  }, [onClick]);

  return (
    <button
      ref={buttonRef}
      type={type}
      className={`deixis-tool-btn ${isActive ? 'active' : ''} ${className}`.trim()}
      data-active={isActive}
      disabled={disabled}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleMouseEnter}
      onBlur={handleMouseLeave}
      aria-label={ariaLabel || tooltip}
      aria-pressed={isActive}
      title="" // Prevent native tooltip
    >
      {icon}

      {/* Tooltip */}
      {showTooltip && !disabled && (
        <span
          className="deixis-tooltip"
          style={{
            top: 'calc(100% + 8px)',
            left: '50%',
            transform: 'translateX(-50%)',
          }}
          role="tooltip"
        >
          {tooltipText}
        </span>
      )}
    </button>
  );
};

export default ToolButton;
