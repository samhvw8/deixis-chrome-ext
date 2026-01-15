import React from 'react';

interface IconProps {
  size?: number;
  className?: string;
}

/**
 * Move icon for move/drag tool
 */
export const MoveIcon: React.FC<IconProps> = ({ size = 20, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M10 3V17" />
    <path d="M3 10H17" />
    <path d="M7 6L10 3L13 6" />
    <path d="M7 14L10 17L13 14" />
    <path d="M6 7L3 10L6 13" />
    <path d="M14 7L17 10L14 13" />
  </svg>
);

/**
 * Pencil icon for freehand draw tool
 */
export const PencilIcon: React.FC<IconProps> = ({ size = 20, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M14.5 2.5L17.5 5.5L6 17H3V14L14.5 2.5Z" />
    <path d="M12 5L15 8" />
  </svg>
);

/**
 * Square icon for rectangle tool
 */
export const SquareIcon: React.FC<IconProps> = ({ size = 20, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect x="3" y="3" width="14" height="14" rx="1" />
  </svg>
);

/**
 * Circle icon for ellipse tool
 */
export const CircleIcon: React.FC<IconProps> = ({ size = 20, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="10" cy="10" r="7" />
  </svg>
);

/**
 * Arrow icon for arrow tool
 */
export const ArrowIcon: React.FC<IconProps> = ({ size = 20, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M4 16L16 4" />
    <path d="M8 4H16V12" />
  </svg>
);

/**
 * Text/Type icon for text label tool
 */
export const TypeIcon: React.FC<IconProps> = ({ size = 20, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M4 5V3H16V5" />
    <path d="M10 3V17" />
    <path d="M7 17H13" />
  </svg>
);

/**
 * Palette icon for color picker
 */
export const PaletteIcon: React.FC<IconProps> = ({ size = 20, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M10 2C5.58 2 2 5.58 2 10C2 14.42 5.58 18 10 18C10.55 18 11 17.55 11 17V16C11 15.73 10.89 15.48 10.71 15.29C10.34 14.92 10.34 14.34 10.71 13.97C10.89 13.79 11.14 13.69 11.41 13.69H13C15.76 13.69 18 11.45 18 8.69C18 4.97 14.42 2 10 2Z" />
    <circle cx="6" cy="9" r="1.5" fill="currentColor" />
    <circle cx="9" cy="5.5" r="1.5" fill="currentColor" />
    <circle cx="13" cy="6" r="1.5" fill="currentColor" />
  </svg>
);

/**
 * Undo/RotateCcw icon for undo action
 */
export const UndoIcon: React.FC<IconProps> = ({ size = 20, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M3 7H11C14.31 7 17 9.69 17 13C17 16.31 14.31 19 11 19H5" />
    <path d="M7 3L3 7L7 11" />
  </svg>
);

/**
 * Trash icon for clear all action
 */
export const TrashIcon: React.FC<IconProps> = ({ size = 20, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M3 5H17" />
    <path d="M8 5V3H12V5" />
    <path d="M5 5L6 17H14L15 5" />
    <path d="M8 8V14" />
    <path d="M12 8V14" />
  </svg>
);

/**
 * Check icon for done/save action
 */
export const CheckIcon: React.FC<IconProps> = ({ size = 20, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M4 10L8 14L16 6" />
  </svg>
);

/**
 * X/Close icon for cancel action
 */
export const CloseIcon: React.FC<IconProps> = ({ size = 20, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M5 5L15 15" />
    <path d="M15 5L5 15" />
  </svg>
);

/**
 * Download icon for save action
 */
export const DownloadIcon: React.FC<IconProps> = ({ size = 20, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M10 3V13" />
    <path d="M6 9L10 13L14 9" />
    <path d="M3 17H17" />
  </svg>
);

/**
 * Copy/Clipboard icon for copy action
 */
export const CopyIcon: React.FC<IconProps> = ({ size = 20, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect x="6" y="6" width="11" height="12" rx="1" />
    <path d="M14 6V4C14 3.45 13.55 3 13 3H4C3.45 3 3 3.45 3 4V13C3 13.55 3.45 14 4 14H6" />
  </svg>
);

/**
 * Eraser icon for eraser tool
 */
export const EraserIcon: React.FC<IconProps> = ({ size = 20, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M16.5 10L11 4.5L4 11.5L7.5 15H14L16.5 10Z" />
    <path d="M11 4.5L16.5 10" />
    <path d="M7.5 15L4 11.5" />
    <path d="M3 17H17" />
  </svg>
);

/**
 * Chevron down icon for dropdowns
 */
export const ChevronDownIcon: React.FC<IconProps> = ({ size = 20, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M5 7L10 12L15 7" />
  </svg>
);

export default {
  MoveIcon,
  PencilIcon,
  SquareIcon,
  CircleIcon,
  ArrowIcon,
  TypeIcon,
  PaletteIcon,
  UndoIcon,
  TrashIcon,
  CheckIcon,
  CloseIcon,
  DownloadIcon,
  CopyIcon,
  EraserIcon,
  ChevronDownIcon,
};
