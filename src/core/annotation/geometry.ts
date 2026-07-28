/**
 * Annotation geometry — hit testing, transform handles, resize, rotation.
 *
 * Every function here is pure: same inputs, same output, no DOM, no canvas.
 * Text measurement, the one genuinely font-dependent operation, arrives as a
 * `TextMeasurer` callback so the whole module stays testable in isolation.
 *
 * Coordinates are in the canvas's CSS-pixel space (see `AnnotationOverlay`'s
 * `displaySizeRef`), not the backing store's device pixels.
 */

import {
  DEFAULT_FONT_SIZE,
  TRANSFORMABLE_TYPES,
  type Annotation,
  type Point,
  type ResizeHandle,
  type TextMeasurer,
} from './types';

/** Click tolerance around an annotation's stroke, in CSS pixels. */
const HIT_PADDING = 10;
/** Click radius of a resize handle. */
const RESIZE_HANDLE_RADIUS = 6;
/** Click radius of the rotation handle. */
const ROTATION_HANDLE_RADIUS = 8;
/** Distance from the shape's top edge to the rotation handle. */
const ROTATION_HANDLE_DISTANCE = 25;
/** Drawn radius of a callout bubble. */
const CALLOUT_RADIUS = 14;
/** Approximate hit radius of an emoji stamp. */
const STAMP_RADIUS = 18;

/** Rotate a point around a center by `angle` radians. */
export function rotatePoint(point: Point, center: Point, angle: number): Point {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}

/** Shortest distance from a point to a line segment. */
export function distanceToLineSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.sqrt((p.x - a.x) ** 2 + (p.y - a.y) ** 2);

  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));

  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.sqrt((p.x - projX) ** 2 + (p.y - projY) ** 2);
}

/**
 * Center of an annotation — the point rotation pivots around, and the reference
 * for drag offsets.
 */
export function getAnnotationCenter(annotation: Annotation): Point {
  switch (annotation.type) {
    case 'text':
    case 'callout':
      return annotation.position || { x: 0, y: 0 };
    case 'draw':
      if (annotation.points && annotation.points.length > 0) {
        const sumX = annotation.points.reduce((acc, p) => acc + p.x, 0);
        const sumY = annotation.points.reduce((acc, p) => acc + p.y, 0);
        return { x: sumX / annotation.points.length, y: sumY / annotation.points.length };
      }
      return { x: 0, y: 0 };
    default:
      if (annotation.start && annotation.end) {
        return {
          x: (annotation.start.x + annotation.end.x) / 2,
          y: (annotation.start.y + annotation.end.y) / 2,
        };
      }
      return { x: 0, y: 0 };
  }
}

/** Translate every coordinate of an annotation by `delta`. */
export function moveAnnotation(annotation: Annotation, delta: Point): Annotation {
  switch (annotation.type) {
    case 'text':
    case 'callout':
    case 'stamp':
      return {
        ...annotation,
        position: annotation.position
          ? { x: annotation.position.x + delta.x, y: annotation.position.y + delta.y }
          : undefined,
      };
    case 'draw':
      return {
        ...annotation,
        points: annotation.points?.map((p) => ({ x: p.x + delta.x, y: p.y + delta.y })),
      };
    default:
      return {
        ...annotation,
        start: annotation.start
          ? { x: annotation.start.x + delta.x, y: annotation.start.y + delta.y }
          : undefined,
        end: annotation.end
          ? { x: annotation.end.x + delta.x, y: annotation.end.y + delta.y }
          : undefined,
      };
  }
}

/**
 * Rescale every stored coordinate by `ratio`. Annotation positions live in the
 * canvas's CSS-pixel space, which is derived from the viewport, so a window
 * resize changes that space out from under them. Sizes (stroke width, font size)
 * stay fixed so annotations remain legible at any display scale.
 */
export function scaleAnnotations(list: Annotation[], ratio: number): Annotation[] {
  if (!Number.isFinite(ratio) || ratio <= 0 || ratio === 1) return list;
  const scalePoint = (p: Point): Point => ({ x: p.x * ratio, y: p.y * ratio });
  return list.map((annotation) => ({
    ...annotation,
    points: annotation.points?.map(scalePoint),
    start: annotation.start ? scalePoint(annotation.start) : undefined,
    end: annotation.end ? scalePoint(annotation.end) : undefined,
    position: annotation.position ? scalePoint(annotation.position) : undefined,
  }));
}

