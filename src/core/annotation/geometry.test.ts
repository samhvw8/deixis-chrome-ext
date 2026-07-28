import { describe, expect, it } from 'bun:test';
import {
  constrainPoint,
  distanceToLineSegment,
  findAnnotationAtPoint,
  findResizeHandleAtPoint,
  getAnchorHandle,
  getAnnotationCenter,
  getCursorForHandle,
  getLocalCorner,
  getResizeHandles,
  getRotationHandlePosition,
  isPointOnRotationHandle,
  moveAnnotation,
  resizeAnnotation,
  rotatePoint,
  scaleAnnotations,
} from './geometry';
import type { Annotation, Point, TextMeasurer } from './types';

/** Deterministic stand-in for canvas text metrics: 8px per character. */
const measure: TextMeasurer = (text, fontSize) => text.length * (fontSize / 2);

const make = (overrides: Partial<Annotation> = {}): Annotation => ({
  id: 'a1',
  type: 'rectangle',
  color: '#EF4444',
  strokeWidth: 3,
  opacity: 1,
  start: { x: 100, y: 100 },
  end: { x: 200, y: 200 },
  ...overrides,
});

const closeTo = (actual: Point, expected: Point, digits = 6) => {
  expect(actual.x).toBeCloseTo(expected.x, digits);
  expect(actual.y).toBeCloseTo(expected.y, digits);
};

describe('rotatePoint', () => {
  it('leaves the center fixed', () => {
    closeTo(rotatePoint({ x: 50, y: 50 }, { x: 50, y: 50 }, Math.PI / 3), { x: 50, y: 50 });
  });

  it('rotates a quarter turn clockwise in screen coordinates', () => {
    closeTo(rotatePoint({ x: 10, y: 0 }, { x: 0, y: 0 }, Math.PI / 2), { x: 0, y: 10 });
  });

  it('is inverted by the negated angle', () => {
    const center = { x: 12, y: -4 };
    const rotated = rotatePoint({ x: 33, y: 71 }, center, 1.1);
    closeTo(rotatePoint(rotated, center, -1.1), { x: 33, y: 71 });
  });
});

