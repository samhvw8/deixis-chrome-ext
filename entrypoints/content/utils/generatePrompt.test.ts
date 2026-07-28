import { describe, expect, it } from 'bun:test';
import {
  annotationCenter,
  associateCallouts,
  boundingBox,
  colorName,
  generatePrompt,
  positionRegion,
  type PromptAnnotation,
} from './generatePrompt';

const W = 900;
const H = 600;

const rect = (overrides: Partial<PromptAnnotation> = {}): PromptAnnotation => ({
  type: 'rectangle',
  color: '#EF4444',
  start: { x: 100, y: 100 },
  end: { x: 200, y: 200 },
  ...overrides,
});

describe('colorName', () => {
  it('maps a known hex to its palette name, case-insensitively', () => {
    expect(colorName('#EF4444')).toBe('red');
    expect(colorName('#ef4444')).toBe('red');
  });

  it('falls back to the raw value for a custom color', () => {
    expect(colorName('#123456')).toBe('#123456');
  });

  it('handles an empty value', () => {
    expect(colorName('')).toBe('colored');
  });
});

describe('annotationCenter', () => {
  it('prefers an explicit position', () => {
    expect(annotationCenter({ type: 'text', color: '#fff', position: { x: 5, y: 6 } })).toEqual({ x: 5, y: 6 });
  });

  it('averages start and end for shapes', () => {
    expect(annotationCenter(rect())).toEqual({ x: 150, y: 150 });
  });

  it('averages freehand points', () => {
    const center = annotationCenter({
      type: 'draw',
      color: '#fff',
      points: [{ x: 0, y: 0 }, { x: 10, y: 20 }],
    });
    expect(center).toEqual({ x: 5, y: 10 });
  });

  it('returns null when there is no geometry', () => {
    expect(annotationCenter({ type: 'draw', color: '#fff' })).toBeNull();
  });
});

describe('boundingBox', () => {
  it('normalizes a box drawn right-to-left', () => {
    const box = boundingBox(rect({ start: { x: 200, y: 200 }, end: { x: 100, y: 100 } }));
    expect(box).toEqual({ minX: 100, minY: 100, maxX: 200, maxY: 200 });
  });

  it('gives point-like annotations a small box', () => {
    expect(boundingBox({ type: 'stamp', color: '#fff', position: { x: 50, y: 50 } })).toEqual({
      minX: 34,
      minY: 34,
      maxX: 66,
      maxY: 66,
    });
  });

  it('returns null with no geometry', () => {
    expect(boundingBox({ type: 'text', color: '#fff' })).toBeNull();
  });
});

describe('positionRegion', () => {
  it('names the nine grid regions', () => {
    expect(positionRegion({ x: 50, y: 50 }, W, H)).toBe('the top-left');
    expect(positionRegion({ x: 450, y: 300 }, W, H)).toBe('the center');
    expect(positionRegion({ x: 850, y: 550 }, W, H)).toBe('the bottom-right');
    expect(positionRegion({ x: 450, y: 50 }, W, H)).toBe('the top-center');
    expect(positionRegion({ x: 50, y: 300 }, W, H)).toBe('the center-left');
  });

  it('degrades gracefully without a point or size', () => {
    expect(positionRegion(null, W, H)).toBe('the image');
    expect(positionRegion({ x: 1, y: 1 }, 0, 0)).toBe('the image');
  });
});

describe('associateCallouts', () => {
  it('tags the nearest shape and consumes the callout', () => {
    const annotations: PromptAnnotation[] = [
      rect(),
      { type: 'callout', color: '#22C55E', position: { x: 205, y: 205 }, calloutNumber: 1 },
    ];
    const { markerOf, consumed } = associateCallouts(annotations, W, H);
    expect(markerOf.get(0)).toBe(1);
    expect(consumed.has(1)).toBe(true);
  });

  it('leaves a far-away callout standalone', () => {
    const annotations: PromptAnnotation[] = [
      rect(),
      { type: 'callout', color: '#22C55E', position: { x: 880, y: 580 }, calloutNumber: 1 },
    ];
    const { markerOf, consumed } = associateCallouts(annotations, W, H);
    expect(markerOf.size).toBe(0);
    expect(consumed.size).toBe(0);
  });

  it('does not tag one shape with two callouts', () => {
    const annotations: PromptAnnotation[] = [
      rect(),
      { type: 'callout', color: '#22C55E', position: { x: 205, y: 205 }, calloutNumber: 1 },
      { type: 'callout', color: '#22C55E', position: { x: 206, y: 206 }, calloutNumber: 2 },
    ];
    const { markerOf, consumed } = associateCallouts(annotations, W, H);
    expect(markerOf.get(0)).toBe(1);
    expect(consumed.has(2)).toBe(false);
  });
});

describe('generatePrompt', () => {
  it('returns an empty string with no annotations', () => {
    expect(generatePrompt([], W, H)).toBe('');
  });

  it('describes a single shape as a bullet and uses the singular noun', () => {
    const prompt = generatePrompt([rect()], W, H);
    expect(prompt).toContain('the 1 annotation');
    expect(prompt).toContain('- a red box around the top-left');
  });

  it('pluralizes with several annotations', () => {
    const prompt = generatePrompt([rect(), rect({ color: '#3B82F6' })], W, H);
    expect(prompt).toContain('the 2 annotations');
  });

  it('quotes text content', () => {
    const prompt = generatePrompt(
      [{ type: 'text', color: '#FFFFFF', text: 'remove this', position: { x: 450, y: 300 } }],
      W,
      H
    );
    expect(prompt).toContain('white text at the center saying "remove this"');
  });

  it('renders a tagged shape as a numbered line and drops the merged callout', () => {
    const prompt = generatePrompt(
      [rect(), { type: 'callout', color: '#22C55E', position: { x: 205, y: 205 }, calloutNumber: 1 }],
      W,
      H
    );
    expect(prompt).toContain('1. a red box around the top-left');
    expect(prompt).not.toContain('a numbered marker');
    // The merged callout is not counted as its own annotation
    expect(prompt).toContain('the 1 annotation');
  });

  it('appends the goal when one is supplied', () => {
    const prompt = generatePrompt([rect()], W, H, { goal: 'make the room warmer' });
    expect(prompt).toContain('Overall goal: make the room warmer');
  });
});