/** Constrain a drag endpoint for Shift: perfect squares/circles, 45° arrows. */
export function constrainPoint(start: Point, end: Point, type: Annotation['type']): Point {
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  if (type === 'rectangle' || type === 'circle') {
    const size = Math.max(Math.abs(dx), Math.abs(dy));
    return {
      x: start.x + size * Math.sign(dx || 1),
      y: start.y + size * Math.sign(dy || 1),
    };
  }

  if (type === 'arrow') {
    const angle = Math.atan2(dy, dx);
    const snapAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
    const length = Math.sqrt(dx * dx + dy * dy);
    return {
      x: start.x + length * Math.cos(snapAngle),
      y: start.y + length * Math.sin(snapAngle),
    };
  }

  return end;
}

/** Axis-aligned bounds of a start/end annotation, or null if it has none. */
function localBounds(
  annotation: Annotation
): { minX: number; maxX: number; minY: number; maxY: number } | null {
  if (!annotation.start || !annotation.end) return null;
  return {
    minX: Math.min(annotation.start.x, annotation.end.x),
    maxX: Math.max(annotation.start.x, annotation.end.x),
    minY: Math.min(annotation.start.y, annotation.end.y),
    maxY: Math.max(annotation.start.y, annotation.end.y),
  };
}

/** Unrotated position of a named handle on the annotation's bounding box. */
export function getLocalCorner(annotation: Annotation, handle: ResizeHandle): Point | null {
  const bounds = localBounds(annotation);
  if (!bounds) return null;

  const { minX, maxX, minY, maxY } = bounds;
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;

  switch (handle) {
    case 'nw': return { x: minX, y: minY };
    case 'n': return { x: midX, y: minY };
    case 'ne': return { x: maxX, y: minY };
    case 'e': return { x: maxX, y: midY };
    case 'se': return { x: maxX, y: maxY };
    case 's': return { x: midX, y: maxY };
    case 'sw': return { x: minX, y: maxY };
    case 'w': return { x: minX, y: midY };
  }
}

/**
 * The handle that stays put while `handle` is dragged. Corner handles anchor to
 * the opposite corner; edge handles anchor to a corner on the opposite side so
 * the perpendicular dimension is preserved.
 */
export function getAnchorHandle(handle: ResizeHandle): ResizeHandle {
  const anchors: Record<ResizeHandle, ResizeHandle> = {
    nw: 'se', n: 'se', ne: 'sw', e: 'sw',
    se: 'nw', s: 'nw', sw: 'ne', w: 'ne',
  };
  return anchors[handle];
}

/** Visible resize handles for an annotation, with rotation already applied. */
export function getResizeHandles(
  annotation: Annotation
): { handle: ResizeHandle; point: Point }[] {
  if (!TRANSFORMABLE_TYPES.includes(annotation.type)) return [];

  const bounds = localBounds(annotation);
  if (!bounds || !annotation.start || !annotation.end) return [];

  const { minX, maxX, minY, maxY } = bounds;
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;

  // Arrows and lines are defined by their endpoints, not a box, so they only
  // expose the two endpoint handles.
  let handles: { handle: ResizeHandle; point: Point }[] =
    annotation.type === 'arrow' || annotation.type === 'line'
      ? [
          { handle: 'nw', point: annotation.start },
          { handle: 'se', point: annotation.end },
        ]
      : [
          { handle: 'nw', point: { x: minX, y: minY } },
          { handle: 'n', point: { x: midX, y: minY } },
          { handle: 'ne', point: { x: maxX, y: minY } },
          { handle: 'e', point: { x: maxX, y: midY } },
          { handle: 'se', point: { x: maxX, y: maxY } },
          { handle: 's', point: { x: midX, y: maxY } },
          { handle: 'sw', point: { x: minX, y: maxY } },
          { handle: 'w', point: { x: minX, y: midY } },
        ];

  const rotation = annotation.rotation || 0;
  if (rotation !== 0) {
    const center = getAnnotationCenter(annotation);
    handles = handles.map(({ handle, point }) => ({
      handle,
      point: rotatePoint(point, center, rotation),
    }));
  }

  return handles;
}

