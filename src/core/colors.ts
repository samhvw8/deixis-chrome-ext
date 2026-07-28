/**
 * Annotation Colors
 * Single source of truth for the palette. Shared by the content-script color
 * picker, the popup's default-color setting, and prompt generation (which maps
 * a hex value back to a human-readable name).
 */

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

/** Default brush color used until the user picks one in the popup. */
export const DEFAULT_BRUSH_COLOR = ANNOTATION_COLORS[0].value;
