/**
 * Annotation data model.
 *
 * Lives in core rather than beside the overlay component so the pure geometry
 * (and its tests) never has to reach into `entrypoints/`. Nothing here touches
 * the DOM — coordinates are plain numbers in the canvas's CSS-pixel space.
 */

export interface Point {
  x: number;
  y: number;
}

/** The eight bounding-box handles, named by compass direction. */
export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export type AnnotationTool =
  | 'move'
  | 'draw'
  | 'rectangle'
  | 'circle'
  | 'arrow'
  | 'line'
  | 'text'
  | 'eraser'
  | 'callout'
  | 'blur'
  | 'highlight'
  | 'stamp';

export interface Annotation {
  id: string;
  type: AnnotationTool;
  color: string;
  strokeWidth: number;
  /** Opacity 0-1 */
  opacity: number;
  /** Fill color for shapes (undefined = no fill) */
  fillColor?: string;
  /** For freehand draw */
  points?: Point[];
  /** For shapes */
  start?: Point;
  /** For shapes */
  end?: Point;
  /** For text labels */
  text?: string;
  /** For text/callout/stamp position */
  position?: Point;
  /** For text font size */
  fontSize?: number;
  /** For text background color */
  bgColor?: string;
  /** For text outline color */
  outlineColor?: string;
  /** For text outline width */
  outlineWidth?: number;
  /** For callout annotations */
  calloutNumber?: number;
  /** Rotation angle in radians, applied around the annotation's center */
  rotation?: number;
  /** For stamp annotations (emoji) */
  stamp?: string;
}

/**
 * Measures rendered text width. Injected so hit testing stays free of canvas
 * APIs — the overlay supplies a `CanvasRenderingContext2D`-backed implementation,
 * tests supply a deterministic stub.
 */
export type TextMeasurer = (text: string, fontSize: number) => number;

/** Font size used by text annotations that don't carry their own. */
export const DEFAULT_FONT_SIZE = 16;

/** Annotation types that expose resize and rotation handles. */
export const TRANSFORMABLE_TYPES: readonly AnnotationTool[] = [
  'rectangle',
  'circle',
  'arrow',
  'line',
  'highlight',
  'blur',
];