/** Which resize handle, if any, sits under `point`. */
export function findResizeHandleAtPoint(
  point: Point,
  annotation: Annotation
): ResizeHandle | null {
  for (const { handle, point: handlePoint } of getResizeHandles(annotation)) {
    const dx = point.x - handlePoint.x;
    const dy = point.y - handlePoint.y;
    if (Math.sqrt(dx * dx + dy * dy) <= RESIZE_HANDLE_RADIUS) return handle;
  }
  return null;
}

/** Position of the rotation handle, above the shape's top edge. */
export function getRotationHandlePosition(annotation: Annotation): Point | null {
  if (!TRANSFORMABLE_TYPES.includes(annotation.type)) return null;
  if (!annotation.start || !annotation.end) return null;

  const minY = Math.min(annotation.start.y, annotation.end.y);
  const midX = (annotation.start.x + annotation.end.x) / 2;

  return rotatePoint(
    { x: midX, y: minY - ROTATION_HANDLE_DISTANCE },
    getAnnotationCenter(annotation),
    annotation.rotation || 0
  );
}

/** Whether `point` lands on the rotation handle. */
export function isPointOnRotationHandle(point: Point, annotation: Annotation): boolean {
  const handlePos = getRotationHandlePosition(annotation);
  if (!handlePos) return false;

  const dx = point.x - handlePos.x;
  const dy = point.y - handlePos.y;
  return Math.sqrt(dx * dx + dy * dy) <= ROTATION_HANDLE_RADIUS;
}

/**
 * Apply a resize drag, keeping the anchor corner visually fixed.
 *
 * `screenDelta` is the pointer movement in canvas space; for a rotated shape it
 * is first transformed into the shape's local (unrotated) space, the bounds are
 * recomputed there, and the result is translated so the anchor lands back on
 * `anchorVisualPos`.
 */
