/**
 * generatePrompt - Turn image annotations into a ready-to-paste text prompt.
 *
 * Pure, dependency-free functions so they are easy to test and reuse.
 * The generated prompt describes each mark factually (color, shape, region,
 * label) so an image model can act on the annotated image precisely.
 */

import { ANNOTATION_COLORS } from '../components/ColorPicker';

export interface Point {
  x: number;
  y: number;
}

/** Minimal shape of an annotation needed to describe it. Matches AnnotationOverlay's Annotation. */
export interface PromptAnnotation {
  type: string;
  color: string;
  text?: string;
  position?: Point;
  start?: Point;
  end?: Point;
  points?: Point[];
  calloutNumber?: number;
  stamp?: string;
}

/** Map a hex value to a human-readable color name, falling back to the raw value. */
export function colorName(hex: string): string {
  if (!hex) return 'colored';
  const match = ANNOTATION_COLORS.find(
    (c) => c.value.toLowerCase() === hex.toLowerCase()
  );
  return match ? match.name.toLowerCase() : hex.toLowerCase();
}

/** Compute a representative center point for any annotation type. */
export function annotationCenter(a: PromptAnnotation): Point | null {
  if (a.position) return a.position;
  if (a.start && a.end) {
    return { x: (a.start.x + a.end.x) / 2, y: (a.start.y + a.end.y) / 2 };
  }
  if (a.points && a.points.length > 0) {
    const sum = a.points.reduce(
      (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
      { x: 0, y: 0 }
    );
    return { x: sum.x / a.points.length, y: sum.y / a.points.length };
  }
  return null;
}

/** Describe a point as a 3x3 grid region (e.g. "top-left", "center"). */
export function positionRegion(point: Point | null, width: number, height: number): string {
  if (!point || width <= 0 || height <= 0) return 'the image';
  const col = point.x < width / 3 ? 'left' : point.x < (2 * width) / 3 ? 'center' : 'right';
  const row = point.y < height / 3 ? 'top' : point.y < (2 * height) / 3 ? 'middle' : 'bottom';
  if (row === 'middle' && col === 'center') return 'the center';
  const rowWord = row === 'middle' ? 'center' : row;
  return `the ${rowWord}-${col}`;
}

/** Human-readable description of a single annotation (without its label). */
function describeShape(a: PromptAnnotation, region: string): string {
  const color = colorName(a.color);
  switch (a.type) {
    case 'rectangle':
      return `a ${color} box around ${region}`;
    case 'circle':
      return `a ${color} circle around ${region}`;
    case 'arrow':
      return `a ${color} arrow pointing to ${region}`;
    case 'line':
      return `a ${color} line at ${region}`;
    case 'draw':
      return `a ${color} freehand mark at ${region}`;
    case 'highlight':
      return `a ${color} highlighted area at ${region}`;
    case 'blur':
      return `a redacted/blurred area at ${region}`;
    case 'callout':
      return `numbered marker ${a.calloutNumber ?? ''}`.trim() + ` at ${region}`;
    case 'stamp':
      return `a ${a.stamp ?? ''} stamp at ${region}`.replace('  ', ' ');
    case 'text':
      return `${color} text at ${region}`;
    default:
      return `a ${color} mark at ${region}`;
  }
}

export interface GeneratePromptOptions {
  /** Optional overall goal the user typed (e.g. "make the room warmer"). */
  goal?: string;
}

/**
 * Build a prompt describing every annotation on the image.
 * Returns an empty string when there are no annotations.
 */
export function generatePrompt(
  annotations: PromptAnnotation[],
  canvasWidth: number,
  canvasHeight: number,
  options: GeneratePromptOptions = {}
): string {
  if (!annotations || annotations.length === 0) return '';

  const lines = annotations.map((a, i) => {
    const region = positionRegion(annotationCenter(a), canvasWidth, canvasHeight);
    const shape = describeShape(a, region);
    // Text annotations carry their own instruction; quote it.
    if (a.type === 'text' && a.text) {
      return `${i + 1}. ${shape} saying "${a.text}"`;
    }
    return `${i + 1}. ${shape}`;
  });

  const count = annotations.length;
  const noun = count === 1 ? 'annotation' : 'annotations';

  const header = `Edit this image based on the ${count} ${noun} marked on it:`;
  const footer = options.goal
    ? `\nOverall goal: ${options.goal}\n\nApply these changes precisely to the marked regions while keeping everything else in the image consistent.`
    : `\nApply these changes precisely to the marked regions while keeping everything else in the image consistent.`;

  return `${header}\n\n${lines.join('\n')}\n${footer}`;
}