describe('distanceToLineSegment', () => {
  it('measures perpendicular distance to the segment body', () => {
    expect(distanceToLineSegment({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(3);
  });

  it('clamps past the endpoints instead of extending the line', () => {
    expect(distanceToLineSegment({ x: 20, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(10);
  });

  it('handles a degenerate zero-length segment', () => {
    expect(distanceToLineSegment({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 0, y: 0 })).toBe(5);
  });
});

describe('getAnnotationCenter', () => {
  it('uses the midpoint of start and end for shapes', () => {
    expect(getAnnotationCenter(make())).toEqual({ x: 150, y: 150 });
  });

  it('uses the stored position for text and callouts', () => {
    const at = { x: 40, y: 60 };
    expect(getAnnotationCenter(make({ type: 'text', position: at }))).toEqual(at);
    expect(getAnnotationCenter(make({ type: 'callout', position: at }))).toEqual(at);
  });

  it('averages the path for freehand draw', () => {
    const draw = make({
      type: 'draw',
      start: undefined,
      end: undefined,
      points: [{ x: 0, y: 0 }, { x: 10, y: 20 }, { x: 20, y: 10 }],
    });
    expect(getAnnotationCenter(draw)).toEqual({ x: 10, y: 10 });
  });

  it('falls back to the origin when geometry is missing', () => {
    expect(getAnnotationCenter(make({ start: undefined, end: undefined }))).toEqual({ x: 0, y: 0 });
  });
});

describe('moveAnnotation', () => {
  const delta = { x: 5, y: -7 };

  it('translates start and end for shapes', () => {
    const moved = moveAnnotation(make(), delta);
    expect(moved.start).toEqual({ x: 105, y: 93 });
    expect(moved.end).toEqual({ x: 205, y: 193 });
  });

  it('translates every point of a freehand path', () => {
    const draw = make({
      type: 'draw',
      start: undefined,
      end: undefined,
      points: [{ x: 0, y: 0 }, { x: 10, y: 10 }],
    });
    expect(moveAnnotation(draw, delta).points).toEqual([{ x: 5, y: -7 }, { x: 15, y: 3 }]);
  });

  it('translates the position of point-like annotations', () => {
    for (const type of ['text', 'callout', 'stamp'] as const) {
      const moved = moveAnnotation(
        make({ type, start: undefined, end: undefined, position: { x: 10, y: 10 } }),
        delta
      );
      expect(moved.position).toEqual({ x: 15, y: 3 });
    }
  });

  it('moves a stamp rather than silently dropping the drag', () => {
    // Regression: 'stamp' used to fall through to the start/end branch, so
    // dragging or duplicating one left it exactly where it was.
    const stamp = make({ type: 'stamp', start: undefined, end: undefined, position: { x: 30, y: 30 }, stamp: '✓' });
    expect(moveAnnotation(stamp, { x: 20, y: 20 }).position).toEqual({ x: 50, y: 50 });
  });
});

describe('scaleAnnotations', () => {
  it('rescales coordinates but not stroke width or font size', () => {
    const [scaled] = scaleAnnotations([make({ strokeWidth: 4, fontSize: 16 })], 2);
    expect(scaled.start).toEqual({ x: 200, y: 200 });
    expect(scaled.end).toEqual({ x: 400, y: 400 });
    expect(scaled.strokeWidth).toBe(4);
    expect(scaled.fontSize).toBe(16);
  });

  it('returns the same array reference for a no-op ratio', () => {
    const list = [make()];
    expect(scaleAnnotations(list, 1)).toBe(list);
    expect(scaleAnnotations(list, 0)).toBe(list);
    expect(scaleAnnotations(list, Number.NaN)).toBe(list);
  });
});

describe('constrainPoint', () => {
  it('forces a square from the dominant axis', () => {
    expect(constrainPoint({ x: 0, y: 0 }, { x: 100, y: 30 }, 'rectangle')).toEqual({ x: 100, y: 100 });
  });

  it('keeps the drag direction when squaring', () => {
    expect(constrainPoint({ x: 0, y: 0 }, { x: -100, y: -30 }, 'circle')).toEqual({ x: -100, y: -100 });
  });

  it('snaps an arrow to the nearest 45 degrees', () => {
    const snapped = constrainPoint({ x: 0, y: 0 }, { x: 100, y: 10 }, 'arrow');
    closeTo(snapped, { x: Math.hypot(100, 10), y: 0 });
  });

  it('leaves other tools untouched', () => {
    expect(constrainPoint({ x: 0, y: 0 }, { x: 3, y: 9 }, 'draw')).toEqual({ x: 3, y: 9 });
  });
});

describe('getResizeHandles', () => {
  it('exposes eight handles for a box shape', () => {
    expect(getResizeHandles(make()).map((h) => h.handle)).toEqual([
      'nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w',
    ]);
  });

  it('exposes only the endpoints for arrows and lines', () => {
    for (const type of ['arrow', 'line'] as const) {
      const handles = getResizeHandles(make({ type }));
      expect(handles.map((h) => h.handle)).toEqual(['nw', 'se']);
      expect(handles[0].point).toEqual({ x: 100, y: 100 });
    }
  });

  it('exposes none for annotations that cannot be resized', () => {
    for (const type of ['text', 'draw', 'callout', 'stamp'] as const) {
      expect(getResizeHandles(make({ type }))).toEqual([]);
    }
  });

  it('rotates handle positions with the shape', () => {
    const rotated = getResizeHandles(make({ rotation: Math.PI / 2 }));
    const nw = rotated.find((h) => h.handle === 'nw')!;
    // Center (150,150); nw (100,100) turned a quarter turn lands at (200,100).
    closeTo(nw.point, { x: 200, y: 100 });
  });
});

describe('findResizeHandleAtPoint', () => {
  it('finds a handle within its click radius', () => {
    expect(findResizeHandleAtPoint({ x: 102, y: 102 }, make())).toBe('nw');
  });

  it('returns null away from every handle', () => {
    expect(findResizeHandleAtPoint({ x: 150, y: 150 }, make())).toBeNull();
  });

  it('follows the handles of a rotated shape', () => {
    const annotation = make({ rotation: Math.PI / 2 });
    // A quarter turn walks each handle round one corner: nw → where ne was,
    // and the old nw corner is now occupied by sw.
    expect(findResizeHandleAtPoint({ x: 200, y: 100 }, annotation)).toBe('nw');
    expect(findResizeHandleAtPoint({ x: 100, y: 100 }, annotation)).toBe('sw');
    expect(findResizeHandleAtPoint({ x: 150, y: 150 }, annotation)).toBeNull();
  });
});

describe('rotation handle', () => {
  it('sits above the top edge when unrotated', () => {
    closeTo(getRotationHandlePosition(make())!, { x: 150, y: 75 });
  });

  it('is absent for non-transformable types', () => {
    expect(getRotationHandlePosition(make({ type: 'text' }))).toBeNull();
  });

  it('detects a hit within its radius', () => {
    expect(isPointOnRotationHandle({ x: 152, y: 77 }, make())).toBe(true);
    expect(isPointOnRotationHandle({ x: 150, y: 150 }, make())).toBe(false);
  });
});

describe('getAnchorHandle', () => {
  it('pairs each handle with the side that stays fixed', () => {
    expect(getAnchorHandle('nw')).toBe('se');
    expect(getAnchorHandle('se')).toBe('nw');
    expect(getAnchorHandle('n')).toBe('se');
    expect(getAnchorHandle('w')).toBe('ne');
  });
});

describe('getLocalCorner', () => {
  it('resolves every handle against the bounding box', () => {
    const a = make();
    expect(getLocalCorner(a, 'nw')).toEqual({ x: 100, y: 100 });
    expect(getLocalCorner(a, 'se')).toEqual({ x: 200, y: 200 });
    expect(getLocalCorner(a, 'n')).toEqual({ x: 150, y: 100 });
    expect(getLocalCorner(a, 'e')).toEqual({ x: 200, y: 150 });
  });

  it('normalizes an inverted box', () => {
    const inverted = make({ start: { x: 200, y: 200 }, end: { x: 100, y: 100 } });
    expect(getLocalCorner(inverted, 'nw')).toEqual({ x: 100, y: 100 });
  });
});

describe('resizeAnnotation', () => {
  const anchor = { x: 200, y: 200 };

  it('moves a corner and leaves the opposite one alone', () => {
    const resized = resizeAnnotation(make(), 'nw', { x: 20, y: 30 }, anchor);
    expect(resized.start).toEqual({ x: 120, y: 130 });
    expect(resized.end).toEqual({ x: 200, y: 200 });
  });

  it('constrains an edge handle to one axis', () => {
    const resized = resizeAnnotation(make(), 'e', { x: 40, y: 999 }, anchor);
    expect(resized.start).toEqual({ x: 100, y: 100 });
    expect(resized.end).toEqual({ x: 240, y: 200 });
  });

  it('moves only the dragged endpoint of an arrow', () => {
    const resized = resizeAnnotation(make({ type: 'arrow' }), 'se', { x: 10, y: 10 }, anchor);
    expect(resized.start).toEqual({ x: 100, y: 100 });
    expect(resized.end).toEqual({ x: 210, y: 210 });
  });

  it('preserves a line’s direction instead of rebuilding it from a box', () => {
    // Regression: a rotated line used to take the bounding-box path, which
    // rebuilt start/end from min/max and flipped lines drawn bottom-left to
    // top-right.
    const line = make({
      type: 'line',
      rotation: Math.PI / 4,
      start: { x: 100, y: 200 },
      end: { x: 200, y: 100 },
    });
    const resized = resizeAnnotation(line, 'nw', { x: 0, y: 0 }, anchor);
    expect(resized.start).toEqual({ x: 100, y: 200 });
    expect(resized.end).toEqual({ x: 200, y: 100 });
  });

  it('keeps the anchor corner visually fixed while resizing a rotated shape', () => {
    const rotation = Math.PI / 5;
    const annotation = make({ rotation });
    const anchorHandle = getAnchorHandle('nw');
    const anchorVisual = rotatePoint(
      getLocalCorner(annotation, anchorHandle)!,
      getAnnotationCenter(annotation),
      rotation
    );

    const resized = resizeAnnotation(annotation, 'nw', { x: 25, y: 15 }, anchorVisual);
    const anchorAfter = rotatePoint(
      getLocalCorner(resized, anchorHandle)!,
      getAnnotationCenter(resized),
      rotation
    );

    closeTo(anchorAfter, anchorVisual);
  });

  it('returns the annotation unchanged when it has no geometry', () => {
    const empty = make({ start: undefined, end: undefined });
    expect(resizeAnnotation(empty, 'nw', { x: 5, y: 5 }, anchor)).toBe(empty);
  });
});

describe('findAnnotationAtPoint', () => {
  it('hits a rectangle on its stroke, not its interior', () => {
    const list = [make()];
    expect(findAnnotationAtPoint(list, { x: 100, y: 150 }, measure)).toBe(list[0]);
    expect(findAnnotationAtPoint(list, { x: 150, y: 150 }, measure)).toBeNull();
  });

  it('returns the topmost annotation when several overlap', () => {
    const bottom = make({ id: 'bottom' });
    const top = make({ id: 'top' });
    expect(findAnnotationAtPoint([bottom, top], { x: 100, y: 150 }, measure)?.id).toBe('top');
  });

  it('hits a rotated rectangle where it is actually drawn', () => {
    // Regression: hit testing compared the raw click against unrotated bounds,
    // so a turned shape kept an invisible axis-aligned hit box and its visible
    // border was unclickable.
    const rotated = make({ rotation: Math.PI / 2 });
    // Center (150,150). The left edge midpoint (100,150) turns to (150,100).
    expect(findAnnotationAtPoint([rotated], { x: 150, y: 100 }, measure)).toBe(rotated);
  });

  it('no longer hits a rotated rectangle at its former unrotated border', () => {
    const rotated = make({ rotation: Math.PI / 4 });
    expect(findAnnotationAtPoint([rotated], { x: 100, y: 105 }, measure)).toBeNull();
  });

  it('hits a circle near its outline only', () => {
    const circle = make({ type: 'circle' });
    expect(findAnnotationAtPoint([circle], { x: 150, y: 100 }, measure)).toBe(circle);
    expect(findAnnotationAtPoint([circle], { x: 150, y: 150 }, measure)).toBeNull();
  });

  it('hits arrows and lines near the segment', () => {
    for (const type of ['arrow', 'line'] as const) {
      const a = make({ type });
      expect(findAnnotationAtPoint([a], { x: 150, y: 152 }, measure)).toBe(a);
      expect(findAnnotationAtPoint([a], { x: 100, y: 190 }, measure)).toBeNull();
    }
  });

  it('hits a freehand path near any of its points', () => {
    const draw = make({
      type: 'draw',
      start: undefined,
      end: undefined,
      points: [{ x: 10, y: 10 }, { x: 50, y: 50 }],
    });
    expect(findAnnotationAtPoint([draw], { x: 52, y: 52 }, measure)).toBe(draw);
    expect(findAnnotationAtPoint([draw], { x: 30, y: 30 }, measure)).toBeNull();
  });

  it('hits filled regions anywhere inside', () => {
    for (const type of ['highlight', 'blur'] as const) {
      const a = make({ type });
      expect(findAnnotationAtPoint([a], { x: 150, y: 150 }, measure)).toBe(a);
      expect(findAnnotationAtPoint([a], { x: 250, y: 150 }, measure)).toBeNull();
    }
  });

  it('hits callouts and stamps within their radius', () => {
    const callout = make({ type: 'callout', start: undefined, end: undefined, position: { x: 50, y: 50 } });
    expect(findAnnotationAtPoint([callout], { x: 60, y: 50 }, measure)).toBe(callout);
    expect(findAnnotationAtPoint([callout], { x: 100, y: 50 }, measure)).toBeNull();

    const stamp = make({ type: 'stamp', start: undefined, end: undefined, position: { x: 50, y: 50 }, stamp: '✓' });
    expect(findAnnotationAtPoint([stamp], { x: 70, y: 50 }, measure)).toBe(stamp);
  });

  it('measures text through the injected measurer', () => {
    const text = make({
      type: 'text',
      start: undefined,
      end: undefined,
      position: { x: 100, y: 100 },
      text: 'hello',
      fontSize: 20,
    });
    // measure() gives 5 chars * 10px = 50px wide, 20px tall above the baseline.
    expect(findAnnotationAtPoint([text], { x: 140, y: 95 }, measure)).toBe(text);
    expect(findAnnotationAtPoint([text], { x: 200, y: 95 }, measure)).toBeNull();
  });

  it('ignores annotations with missing geometry', () => {
    expect(findAnnotationAtPoint([make({ start: undefined, end: undefined })], { x: 0, y: 0 }, measure)).toBeNull();
  });
});

describe('getCursorForHandle', () => {
  it('maps the unrotated handles to their axis cursors', () => {
    expect(getCursorForHandle('e')).toBe('ew-resize');
    expect(getCursorForHandle('n')).toBe('ns-resize');
    expect(getCursorForHandle('se')).toBe('nwse-resize');
    expect(getCursorForHandle('ne')).toBe('nesw-resize');
  });

  it('rotates the cursor with the shape', () => {
    // A quarter turn makes the east handle point south.
    expect(getCursorForHandle('e', Math.PI / 2)).toBe('ns-resize');
    expect(getCursorForHandle('n', Math.PI / 2)).toBe('ew-resize');
  });

  it('normalizes angles outside a single turn', () => {
    expect(getCursorForHandle('e', -Math.PI / 2)).toBe('ns-resize');
    expect(getCursorForHandle('e', Math.PI * 4)).toBe('ew-resize');
  });
});