export function resizeAnnotation(
  annotation: Annotation,
  handle: ResizeHandle,
  screenDelta: Point,
  anchorVisualPos: Point
): Annotation {
  if (!annotation.start || !annotation.end) return annotation;

  const rotation = annotation.rotation || 0;

  // Transform the screen delta into local (unrotated) space.
  const cos = Math.cos(-rotation);
  const sin = Math.sin(-rotation);
  const localDelta = {
    x: screenDelta.x * cos - screenDelta.y * sin,
    y: screenDelta.x * sin + screenDelta.y * cos,
  };

  // Arrows and lines move a single endpoint.
  if (annotation.type === 'arrow' || annotation.type === 'line') {
    if (handle === 'nw') {
      return {
        ...annotation,
        start: { x: annotation.start.x + localDelta.x, y: annotation.start.y + localDelta.y },
      };
    }
    if (handle === 'se') {
      return {
        ...annotation,
        end: { x: annotation.end.x + localDelta.x, y: annotation.end.y + localDelta.y },
      };
    }
    return annotation;
  }

  if (rotation === 0) {
    let newStart = { ...annotation.start };
    let newEnd = { ...annotation.end };

    switch (handle) {
      case 'nw':
        newStart = { x: annotation.start.x + localDelta.x, y: annotation.start.y + localDelta.y };
        break;
      case 'n':
        newStart = { ...annotation.start, y: annotation.start.y + localDelta.y };
        break;
      case 'ne':
        newStart = { ...annotation.start, y: annotation.start.y + localDelta.y };
        newEnd = { ...annotation.end, x: annotation.end.x + localDelta.x };
        break;
      case 'e':
        newEnd = { ...annotation.end, x: annotation.end.x + localDelta.x };
        break;
      case 'se':
        newEnd = { x: annotation.end.x + localDelta.x, y: annotation.end.y + localDelta.y };
        break;
      case 's':
        newEnd = { ...annotation.end, y: annotation.end.y + localDelta.y };
        break;
      case 'sw':
        newStart = { ...annotation.start, x: annotation.start.x + localDelta.x };
        newEnd = { ...annotation.end, y: annotation.end.y + localDelta.y };
        break;
      case 'w':
        newStart = { ...annotation.start, x: annotation.start.x + localDelta.x };
        break;
    }

    return { ...annotation, start: newStart, end: newEnd };
  }

  const anchorHandle = getAnchorHandle(handle);
  const anchorLocal = getLocalCorner(annotation, anchorHandle);
  const draggedLocal = getLocalCorner(annotation, handle);
  if (!anchorLocal || !draggedLocal) return annotation;

  // Edge handles move along one axis only.
  const adjustedDraggedLocal = {
    x: handle === 'n' || handle === 's' ? draggedLocal.x : draggedLocal.x + localDelta.x,
    y: handle === 'e' || handle === 'w' ? draggedLocal.y : draggedLocal.y + localDelta.y,
  };

  const minX = Math.min(anchorLocal.x, adjustedDraggedLocal.x);
  const maxX = Math.max(anchorLocal.x, adjustedDraggedLocal.x);
  const minY = Math.min(anchorLocal.y, adjustedDraggedLocal.y);
  const maxY = Math.max(anchorLocal.y, adjustedDraggedLocal.y);

  // Edge handles preserve the perpendicular dimension.
  let newStart: Point;
  let newEnd: Point;
  if (handle === 'n' || handle === 's') {
    newStart = { x: annotation.start.x, y: minY };
    newEnd = { x: annotation.end.x, y: maxY };
  } else if (handle === 'e' || handle === 'w') {
    newStart = { x: minX, y: annotation.start.y };
    newEnd = { x: maxX, y: annotation.end.y };
  } else {
    newStart = { x: minX, y: minY };
    newEnd = { x: maxX, y: maxY };
  }

  const newCenter = {
    x: (newStart.x + newEnd.x) / 2,
    y: (newStart.y + newEnd.y) / 2,
  };

  // Where the anchor would land with the new bounds — the shape is then
  // translated by the difference so it stays put on screen. Rotation happens
  // around the center, and center and anchor move together, so the visual
  // offset equals the local offset.
  const resized = { ...annotation, start: newStart, end: newEnd };
  const newAnchorLocal = getLocalCorner(resized, anchorHandle);
  if (!newAnchorLocal) return resized;

  const anchorNewVisualPos = rotatePoint(newAnchorLocal, newCenter, rotation);
  const offset = {
    x: anchorVisualPos.x - anchorNewVisualPos.x,
    y: anchorVisualPos.y - anchorNewVisualPos.y,
  };

  return {
    ...annotation,
    start: { x: newStart.x + offset.x, y: newStart.y + offset.y },
    end: { x: newEnd.x + offset.x, y: newEnd.y + offset.y },
  };
}

