/**
 * generatePrompt - Turn image annotations into a ready-to-paste text prompt.
 *
 * Pure, dependency-free functions so they are easy to test and reuse.
 * The generated prompt describes each mark factually (color, shape, region,
 * label) so an image model can act on the annotated image precisely.
 */

import { ANNOTATION_COLORS } from '@/src/core/colors';

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

/** Axis-aligned bounding box of an annotation, or null if it has no geometry. */
export function boundingBox(a: PromptAnnotation): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (a.start && a.end) {
    return {
      minX: Math.min(a.start.x, a.end.x),
      minY: Math.min(a.start.y, a.end.y),
      maxX: Math.max(a.start.x, a.end.x),
      maxY: Math.max(a.start.y, a.end.y),
    };
  }
  if (a.points && a.points.length > 0) {
    const xs = a.points.map((p) => p.x);
    const ys = a.points.map((p) => p.y);
    return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
  }
  if (a.position) {
    // Point-like annotations (text/stamp): treat as a small box around the point.
    const r = 16;
    return { minX: a.position.x - r, minY: a.position.y - r, maxX: a.position.x + r, maxY: a.position.y + r };
  }
  return null;
}

/** Shortest distance from a point to an axis-aligned box (0 if inside). */
function distanceToBox(p: Point, box: { minX: number; minY: number; maxX: number; maxY: number }): number {
  const dx = Math.max(box.minX - p.x, 0, p.x - box.maxX);
  const dy = Math.max(box.minY - p.y, 0, p.y - box.maxY);
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Associate each numbered callout with the nearest non-callout annotation.
 * Returns a map of annotation index -> callout number, and the set of callout
 * indices that were consumed (so they aren't listed twice).
 */
export function associateCallouts(
  annotations: PromptAnnotation[],
  canvasWidth: number,
  canvasHeight: number
): { markerOf: Map<number, number>; consumed: Set<number> } {
  const markerOf = new Map<number, number>();
  const consumed = new Set<number>();
  const diagonal = Math.sqrt(canvasWidth * canvasWidth + canvasHeight * canvasHeight);
  const threshold = diagonal > 0 ? diagonal * 0.1 : 80;

  annotations.forEach((callout, ci) => {
    if (callout.type !== 'callout' || callout.calloutNumber === undefined) return;
    const center = annotationCenter(callout);
    if (!center) return;

    let bestIndex = -1;
    let bestDist = Infinity;
    annotations.forEach((other, oi) => {
      if (oi === ci || other.type === 'callout') return;
      if (markerOf.has(oi)) return; // already tagged by another callout
      const box = boundingBox(other);
      if (!box) return;
      const dist = distanceToBox(center, box);
      if (dist < bestDist) {
        bestDist = dist;
        bestIndex = oi;
      }
    });

    if (bestIndex >= 0 && bestDist <= threshold) {
      markerOf.set(bestIndex, callout.calloutNumber);
      consumed.add(ci);
    }
  });

  return { markerOf, consumed };
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
      return `a numbered marker at ${region}`;
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

  // Attach nearby callout numbers to their shapes so they read as references.
  const { markerOf, consumed } = associateCallouts(annotations, canvasWidth, canvasHeight);

  const lines: string[] = [];
  annotations.forEach((a, i) => {
    // Skip callouts that were merged into a nearby annotation.
    if (a.type === 'callout' && consumed.has(i)) return;

    const region = positionRegion(annotationCenter(a), canvasWidth, canvasHeight);
    const shape = describeShape(a, region);
    const body = a.type === 'text' && a.text ? `${shape} saying "${a.text}"` : shape;

    // A tagged shape (or a standalone callout) is referenced by its number;
    // everything else is a plain bullet.
    const marker = markerOf.get(i);
    if (marker !== undefined) {
      lines.push(`${marker}. ${body}`);
    } else if (a.type === 'callout' && a.calloutNumber !== undefined) {
      lines.push(`${a.calloutNumber}. ${body}`);
    } else {
      lines.push(`- ${body}`);
    }
  });

  const count = lines.length;
  const noun = count === 1 ? 'annotation' : 'annotations';

  const header = `Edit this image based on the ${count} ${noun} marked on it:`;
  const footer = options.goal
    ? `\nOverall goal: ${options.goal}\n\nApply these changes precisely to the marked regions while keeping everything else in the image consistent.`
    : `\nApply these changes precisely to the marked regions while keeping everything else in the image consistent.`;

  return `${header}\n\n${lines.join('\n')}\n${footer}`;
}