/** Whether an unrotated point hits a single annotation's drawn geometry. */
function hitsAnnotation(
  annotation: Annotation,
  point: Point,
  measureText: TextMeasurer
): boolean {
  switch (annotation.type) {
    case 'text': {
      if (!annotation.position || !annotation.text) return false;
      const fontSize = annotation.fontSize || DEFAULT_FONT_SIZE;
      const width = measureText(annotation.text, fontSize);
      const padding = 4;
      return (
        point.x >= annotation.position.x - padding &&
        point.x <= annotation.position.x + width + padding &&
        point.y >= annotation.position.y - fontSize - padding &&
        point.y <= annotation.position.y + padding
      );
    }

    case 'rectangle': {
      const bounds = localBounds(annotation);
      if (!bounds) return false;
      const { minX, maxX, minY, maxY } = bounds;
      // Only the stroke is clickable, so a rectangle drawn around something
      // doesn't swallow clicks meant for what's inside it.
      const nearLeft = Math.abs(point.x - minX) < HIT_PADDING && point.y >= minY && point.y <= maxY;
      const nearRight = Math.abs(point.x - maxX) < HIT_PADDING && point.y >= minY && point.y <= maxY;
      const nearTop = Math.abs(point.y - minY) < HIT_PADDING && point.x >= minX && point.x <= maxX;
      const nearBottom = Math.abs(point.y - maxY) < HIT_PADDING && point.x >= minX && point.x <= maxX;
      return nearLeft || nearRight || nearTop || nearBottom;
    }

    case 'circle': {
      if (!annotation.start || !annotation.end) return false;
      const centerX = (annotation.start.x + annotation.end.x) / 2;
      const centerY = (annotation.start.y + annotation.end.y) / 2;
      const radiusX = Math.abs(annotation.end.x - annotation.start.x) / 2;
      const radiusY = Math.abs(annotation.end.y - annotation.start.y) / 2;
      if (radiusX === 0 || radiusY === 0) return false;
      const dx = point.x - centerX;
      const dy = point.y - centerY;
      const normalizedDist = (dx * dx) / (radiusX * radiusX) + (dy * dy) / (radiusY * radiusY);
      return Math.abs(normalizedDist - 1) < 0.3;
    }

    case 'arrow':
    case 'line':
      if (!annotation.start || !annotation.end) return false;
      return distanceToLineSegment(point, annotation.start, annotation.end) < HIT_PADDING;

    case 'draw':
      if (!annotation.points || annotation.points.length === 0) return false;
      return annotation.points.some(
        (p) => Math.sqrt((point.x - p.x) ** 2 + (point.y - p.y) ** 2) < HIT_PADDING
      );

    case 'callout': {
      if (!annotation.position) return false;
      const dx = point.x - annotation.position.x;
      const dy = point.y - annotation.position.y;
      return Math.sqrt(dx * dx + dy * dy) <= CALLOUT_RADIUS + HIT_PADDING;
    }

    case 'stamp': {
      if (!annotation.position) return false;
      const dx = point.x - annotation.position.x;
      const dy = point.y - annotation.position.y;
      return Math.sqrt(dx * dx + dy * dy) <= STAMP_RADIUS + HIT_PADDING;
    }

    case 'highlight':
    case 'blur': {
      const bounds = localBounds(annotation);
      if (!bounds) return false;
      // Filled regions are clickable anywhere inside.
      return (
        point.x >= bounds.minX &&
        point.x <= bounds.maxX &&
        point.y >= bounds.minY &&
        point.y <= bounds.maxY
      );
    }

    default:
      return false;
  }
}

/**
 * Topmost annotation under `point`, or null.
 *
 * A rotated annotation is drawn by rotating the canvas around its center, so the
 * click is transformed by the inverse rotation before being compared against the
 * stored (unrotated) coordinates — otherwise the clickable region would stay
 * axis-aligned while the shape visibly turned away from it.
 */
export function findAnnotationAtPoint(
  annotations: readonly Annotation[],
  point: Point,
  measureText: TextMeasurer
): Annotation | null {
  for (let i = annotations.length - 1; i >= 0; i--) {
    const annotation = annotations[i];
    const rotation = annotation.rotation || 0;
    const localPoint =
      rotation !== 0
        ? rotatePoint(point, getAnnotationCenter(annotation), -rotation)
        : point;

    if (hitsAnnotation(annotation, localPoint, measureText)) return annotation;
  }
  return null;
}

/** Resize cursor for a handle, accounting for the shape's rotation. */
export function getCursorForHandle(handle: ResizeHandle, rotation = 0): string {
  const handleAngles: Record<ResizeHandle, number> = {
    e: 0,
    se: Math.PI / 4,
    s: Math.PI / 2,
    sw: (3 * Math.PI) / 4,
    w: Math.PI,
    nw: -(3 * Math.PI) / 4,
    n: -Math.PI / 2,
    ne: -Math.PI / 4,
  };

  let effectiveAngle = handleAngles[handle] + rotation;
  while (effectiveAngle < 0) effectiveAngle += Math.PI * 2;
  while (effectiveAngle >= Math.PI * 2) effectiveAngle -= Math.PI * 2;

  // Eight 45° sectors collapse onto four cursors (opposite sectors share one).
  switch (Math.round((effectiveAngle / Math.PI) * 4) % 4) {
    case 0: return 'ew-resize';
    case 1: return 'nwse-resize';
    case 2: return 'ns-resize';
    case 3: return 'nesw-resize';
    default: return 'pointer';
  }
}
