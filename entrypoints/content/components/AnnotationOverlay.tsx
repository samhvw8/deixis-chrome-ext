import React, { useState, useRef, useEffect, useCallback } from 'react';
import { browser } from 'wxt/browser';
import { AnnotationToolbar } from './AnnotationToolbar';
import { DEFAULT_BRUSH_COLOR } from '@/src/core/colors';
import { createLogger } from '@/src/core/logger';
import {
  DEFAULT_FONT_SIZE,
  type Annotation,
  type AnnotationTool,
  type Point,
  type ResizeHandle,
  type TextMeasurer,
} from '@/src/core/annotation/types';
import {
  constrainPoint,
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
} from '@/src/core/annotation/geometry';
import { generatePrompt } from '../utils/generatePrompt';

const logger = createLogger();

/**
 * Upper bound for the canvas backing store. The canvas renders at the source
 * image's resolution so exports keep full detail, but Chrome refuses to
 * allocate very large canvases, so cap the longest edge.
 */
const MAX_CANVAS_DIMENSION = 4096;

/** Pixel block size for the blur/redact tool, in CSS pixels. */
const BLUR_BLOCK_SIZE = 8;

/** Cap on undo depth, so a long session can't grow the history without bound. */
const MAX_HISTORY = 50;

/**
 * Shown when export fails on a tainted canvas. Falling back to a tab capture
 * needs the activeTab permission, which Chrome only grants for the session when
 * the user invokes the extension itself — the context-menu item does that, the
 * button injected into the page does not.
 */
const EXPORT_UNAVAILABLE =
  'This image is protected by the site, so it can’t be exported from here. ' +
  'Right-click the image and choose “Annotate with Deixis” to enable saving.';

export interface AnnotationOverlayProps {
  imageUrl: string;
  onClose: () => void;
  onCopy: (dataUrl: string, promptText?: string) => void;
  onSave: (dataUrl: string) => void;
}

/** Append a snapshot to an undo stack, dropping the oldest past MAX_HISTORY. */
const pushHistory = (stack: Annotation[][], snapshot: Annotation[]): Annotation[][] => {
  const next = [...stack, snapshot];
  return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
};

/**
 * Shallow list comparison. Annotation records are treated as immutable, so
 * identical members in the same order means nothing changed — this keeps
 * operations that rebuild the array (filter, map) from recording a no-op
 * undo step when they didn't actually remove or alter anything.
 */
const sameAnnotations = (a: Annotation[], b: Annotation[]): boolean =>
  a === b || (a.length === b.length && a.every((item, i) => item === b[i]));

/**
 * AnnotationOverlay - Full-screen overlay for image annotation
 */
export const AnnotationOverlay: React.FC<AnnotationOverlayProps> = ({
  imageUrl,
  onClose,
  onCopy,
  onSave,
}) => {
  // Tool state
  const [selectedTool, setSelectedTool] = useState<AnnotationTool>('draw');
  const [selectedColor, setSelectedColor] = useState(DEFAULT_BRUSH_COLOR);
  const [brushSize, setBrushSize] = useState(3);
  const [opacity, setOpacity] = useState(1);
  const [fillColor, setFillColor] = useState<string | null>(null);
  const [textBgColor, setTextBgColor] = useState<string | null>('rgba(0, 0, 0, 0.7)');
  const [textOutlineColor, setTextOutlineColor] = useState<string | null>(null);
  const [textOutlineWidth, setTextOutlineWidth] = useState(2);
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);
  const [selectedStamp, setSelectedStamp] = useState('✓');

  // Saved toolbar defaults — restored when deselecting a text annotation
  const savedToolbarDefaults = useRef<{
    color: string;
    opacity: number;
    fontSize: number;
    textBgColor: string | null;
    textOutlineColor: string | null;
    textOutlineWidth: number;
  } | null>(null);

  const [showShortcuts, setShowShortcuts] = useState(false);
  // Prompt-generation panel state
  const [promptPanel, setPromptPanel] = useState<{ visible: boolean; text: string }>({
    visible: false,
    text: '',
  });
  const [promptCopied, setPromptCopied] = useState(false);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  // Undo/redo history. Each entry is a full snapshot of the annotation list, so
  // every kind of change — create, erase, clear, move, resize, rotate, restyle —
  // is reversible with one mechanism.
  const [past, setPast] = useState<Annotation[][]>([]);
  const [future, setFuture] = useState<Annotation[][]>([]);

  // Latest-value mirrors so history helpers never read stale state from a
  // closure. Assigned during render, which is safe for read-only mirrors.
  const annotationsRef = useRef<Annotation[]>(annotations);
  annotationsRef.current = annotations;
  const pastRef = useRef<Annotation[][]>(past);
  pastRef.current = past;
  const futureRef = useRef<Annotation[][]>(future);
  futureRef.current = future;

  // Baseline captured when a continuous gesture (drag, resize, rotate, slider)
  // starts, so the whole gesture collapses into a single undo step.
  const gestureBaseline = useRef<Annotation[] | null>(null);

  // Whether a pointer is currently held down anywhere. A key released while
  // dragging must not close the gesture the drag is still building.
  const pointerDownRef = useRef(false);

  // These helpers write the refs as well as the state so several of them can
  // run back-to-back within one event without reading a stale stack.

  /** Apply a discrete change as one undoable step. */
  const commit = useCallback(
    (next: Annotation[] | ((prev: Annotation[]) => Annotation[])) => {
      const current = annotationsRef.current;
      const resolved = typeof next === 'function' ? next(current) : next;
      if (sameAnnotations(resolved, current)) return;

      // Close any gesture still open. A toolbar edit driven by a click never
      // sees its own pointerup (that fires before the click), so its baseline
      // can outlive it. Recording it here keeps the stack in chronological
      // order — otherwise it lands on top of this newer snapshot later and
      // undo walks forwards in time.
      const baseline = gestureBaseline.current;
      gestureBaseline.current = null;
      const stack =
        baseline !== null && !sameAnnotations(baseline, current)
          ? pushHistory(pastRef.current, baseline)
          : pastRef.current;

      pastRef.current = pushHistory(stack, current);
      futureRef.current = [];
      annotationsRef.current = resolved;
      setPast(pastRef.current);
      setFuture([]);
      setAnnotations(resolved);
    },
    []
  );

  /** Mark the start of a continuous gesture. Idempotent within one gesture. */
  const beginGesture = useCallback(() => {
    if (gestureBaseline.current === null) {
      gestureBaseline.current = annotationsRef.current;
    }
  }, []);

  /**
   * Close a gesture, recording one undo step if anything actually changed.
   * Returns the resulting undo stack so callers can keep working synchronously.
   */
  const commitGesture = useCallback((): Annotation[][] => {
    const baseline = gestureBaseline.current;
    gestureBaseline.current = null;
    if (baseline === null || sameAnnotations(baseline, annotationsRef.current)) {
      return pastRef.current;
    }

    pastRef.current = pushHistory(pastRef.current, baseline);
    futureRef.current = [];
    setPast(pastRef.current);
    setFuture([]);
    return pastRef.current;
  }, []);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentAnnotation, setCurrentAnnotation] = useState<Annotation | null>(null);
  const [textInput, setTextInput] = useState<{ visible: boolean; position: Point }>({
    visible: false,
    position: { x: 0, y: 0 },
  });
  // ID of the text annotation being re-edited (double-click), null when creating new text
  const [editingTextId, setEditingTextId] = useState<string | null>(null);

  // Load default brush color from storage and listen for changes
  useEffect(() => {
    browser.storage.local
      .get<{ defaultBrushColor?: string }>(['defaultBrushColor'])
      .then((result) => {
        if (result.defaultBrushColor) {
          setSelectedColor(result.defaultBrushColor);
        }
      })
      .catch(() => {
        // Storage unavailable — fall back to the built-in default color.
      });

    // Listen for changes from popup
    const handleStorageChange = (changes: Record<string, { newValue?: unknown }>) => {
      const next = changes.defaultBrushColor?.newValue;
      if (typeof next === 'string') {
        setSelectedColor(next);
      }
    };

    browser.storage.onChanged.addListener(handleStorageChange);
    return () => {
      browser.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  // Callout counter for auto-incrementing numbers
  const [calloutCounter, setCalloutCounter] = useState(1);

  // Drag state for move tool
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<Point>({ x: 0, y: 0 });

  // Selection state for duplicate/manipulation
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);

  // Resize state
  const [resizingHandle, setResizingHandle] = useState<ResizeHandle | null>(null);
  const [resizeStartPoint, setResizeStartPoint] = useState<Point | null>(null);
  const [originalAnnotation, setOriginalAnnotation] = useState<Annotation | null>(null);
  const [anchorVisualPos, setAnchorVisualPos] = useState<Point | null>(null);

  // Rotation state
  const [isRotating, setIsRotating] = useState(false);
  const [rotationStartAngle, setRotationStartAngle] = useState(0);

  // Cursor preview state
  const [cursorPos, setCursorPos] = useState<Point | null>(null);

  // Shift key state for constraining shapes
  const [isShiftHeld, setIsShiftHeld] = useState(false);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  // Canvas display size in CSS pixels — the coordinate space every annotation
  // is stored in. The backing store may be larger (see scaleRef).
  const displaySizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  // Backing-store pixels per CSS pixel. >1 when the source image is bigger than
  // the on-screen preview, so exports keep the original resolution.
  const scaleRef = useRef(1);

  // A canvas that has drawn a cross-origin image without CORS is "tainted":
  // getImageData (blur) and toDataURL (export) both throw on it.
  const canvasTaintedRef = useRef(false);
  const [canvasTainted, setCanvasTainted] = useState(false);
  // Bumped whenever a new image is adopted, to force a redraw with the
  // annotations from the current render rather than the one that started the load.
  const [imageGeneration, setImageGeneration] = useState(0);
  const [exportError, setExportError] = useState<string | null>(null);

  // Load image directly for display
  useEffect(() => {
    let cancelled = false;

    const adopt = (img: HTMLImageElement, tainted: boolean) => {
      if (cancelled) return;
      imageRef.current = img;
      canvasTaintedRef.current = tainted;
      setCanvasTainted(tainted);
      resizeCanvas();
      redrawCanvas();
      // redrawCanvas is captured from the render that started this load, so it
      // draws that render's annotations. Bump a counter to re-run the redraw
      // effect with the current one — otherwise anything annotated while the
      // image was still loading stays invisible until the next edit.
      setImageGeneration((generation) => generation + 1);
    };

    // Last resort: blob: URLs (e.g. Gemini's generated images) can be revoked
    // for new fetches while the page's own <img> element keeps its
    // already-decoded bitmap — snapshot that live element instead of refetching.
    const snapshotLiveImage = () => {
      const liveImg = Array.from(document.images).find(
        (candidate) => candidate.src === imageUrl && candidate.complete && candidate.naturalWidth > 0
      );
      if (!liveImg) {
        logger.error('Image load error and no live element to snapshot:', imageUrl);
        return;
      }
      const snapshotCanvas = document.createElement('canvas');
      snapshotCanvas.width = liveImg.naturalWidth;
      snapshotCanvas.height = liveImg.naturalHeight;
      const snapshotCtx = snapshotCanvas.getContext('2d');
      if (!snapshotCtx) return;
      try {
        snapshotCtx.drawImage(liveImg, 0, 0);
        const dataUrl = snapshotCanvas.toDataURL('image/png');
        const fallbackImg = new Image();
        // A data: URL is same-origin, so this path leaves the canvas clean.
        fallbackImg.onload = () => adopt(fallbackImg, false);
        fallbackImg.onerror = () => logger.error('Fallback snapshot image also failed to load');
        fallbackImg.src = dataUrl;
      } catch (err) {
        logger.error('Failed to snapshot live image element:', err);
      }
    };

    // blob: and data: URLs are already same-origin, so a CORS request buys
    // nothing and `anonymous` would only strip credentials. Load them plainly.
    if (imageUrl.startsWith('blob:') || imageUrl.startsWith('data:')) {
      const localImg = new Image();
      localImg.onload = () => adopt(localImg, false);
      localImg.onerror = () => {
        if (cancelled) return;
        snapshotLiveImage();
      };
      localImg.src = imageUrl;
      return () => {
        cancelled = true;
      };
    }

    // Preferred path: request with CORS so the canvas stays clean, which keeps
    // the blur tool and toDataURL() export working. Gemini's CDN responds with
    // Access-Control-Allow-Origin: *.
    const corsImg = new Image();
    corsImg.crossOrigin = 'anonymous';
    corsImg.onload = () => adopt(corsImg, false);
    corsImg.onerror = () => {
      if (cancelled) return;
      // The host didn't allow a CORS read. Load it plainly instead: the image
      // still displays, but the canvas is tainted and export/blur degrade.
      logger.warn('CORS image load failed, retrying without CORS:', imageUrl);
      const plainImg = new Image();
      plainImg.onload = () => adopt(plainImg, true);
      plainImg.onerror = () => {
        if (cancelled) return;
        snapshotLiveImage();
      };
      plainImg.src = imageUrl;
    };
    corsImg.src = imageUrl;

    return () => {
      cancelled = true;
    };
    // resizeCanvas/redrawCanvas are intentionally excluded: redrawCanvas changes
    // identity on every annotation edit and would reload the image mid-session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl]);

  // Resize canvas to fit image
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    const container = containerRef.current;

    if (!canvas || !img || !container) return;

    // Calculate display size to fit in viewport with padding
    const maxWidth = window.innerWidth - 80;
    const maxHeight = window.innerHeight - 160;
    const naturalWidth = img.naturalWidth || img.width;
    const naturalHeight = img.naturalHeight || img.height;
    if (!naturalWidth || !naturalHeight) return;

    const imgRatio = naturalWidth / naturalHeight;
    const containerRatio = maxWidth / maxHeight;

    let width: number, height: number;
    if (imgRatio > containerRatio) {
      width = Math.min(naturalWidth, maxWidth);
      height = width / imgRatio;
    } else {
      height = Math.min(naturalHeight, maxHeight);
      width = height * imgRatio;
    }

    // Render the backing store at the source image's resolution (capped) while
    // displaying at the viewport-fit size, so a downscaled preview still
    // exports at full quality. Drawing stays in CSS-pixel coordinates — the
    // transform applied in redrawCanvas scales them into the backing store.
    const scale = Math.max(
      1,
      Math.min(naturalWidth / width, MAX_CANVAS_DIMENSION / Math.max(width, height))
    );

    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    displaySizeRef.current = { width, height };
    scaleRef.current = scale;
  }, []);

  // Redraw canvas
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const img = imageRef.current;

    if (!canvas || !ctx || !img) return;

    const { width, height } = displaySizeRef.current;
    if (!width || !height) return;

    // Clear in device pixels, then draw everything in CSS pixels
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scaleRef.current, 0, 0, scaleRef.current, 0, 0);
    ctx.drawImage(img, 0, 0, width, height);

    // Draw all annotations (hide the one being re-edited — the input shows it instead)
    [...annotations, currentAnnotation].forEach((annotation) => {
      if (!annotation) return;
      if (editingTextId && annotation.id === editingTextId) return;
      drawAnnotation(ctx, annotation);
    });
  }, [annotations, currentAnnotation, editingTextId]);

  /**
   * Read canvas pixels for the blur tool. Returns null instead of throwing when
   * the canvas is tainted by a cross-origin image, so callers can fall back to
   * a solid redaction block rather than taking the whole overlay down.
   */
  const readImageData = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number
  ): ImageData | null => {
    try {
      return ctx.getImageData(x, y, w, h);
    } catch {
      if (!canvasTaintedRef.current) {
        canvasTaintedRef.current = true;
        setCanvasTainted(true);
      }
      return null;
    }
  };

  // Draw a single annotation
  const drawAnnotation = (ctx: CanvasRenderingContext2D, annotation: Annotation) => {
    ctx.save();
    ctx.globalAlpha = annotation.opacity;
    ctx.strokeStyle = annotation.color;
    ctx.fillStyle = annotation.color;
    ctx.lineWidth = annotation.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Apply rotation if set
    const rotation = annotation.rotation || 0;
    if (rotation !== 0) {
      const center = getAnnotationCenter(annotation);
      ctx.translate(center.x, center.y);
      ctx.rotate(rotation);
      ctx.translate(-center.x, -center.y);
    }

    switch (annotation.type) {
      case 'draw':
        if (annotation.points && annotation.points.length > 0) {
          ctx.beginPath();
          ctx.moveTo(annotation.points[0].x, annotation.points[0].y);
          annotation.points.forEach((point) => ctx.lineTo(point.x, point.y));
          ctx.stroke();
        }
        break;

      case 'rectangle':
        if (annotation.start && annotation.end) {
          const width = annotation.end.x - annotation.start.x;
          const height = annotation.end.y - annotation.start.y;
          if (annotation.fillColor) {
            ctx.fillStyle = annotation.fillColor;
            ctx.fillRect(annotation.start.x, annotation.start.y, width, height);
          }
          ctx.strokeRect(annotation.start.x, annotation.start.y, width, height);
        }
        break;

      case 'circle':
        if (annotation.start && annotation.end) {
          const centerX = (annotation.start.x + annotation.end.x) / 2;
          const centerY = (annotation.start.y + annotation.end.y) / 2;
          const radiusX = Math.abs(annotation.end.x - annotation.start.x) / 2;
          const radiusY = Math.abs(annotation.end.y - annotation.start.y) / 2;
          ctx.beginPath();
          ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
          if (annotation.fillColor) {
            ctx.fillStyle = annotation.fillColor;
            ctx.fill();
          }
          ctx.stroke();
        }
        break;

      case 'arrow':
        if (annotation.start && annotation.end) {
          drawArrow(ctx, annotation.start, annotation.end, annotation.strokeWidth);
        }
        break;

      case 'text':
        if (annotation.text && annotation.position) {
          const textFontSize = annotation.fontSize || DEFAULT_FONT_SIZE;
          ctx.font = `bold ${textFontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
          const metrics = ctx.measureText(annotation.text);
          const padding = 4;
          // Draw text background if bgColor is set
          if (annotation.bgColor) {
            ctx.fillStyle = annotation.bgColor;
            ctx.fillRect(
              annotation.position.x - padding,
              annotation.position.y - textFontSize - padding,
              metrics.width + padding * 2,
              textFontSize + 4 + padding
            );
          }
          // Draw text outline if outlineColor is set
          if (annotation.outlineColor) {
            ctx.strokeStyle = annotation.outlineColor;
            ctx.lineWidth = annotation.outlineWidth || 2;
            ctx.lineJoin = 'round';
            ctx.miterLimit = 2;
            ctx.strokeText(annotation.text, annotation.position.x, annotation.position.y);
          }
          // Draw text fill
          ctx.fillStyle = annotation.color;
          ctx.fillText(annotation.text, annotation.position.x, annotation.position.y);
        }
        break;

      case 'callout':
        if (annotation.position && annotation.calloutNumber !== undefined) {
          const radius = 14;
          const x = annotation.position.x;
          const y = annotation.position.y;

          // Draw filled circle
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fillStyle = annotation.color;
          ctx.fill();

          // Draw white border
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Draw number
          ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#ffffff';
          ctx.fillText(String(annotation.calloutNumber), x, y);
        }
        break;

      case 'line':
        if (annotation.start && annotation.end) {
          ctx.beginPath();
          ctx.moveTo(annotation.start.x, annotation.start.y);
          ctx.lineTo(annotation.end.x, annotation.end.y);
          ctx.stroke();
        }
        break;

      case 'highlight':
        if (annotation.start && annotation.end) {
          const width = annotation.end.x - annotation.start.x;
          const height = annotation.end.y - annotation.start.y;
          ctx.globalAlpha = 0.4; // Fixed transparency for highlight
          ctx.fillStyle = annotation.color;
          ctx.fillRect(annotation.start.x, annotation.start.y, width, height);
        }
        break;

      case 'blur':
        if (annotation.start && annotation.end) {
          const x = Math.min(annotation.start.x, annotation.end.x);
          const y = Math.min(annotation.start.y, annotation.end.y);
          const w = Math.abs(annotation.end.x - annotation.start.x);
          const h = Math.abs(annotation.end.y - annotation.start.y);

          if (w > 0 && h > 0) {
            // getImageData/putImageData ignore the canvas transform, so convert
            // the region from CSS pixels to backing-store pixels.
            const scale = scaleRef.current;
            // Clamp to the backing store: reading past the edge yields
            // transparent black, which would darken the outermost blocks.
            const deviceX = Math.max(0, Math.round(x * scale));
            const deviceY = Math.max(0, Math.round(y * scale));
            const deviceW = Math.min(Math.round(w * scale), ctx.canvas.width - deviceX);
            const deviceH = Math.min(Math.round(h * scale), ctx.canvas.height - deviceY);

            const imageData =
              deviceW > 0 && deviceH > 0
                ? readImageData(ctx, deviceX, deviceY, deviceW, deviceH)
                : null;

            if (imageData) {
              const data = imageData.data;
              const blockSize = Math.max(1, Math.round(BLUR_BLOCK_SIZE * scale));
              // The backing store can be several times the display size, so
              // averaging every device pixel would cost scale² more work on
              // every redraw — and redraws run on each mousemove while drawing.
              // Sampling on a stride keeps the cost at display resolution; the
              // block average is visually identical.
              const sampleStep = Math.max(1, Math.round(scale));

              for (let blockY = 0; blockY < deviceH; blockY += blockSize) {
                for (let blockX = 0; blockX < deviceW; blockX += blockSize) {
                  // Calculate average color for this block
                  let r = 0, g = 0, b = 0, count = 0;
                  for (let py = blockY; py < Math.min(blockY + blockSize, deviceH); py += sampleStep) {
                    for (let px = blockX; px < Math.min(blockX + blockSize, deviceW); px += sampleStep) {
                      const i = (py * deviceW + px) * 4;
                      r += data[i];
                      g += data[i + 1];
                      b += data[i + 2];
                      count++;
                    }
                  }
                  r = Math.floor(r / count);
                  g = Math.floor(g / count);
                  b = Math.floor(b / count);

                  // Fill the block with average color
                  for (let py = blockY; py < Math.min(blockY + blockSize, deviceH); py++) {
                    for (let px = blockX; px < Math.min(blockX + blockSize, deviceW); px++) {
                      const i = (py * deviceW + px) * 4;
                      data[i] = r;
                      data[i + 1] = g;
                      data[i + 2] = b;
                    }
                  }
                }
              }

              ctx.putImageData(imageData, deviceX, deviceY);
            } else {
              // Canvas is tainted, so pixels can't be read. Cover the region
              // with a solid block instead — redaction still succeeds, it just
              // isn't a pixelation of the underlying content.
              ctx.globalAlpha = 1;
              ctx.fillStyle = '#1f2937';
              ctx.fillRect(x, y, w, h);
            }

            // Draw border to show the blur region
            ctx.strokeStyle = 'rgba(255,255,255,0.5)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.strokeRect(x, y, w, h);
            ctx.setLineDash([]);
          }
        }
        break;

      case 'stamp':
        if (annotation.position && annotation.stamp) {
          ctx.font = '32px -apple-system, BlinkMacSystemFont, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(annotation.stamp, annotation.position.x, annotation.position.y);
        }
        break;
    }
    ctx.restore();
  };

  // Draw arrow with head
  const drawArrow = (ctx: CanvasRenderingContext2D, start: Point, end: Point, strokeWidth: number) => {
    const headLength = Math.max(10, strokeWidth * 4);
    const angle = Math.atan2(end.y - start.y, end.x - start.x);

    // Draw line
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();

    // Draw arrowhead
    ctx.beginPath();
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(
      end.x - headLength * Math.cos(angle - Math.PI / 6),
      end.y - headLength * Math.sin(angle - Math.PI / 6)
    );
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(
      end.x - headLength * Math.cos(angle + Math.PI / 6),
      end.y - headLength * Math.sin(angle + Math.PI / 6)
    );
    ctx.stroke();
  };

  // Get canvas coordinates from mouse event
  const getCanvasPoint = (e: React.MouseEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  /**
   * Canvas-backed text measurement for hit testing. The geometry module is pure,
   * so it takes this as a port rather than reaching for a rendering context.
   * Must match the font used by drawAnnotation's 'text' case exactly, or the
   * clickable box drifts from the drawn glyphs.
   */
  const measureText = useCallback<TextMeasurer>((text, size) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return 0;
    ctx.font = `bold ${size}px -apple-system, BlinkMacSystemFont, sans-serif`;
    return ctx.measureText(text).width;
  }, []);

  /** Topmost annotation under a canvas-space point. */
  const hitTest = useCallback(
    (point: Point) => findAnnotationAtPoint(annotationsRef.current, point, measureText),
    [measureText]
  );

  // Duplicate annotation with offset
  const duplicateAnnotation = useCallback((annotation: Annotation): Annotation => {
    const offset = 20; // Offset in pixels
    const newAnnotation = moveAnnotation(annotation, { x: offset, y: offset });
    return {
      ...newAnnotation,
      id: `annotation-${Date.now()}`,
    };
  }, []);

  // Mouse handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const point = getCanvasPoint(e);

    // Handle eraser tool - delete entire annotation on click
    if (selectedTool === 'eraser') {
      const hitAnnotation = hitTest(point);
      if (hitAnnotation) {
        commit((prev) => prev.filter((a) => a.id !== hitAnnotation.id));
      }
      return;
    }

    // Handle move tool
    if (selectedTool === 'move') {
      // First, check if clicking on the rotation handle of the selected annotation
      if (selectedAnnotationId) {
        const selectedAnnotation = annotations.find((a) => a.id === selectedAnnotationId);

        if (selectedAnnotation) {
          // Check rotation handle first (takes priority)
          const isOnRotation = isPointOnRotationHandle(point, selectedAnnotation);

          if (isOnRotation) {
            beginGesture();
            setIsRotating(true);
            setOriginalAnnotation({ ...selectedAnnotation });
            const center = getAnnotationCenter(selectedAnnotation);
            const startAngle = Math.atan2(point.y - center.y, point.x - center.x);
            setRotationStartAngle(startAngle - (selectedAnnotation.rotation || 0));
            return;
          }

          // Then check resize handles
          const handle = findResizeHandleAtPoint(point, selectedAnnotation);

          if (handle) {
            // Calculate anchor position (opposite corner in visual space)
            const anchorHandle = getAnchorHandle(handle);
            const anchorLocalPos = getLocalCorner(selectedAnnotation, anchorHandle);
            const center = getAnnotationCenter(selectedAnnotation);
            const rotation = selectedAnnotation.rotation || 0;
            const anchorPos = anchorLocalPos ? rotatePoint(anchorLocalPos, center, rotation) : null;

            beginGesture();
            setResizingHandle(handle);
            setResizeStartPoint(point);
            setOriginalAnnotation({ ...selectedAnnotation });
            setAnchorVisualPos(anchorPos);
            return;
          }
        }
      }

      // Then check for hit on any annotation
      const hitAnnotation = hitTest(point);

      if (hitAnnotation) {
        setSelectedAnnotationId(hitAnnotation.id);
        setDraggingId(hitAnnotation.id);
        const center = getAnnotationCenter(hitAnnotation);
        setDragOffset({ x: point.x - center.x, y: point.y - center.y });
        beginGesture();
        // Load text annotation properties into toolbar for editing
        if (hitAnnotation.type === 'text') {
          // Save the user's own toolbar defaults the first time a text is
          // selected. Selecting a second text must not overwrite them with the
          // first text's properties, or deselecting would restore the wrong state.
          if (savedToolbarDefaults.current === null) {
            savedToolbarDefaults.current = {
              color: selectedColor,
              opacity,
              fontSize,
              textBgColor,
              textOutlineColor,
              textOutlineWidth,
            };
          }
          setFontSize(hitAnnotation.fontSize || DEFAULT_FONT_SIZE);
          setSelectedColor(hitAnnotation.color);
          setOpacity(hitAnnotation.opacity);
          setTextBgColor(hitAnnotation.bgColor || null);
          setTextOutlineColor(hitAnnotation.outlineColor || null);
          setTextOutlineWidth(hitAnnotation.outlineWidth || 2);
        }
      } else {
        setSelectedAnnotationId(null);
      }
      return;
    }

    if (selectedTool === 'text') {
      // Don't create new text input if one is already visible
      // (blur will handle saving the current text)
      if (textInput.visible) {
        return;
      }
      setTextInput({ visible: true, position: point });
      setTimeout(() => textInputRef.current?.focus(), 0);
      return;
    }

    // Handle callout tool - instant placement with auto-incrementing number
    if (selectedTool === 'callout') {
      const newAnnotation: Annotation = {
        id: `annotation-${Date.now()}`,
        type: 'callout',
        color: selectedColor,
        strokeWidth: brushSize,
        opacity: opacity,
        position: point,
        calloutNumber: calloutCounter,
      };
      commit((prev) => [...prev, newAnnotation]);
      setCalloutCounter((prev) => prev + 1);
      return;
    }

    // Handle stamp tool - instant placement of emoji
    if (selectedTool === 'stamp') {
      const newAnnotation: Annotation = {
        id: `annotation-${Date.now()}`,
        type: 'stamp',
        color: selectedColor,
        strokeWidth: brushSize,
        opacity: opacity,
        position: point,
        stamp: selectedStamp,
      };
      commit((prev) => [...prev, newAnnotation]);
      return;
    }

    setIsDrawing(true);
    const newAnnotation: Annotation = {
      id: `annotation-${Date.now()}`,
      type: selectedTool,
      color: selectedColor,
      strokeWidth: brushSize,
      opacity: opacity,
      fillColor: (selectedTool === 'rectangle' || selectedTool === 'circle') ? (fillColor || undefined) : undefined,
      points: selectedTool === 'draw' ? [point] : undefined,
      start: selectedTool !== 'draw' ? point : undefined,
      end: selectedTool !== 'draw' ? point : undefined,
    };
    setCurrentAnnotation(newAnnotation);
  };

  // Double-click a text annotation (move tool) to re-edit its content
  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (selectedTool !== 'move') return;

    const point = getCanvasPoint(e);
    const hitAnnotation = hitTest(point);
    if (!hitAnnotation || hitAnnotation.type !== 'text' || !hitAnnotation.position) return;

    // Stop the drag started by the second mousedown
    setDraggingId(null);

    setEditingTextId(hitAnnotation.id);
    setTextInput({ visible: true, position: hitAnnotation.position });
    setTimeout(() => {
      if (textInputRef.current) {
        textInputRef.current.value = hitAnnotation.text || '';
        textInputRef.current.focus();
        textInputRef.current.select();
      }
    }, 0);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const point = getCanvasPoint(e);

    // Update cursor position for brush preview
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      setCursorPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }

    // Skip if rotating or resizing - window-level handlers manage these
    if (isRotating || resizingHandle) {
      return;
    }

    // Handle dragging annotation
    if (draggingId) {
      const annotation = annotations.find((a) => a.id === draggingId);
      if (annotation) {
        const center = getAnnotationCenter(annotation);
        const delta = {
          x: point.x - dragOffset.x - center.x,
          y: point.y - dragOffset.y - center.y,
        };
        setAnnotations((prev) =>
          prev.map((a) => (a.id === draggingId ? moveAnnotation(a, delta) : a))
        );
      }
      return;
    }

    if (!isDrawing || !currentAnnotation) return;

    if (currentAnnotation.type === 'draw') {
      setCurrentAnnotation({
        ...currentAnnotation,
        points: [...(currentAnnotation.points || []), point],
      });
    } else {
      // Apply constraint if Shift is held
      const constrainedPoint = isShiftHeld && currentAnnotation.start
        ? constrainPoint(currentAnnotation.start, point, currentAnnotation.type)
        : point;
      setCurrentAnnotation({
        ...currentAnnotation,
        end: constrainedPoint,
      });
    }
  };

  const handleMouseUp = () => {
    // Skip if rotating or resizing - window-level handlers manage these
    if (isRotating || resizingHandle) {
      return;
    }

    if (draggingId) {
      setDraggingId(null);
      // The whole drag collapses into one undo step
      commitGesture();
      return;
    }

    if (isDrawing && currentAnnotation) {
      commit((prev) => [...prev, currentAnnotation]);
      setCurrentAnnotation(null);
    }
    setIsDrawing(false);
  };

  // Build text-specific properties from current toolbar state (single source of
  // truth). Memoized on exactly the toolbar values it reads, so the effect that
  // syncs a selected text annotation can depend on it without re-running every
  // render.
  const buildTextProperties = useCallback(
    () => ({
      fontSize,
      color: selectedColor,
      opacity,
      bgColor: textBgColor || undefined,
      outlineColor: textOutlineColor || undefined,
      outlineWidth: textOutlineColor ? textOutlineWidth : undefined,
    }),
    [fontSize, selectedColor, opacity, textBgColor, textOutlineColor, textOutlineWidth]
  );

  // Text input handlers
  const submitText = () => {
    const value = textInputRef.current?.value;
    if (editingTextId) {
      // Re-editing an existing text annotation: update its text (empty = cancel, keep original)
      if (value) {
        commit((prev) =>
          prev.map((a) => (a.id === editingTextId ? { ...a, text: value } : a))
        );
      }
      setEditingTextId(null);
    } else if (value) {
      const newAnnotation: Annotation = {
        id: `annotation-${Date.now()}`,
        type: 'text',
        strokeWidth: 3,
        text: value,
        position: textInput.position,
        ...buildTextProperties(),
      };
      commit((prev) => [...prev, newAnnotation]);
    }
    if (textInputRef.current) {
      textInputRef.current.value = '';
    }
    setTextInput({ visible: false, position: { x: 0, y: 0 } });
  };

  const handleTextKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitText();
    } else if (e.key === 'Escape') {
      // Discard - just close without saving (re-edited annotation keeps its original text)
      setEditingTextId(null);
      setTextInput({ visible: false, position: { x: 0, y: 0 } });
      if (textInputRef.current) {
        textInputRef.current.value = '';
      }
    }
  };

  const handleTextBlur = () => {
    // Submit on blur (click outside)
    submitText();
  };

  // Toolbar handlers
  const handleUndo = useCallback(() => {
    // Close any in-flight gesture so it lands on the stack as one step first
    const stack = commitGesture();
    if (stack.length === 0) return;

    const previous = stack[stack.length - 1];
    pastRef.current = stack.slice(0, -1);
    futureRef.current = pushHistory(futureRef.current, annotationsRef.current);
    annotationsRef.current = previous;

    setPast(pastRef.current);
    setFuture(futureRef.current);
    setAnnotations(previous);
    setSelectedAnnotationId(null);
  }, [commitGesture]);

  const handleRedo = useCallback(() => {
    commitGesture();
    const stack = futureRef.current;
    if (stack.length === 0) return;

    const next = stack[stack.length - 1];
    futureRef.current = stack.slice(0, -1);
    pastRef.current = pushHistory(pastRef.current, annotationsRef.current);
    annotationsRef.current = next;

    setPast(pastRef.current);
    setFuture(futureRef.current);
    setAnnotations(next);
    setSelectedAnnotationId(null);
  }, [commitGesture]);

  // Generate an editable text prompt describing the annotations.
  // Annotation coordinates live in CSS pixels, so the region math must use the
  // canvas display size — not canvas.width, which is the scaled backing store.
  const handleGeneratePrompt = useCallback(() => {
    const { width, height } = displaySizeRef.current;
    const text = generatePrompt(annotations, width, height);
    setPromptCopied(false);
    setPromptPanel({ visible: true, text });
  }, [annotations]);

  const handleCopyPrompt = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(promptPanel.text);
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 1500);
    } catch (error) {
      logger.error('Failed to copy prompt:', error);
    }
  }, [promptPanel.text]);

  // Handle duplicate selected annotation (Ctrl+D)
  const handleDuplicate = useCallback(() => {
    if (!selectedAnnotationId) return;
    const annotation = annotations.find((a) => a.id === selectedAnnotationId);
    if (annotation) {
      const duplicated = duplicateAnnotation(annotation);
      commit((prev) => [...prev, duplicated]);
      setSelectedAnnotationId(duplicated.id);
    }
  }, [selectedAnnotationId, annotations, duplicateAnnotation, commit]);

  const handleClearAll = useCallback(() => {
    if (annotationsRef.current.length === 0) return;
    // Recorded on the history stack, so Ctrl+Z brings everything back
    commit([]);
    setSelectedAnnotationId(null);
  }, [commit]);

  // Get annotated image as data URL (handles tainted canvas via tab capture)
  const getAnnotatedImage = useCallback(async (): Promise<string | null> => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    try {
      // Try toDataURL first (works if canvas is not tainted)
      return canvas.toDataURL('image/png');
    } catch {
      logger.warn('Canvas tainted, using tab capture for export');

      // Canvas is tainted - capture the visible canvas area via screenshot
      try {
        const canvasRect = canvas.getBoundingClientRect();
        const response = await browser.runtime.sendMessage({
          type: 'DEIXIS_CAPTURE_TAB',
        });

        if (response?.success && response.dataUrl) {
          // Crop the screenshot to the canvas area
          return new Promise((resolve) => {
            const fullImg = new Image();
            fullImg.onload = () => {
              const cropCanvas = document.createElement('canvas');
              const ctx = cropCanvas.getContext('2d');
              if (ctx) {
                const dpr = window.devicePixelRatio || 1;
                cropCanvas.width = canvasRect.width * dpr;
                cropCanvas.height = canvasRect.height * dpr;

                ctx.drawImage(
                  fullImg,
                  canvasRect.x * dpr,
                  canvasRect.y * dpr,
                  canvasRect.width * dpr,
                  canvasRect.height * dpr,
                  0,
                  0,
                  canvasRect.width * dpr,
                  canvasRect.height * dpr
                );

                resolve(cropCanvas.toDataURL('image/png'));
              } else {
                resolve(null);
              }
            };
            fullImg.onerror = () => resolve(null);
            fullImg.src = response.dataUrl;
          });
        } else {
          logger.error('Tab capture failed:', response?.error);
          return null;
        }
      } catch (captureError) {
        logger.error('Capture error:', captureError);
        return null;
      }
    }
  }, []);

  const handleCopy = useCallback(async () => {
    const dataUrl = await getAnnotatedImage();
    if (!dataUrl) {
      setExportError(EXPORT_UNAVAILABLE);
      return;
    }
    setExportError(null);

    // Send the prompt along with the image: while the panel is open, respect
    // the user's edited text; otherwise generate fresh from current annotations.
    const { width, height } = displaySizeRef.current;
    const promptText = promptPanel.visible
      ? promptPanel.text
      : generatePrompt(annotations, width, height);
    onCopy(dataUrl, promptText || undefined);
  }, [getAnnotatedImage, onCopy, promptPanel.visible, promptPanel.text, annotations]);

  const handleSave = useCallback(async () => {
    const dataUrl = await getAnnotatedImage();
    if (!dataUrl) {
      setExportError(EXPORT_UNAVAILABLE);
      return;
    }
    setExportError(null);
    onSave(dataUrl);
  }, [getAnnotatedImage, onSave]);

  // Redraw on annotation changes, and whenever a newly loaded image is adopted
  // (imageGeneration) — the load effect's own redraw runs with the annotations
  // captured when the load started, which may already be stale.
  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas, imageGeneration]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      // Annotation coordinates live in the canvas's CSS-pixel space, which is
      // derived from the viewport. Resizing changes that space, so rescale
      // everything to match — otherwise blur regions drift off the pixels they
      // redact and generatePrompt reports the wrong region for each annotation.
      const previous = displaySizeRef.current;
      resizeCanvas();
      const next = displaySizeRef.current;

      if (previous.width > 0 && next.width > 0 && next.width !== previous.width) {
        const ratio = next.width / previous.width;
        // Rescaling allocates new objects, so an open gesture whose baseline is
        // still the untouched current list must keep pointing at the same one —
        // otherwise closing it would record an undo step for a change the user
        // never made.
        const baselineWasCurrent = gestureBaseline.current === annotationsRef.current;
        const rescaled = scaleAnnotations(annotationsRef.current, ratio);
        annotationsRef.current = rescaled;
        // History snapshots were captured in the old space too, so an undo
        // after a resize would otherwise teleport annotations back to it.
        pastRef.current = pastRef.current.map((snapshot) => scaleAnnotations(snapshot, ratio));
        futureRef.current = futureRef.current.map((snapshot) => scaleAnnotations(snapshot, ratio));
        if (baselineWasCurrent) {
          gestureBaseline.current = rescaled;
        } else if (gestureBaseline.current !== null) {
          gestureBaseline.current = scaleAnnotations(gestureBaseline.current, ratio);
        }
        setAnnotations(rescaled);
        setPast(pastRef.current);
        setFuture(futureRef.current);
      }

      redrawCanvas();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [resizeCanvas, redrawCanvas]);

  // Track Shift key for constraining shapes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setIsShiftHeld(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setIsShiftHeld(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Window-level mouse handlers for resize/rotate (so dragging works outside canvas)
  useEffect(() => {
    if (!resizingHandle && !isRotating) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const point = { x: e.clientX - rect.left, y: e.clientY - rect.top };

      if (isRotating && originalAnnotation) {
        const center = getAnnotationCenter(originalAnnotation);
        const currentAngle = Math.atan2(point.y - center.y, point.x - center.x);
        let newRotation = currentAngle - rotationStartAngle;

        // Snap to 15° increments if Shift is held
        if (isShiftHeld) {
          const snapAngle = Math.PI / 12;
          newRotation = Math.round(newRotation / snapAngle) * snapAngle;
        }

        setAnnotations((prev) =>
          prev.map((a) =>
            a.id === originalAnnotation.id ? { ...a, rotation: newRotation } : a
          )
        );
      }

      if (resizingHandle && resizeStartPoint && originalAnnotation && anchorVisualPos) {
        const screenDelta = {
          x: point.x - resizeStartPoint.x,
          y: point.y - resizeStartPoint.y,
        };

        const resized = resizeAnnotation(originalAnnotation, resizingHandle, screenDelta, anchorVisualPos);
        setAnnotations((prev) =>
          prev.map((a) => (a.id === originalAnnotation.id ? resized : a))
        );
      }
    };

    const handleWindowMouseUp = () => {
      if (isRotating) {
        setIsRotating(false);
        setOriginalAnnotation(null);
      }
      if (resizingHandle) {
        setResizingHandle(null);
        setResizeStartPoint(null);
        setOriginalAnnotation(null);
        setAnchorVisualPos(null);
      }
      // The whole resize/rotate drag collapses into one undo step
      commitGesture();
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [resizingHandle, isRotating, resizeStartPoint, originalAnnotation, rotationStartAngle, isShiftHeld, anchorVisualPos, commitGesture]);

  // Toolbar sliders are drag controls, so a property edit isn't finished until
  // the pointer (or key) is released. Close the gesture there so one drag
  // produces one undo step instead of one per intermediate value.
  useEffect(() => {
    const finish = () => {
      // Canvas drag/resize/rotate commit on their own mouseup.
      if (draggingId !== null || resizingHandle !== null || isRotating) return;
      commitGesture();
    };

    const handlePointerDown = () => {
      pointerDownRef.current = true;
    };

    // pointercancel fires when the browser takes the pointer over (touch
    // scrolling, pen gestures); without it the gesture would stay open forever.
    const handlePointerEnd = () => {
      pointerDownRef.current = false;
      finish();
    };

    const handleKeyUp = () => {
      // Releasing a key mid-drag — Shift while drawing, or any key during a
      // toolbar slider drag — must not split one gesture into two undo steps.
      if (pointerDownRef.current) return;
      finish();
    };

    // Releasing the pointer outside the window (Alt-Tab mid-drag) never
    // delivers a pointerup, so close on blur too.
    const handleWindowBlur = () => {
      pointerDownRef.current = false;
      finish();
    };

    window.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [commitGesture, draggingId, resizingHandle, isRotating]);

  // Cursor based on tool
  const getCursor = () => {
    switch (selectedTool) {
      case 'move':
        return draggingId ? 'grabbing' : 'grab';
      case 'draw':
        return 'none'; // Custom brush cursor
      case 'text':
        return 'text';
      case 'eraser':
        return 'crosshair';
      default:
        return 'crosshair';
    }
  };

  // Update selected text annotation when toolbar properties change
  useEffect(() => {
    if (!selectedAnnotationId || selectedTool !== 'move') return;

    const selected = annotationsRef.current.find((a) => a.id === selectedAnnotationId);
    if (!selected || selected.type !== 'text') return;

    const needsUpdate =
      (selected.fontSize || DEFAULT_FONT_SIZE) !== fontSize ||
      selected.color !== selectedColor ||
      selected.opacity !== opacity ||
      (selected.bgColor || null) !== textBgColor ||
      (selected.outlineColor || null) !== textOutlineColor ||
      (selected.outlineWidth || 2) !== textOutlineWidth;

    if (!needsUpdate) return;

    // Part of the ongoing selection gesture — committed on pointer/key release
    // so dragging a slider yields a single undo step.
    beginGesture();
    setAnnotations((prev) =>
      prev.map((a) =>
        a.id === selectedAnnotationId ? { ...a, ...buildTextProperties() } : a
      )
    );
  }, [selectedAnnotationId, selectedTool, fontSize, selectedColor, opacity, textBgColor, textOutlineColor, textOutlineWidth, beginGesture, buildTextProperties]);

  // Restore toolbar defaults when deselecting
  useEffect(() => {
    if (selectedAnnotationId !== null) return;

    // Restore toolbar defaults
    if (savedToolbarDefaults.current) {
      const defaults = savedToolbarDefaults.current;
      setSelectedColor(defaults.color);
      setOpacity(defaults.opacity);
      setFontSize(defaults.fontSize);
      setTextBgColor(defaults.textBgColor);
      setTextOutlineColor(defaults.textOutlineColor);
      setTextOutlineWidth(defaults.textOutlineWidth);
      savedToolbarDefaults.current = null;
    }
  }, [selectedAnnotationId]);

  // Should show brush preview cursor
  const showBrushPreview = cursorPos && selectedTool === 'draw';

  // Get selected annotation for resize handles
  const selectedAnnotation = selectedAnnotationId
    ? annotations.find((a) => a.id === selectedAnnotationId)
    : null;
  const resizeHandles = selectedAnnotation && selectedTool === 'move'
    ? getResizeHandles(selectedAnnotation)
    : [];
  const rotationHandlePos = selectedAnnotation && selectedTool === 'move'
    ? getRotationHandlePosition(selectedAnnotation)
    : null;

  return (
    <div
      ref={containerRef}
      className="deixis-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'rgba(0, 0, 0, 0.9)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2147483646,
      }}
    >
      {/* Toolbar */}
      <AnnotationToolbar
        selectedTool={selectedTool}
        onToolChange={(tool) => {
          // Clear selection when switching away from move tool to prevent stale sync
          if (selectedTool === 'move' && tool !== 'move') {
            commitGesture();
            setSelectedAnnotationId(null);
          }
          setSelectedTool(tool);
        }}
        selectedColor={selectedColor}
        onColorChange={setSelectedColor}
        brushSize={brushSize}
        onBrushSizeChange={setBrushSize}
        opacity={opacity}
        onOpacityChange={setOpacity}
        fontSize={fontSize}
        onFontSizeChange={setFontSize}
        textBgColor={textBgColor}
        onTextBgColorChange={setTextBgColor}
        textOutlineColor={textOutlineColor}
        onTextOutlineColorChange={setTextOutlineColor}
        textOutlineWidth={textOutlineWidth}
        onTextOutlineWidthChange={setTextOutlineWidth}
        selectedAnnotationType={selectedAnnotation?.type || null}
        fillColor={fillColor}
        onFillColorChange={setFillColor}
        selectedStamp={selectedStamp}
        onStampChange={setSelectedStamp}
        canUndo={past.length > 0}
        onUndo={handleUndo}
        canRedo={future.length > 0}
        onRedo={handleRedo}
        canClear={annotations.length > 0}
        onClearAll={handleClearAll}
        onCopy={handleCopy}
        onGeneratePrompt={handleGeneratePrompt}
        canGeneratePrompt={annotations.length > 0}
        onSave={handleSave}
        onCancel={onClose}
        onDuplicate={handleDuplicate}
        canDuplicate={selectedAnnotationId !== null}
        showShortcuts={showShortcuts}
        onToggleShortcuts={() => setShowShortcuts(!showShortcuts)}
        position="top"
      />

      {/* Canvas Container */}
      <div
        style={{
          position: 'relative',
          marginTop: 80,
          borderRadius: 8,
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onDoubleClick={handleDoubleClick}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            handleMouseUp();
            setCursorPos(null);
          }}
          style={{
            display: 'block',
            cursor: getCursor(),
          }}
        />

        {/* Brush Size Preview Cursor */}
        {showBrushPreview && (
          <div
            style={{
              position: 'absolute',
              left: cursorPos.x - brushSize / 2,
              top: cursorPos.y - brushSize / 2,
              width: brushSize,
              height: brushSize,
              borderRadius: '50%',
              border: `1px solid ${selectedColor}`,
              backgroundColor: `${selectedColor}33`,
              pointerEvents: 'none',
              transform: 'translate(0, 0)',
            }}
          />
        )}

        {/* Dashed Bounding Box for Selected Text Annotation */}
        {selectedAnnotation && selectedTool === 'move' && selectedAnnotation.type === 'text' && selectedAnnotation.position && selectedAnnotation.text && canvasRef.current && (() => {
          const canvas = canvasRef.current!;
          const ctx = canvas.getContext('2d');
          if (!ctx) return null;
          const textFontSize = selectedAnnotation.fontSize || DEFAULT_FONT_SIZE;
          ctx.font = `bold ${textFontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
          const metrics = ctx.measureText(selectedAnnotation.text!);
          const padding = 6;
          return (
            <div
              style={{
                position: 'absolute',
                left: selectedAnnotation.position!.x - padding,
                top: selectedAnnotation.position!.y - textFontSize - padding,
                width: metrics.width + padding * 2,
                height: textFontSize + 4 + padding * 2,
                border: '1.5px dashed rgba(255, 255, 255, 0.6)',
                borderRadius: 2,
                pointerEvents: 'none',
              }}
            />
          );
        })()}

        {/* Resize Handles for Selected Annotation */}
        {resizeHandles.map(({ handle, point }) => (
          <div
            key={handle}
            onMouseDown={(e) => {
              e.stopPropagation();
              if (selectedAnnotation && canvasRef.current) {
                const rect = canvasRef.current.getBoundingClientRect();
                const clickPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };

                // Calculate anchor position (opposite corner in visual space)
                const anchorHandle = getAnchorHandle(handle);
                const anchorLocalPos = getLocalCorner(selectedAnnotation, anchorHandle);
                const center = getAnnotationCenter(selectedAnnotation);
                const rotation = selectedAnnotation.rotation || 0;
                const anchorPos = anchorLocalPos ? rotatePoint(anchorLocalPos, center, rotation) : null;

                setResizingHandle(handle);
                setResizeStartPoint(clickPoint);
                setOriginalAnnotation({ ...selectedAnnotation });
                setAnchorVisualPos(anchorPos);
              }
            }}
            style={{
              position: 'absolute',
              left: point.x - 5,
              top: point.y - 5,
              width: 10,
              height: 10,
              backgroundColor: '#ffffff',
              border: '2px solid #22C55E',
              borderRadius: 2,
              cursor: getCursorForHandle(handle, selectedAnnotation?.rotation || 0),
              pointerEvents: 'auto',
            }}
          />
        ))}

        {/* Rotation Handle for Selected Annotation */}
        {rotationHandlePos && selectedAnnotation && (
          <div
            onMouseDown={(e) => {
              e.stopPropagation();
              if (canvasRef.current) {
                const rect = canvasRef.current.getBoundingClientRect();
                const clickPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
                setIsRotating(true);
                setOriginalAnnotation({ ...selectedAnnotation });
                const center = getAnnotationCenter(selectedAnnotation);
                const startAngle = Math.atan2(clickPoint.y - center.y, clickPoint.x - center.x);
                setRotationStartAngle(startAngle - (selectedAnnotation.rotation || 0));
              }
            }}
            style={{
              position: 'absolute',
              left: rotationHandlePos.x - 7,
              top: rotationHandlePos.y - 7,
              width: 14,
              height: 14,
              backgroundColor: '#ffffff',
              border: '2px solid #3B82F6',
              borderRadius: '50%',
              cursor: 'grab',
              pointerEvents: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="8" height="8" viewBox="0 0 20 20" fill="none" stroke="#3B82F6" strokeWidth="2">
              <path d="M4 10a6 6 0 0 1 10.5-4" />
              <path d="M17 3l-2.5 3.5L11 5" />
            </svg>
          </div>
        )}

        {/* Text Input */}
        {textInput.visible && (
          <input
            ref={textInputRef}
            type="text"
            placeholder="Type text..."
            onKeyDown={handleTextKeyDown}
            onBlur={handleTextBlur}
            style={{
              position: 'absolute',
              left: textInput.position.x,
              top: textInput.position.y - fontSize - 4,
              background: textBgColor || 'transparent',
              color: selectedColor,
              border: `2px solid ${selectedColor}`,
              borderRadius: 4,
              padding: '4px 8px',
              fontSize: fontSize,
              fontWeight: 'bold',
              outline: 'none',
              minWidth: 100,
              textShadow: textOutlineColor
                ? `
                  -${textOutlineWidth}px -${textOutlineWidth}px 0 ${textOutlineColor},
                   ${textOutlineWidth}px -${textOutlineWidth}px 0 ${textOutlineColor},
                  -${textOutlineWidth}px  ${textOutlineWidth}px 0 ${textOutlineColor},
                   ${textOutlineWidth}px  ${textOutlineWidth}px 0 ${textOutlineColor}
                `
                : 'none',
            }}
          />
        )}
      </div>

      {/* Degraded-mode notice: the host refused a CORS read of this image */}
      {canvasTainted && (
        <p
          style={{
            position: 'fixed',
            bottom: 44,
            color: 'rgba(250, 204, 21, 0.9)',
            fontSize: 12,
            fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
            margin: 0,
          }}
        >
          This image can’t be read pixel-by-pixel, so Blur covers the area with a
          solid block and exporting may be unavailable.
        </p>
      )}

      {/* Export actually failed — tell the user instead of doing nothing */}
      {exportError && (
        <p
          style={{
            position: 'fixed',
            bottom: 68,
            maxWidth: 520,
            textAlign: 'center',
            color: 'rgba(248, 113, 113, 0.95)',
            fontSize: 12,
            fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
            margin: 0,
          }}
        >
          {exportError}
        </p>
      )}

      {/* Instructions */}
      <p
        style={{
          position: 'fixed',
          bottom: 20,
          color: 'rgba(255, 255, 255, 0.5)',
          fontSize: 12,
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        }}
      >
        <kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 4 }}>Escape</kbd> cancel
        {' • '}
        <kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 4 }}>Ctrl+Z</kbd> undo
        {' • '}
        <kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 4 }}>Ctrl+D</kbd> duplicate
        {' • '}
        <kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 4 }}>Shift</kbd> constrain
        {' • '}
        <kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 4 }}>?</kbd> shortcuts
      </p>

      {/* Keyboard Shortcuts Panel */}
      {showShortcuts && (
        <div
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(0, 0, 0, 0.95)',
            borderRadius: 12,
            padding: 24,
            border: '1px solid rgba(255,255,255,0.2)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            zIndex: 2147483647,
            fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
            minWidth: 400,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ color: '#fff', margin: 0, fontSize: 18, fontWeight: 600 }}>Keyboard Shortcuts</h2>
            <button
              onClick={() => setShowShortcuts(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(255,255,255,0.6)',
                cursor: 'pointer',
                fontSize: 20,
                padding: 4,
              }}
            >
              ×
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { key: 'V', action: 'Move tool' },
              { key: 'B', action: 'Brush tool' },
              { key: 'U', action: 'Rectangle' },
              { key: 'E', action: 'Ellipse' },
              { key: 'A', action: 'Arrow' },
              { key: 'L', action: 'Line' },
              { key: 'T', action: 'Text' },
              { key: 'C', action: 'Callout' },
              { key: 'H', action: 'Highlight' },
              { key: 'R', action: 'Blur/Redact' },
              { key: 'S', action: 'Stamp' },
              { key: 'X', action: 'Eraser' },
              { key: 'Ctrl+Z', action: 'Undo' },
              { key: 'Ctrl+Shift+Z', action: 'Redo' },
              { key: 'Ctrl+D', action: 'Duplicate' },
              { key: 'Shift', action: 'Constrain' },
              { key: 'Escape', action: 'Cancel' },
              { key: '?', action: 'This panel' },
            ].map(({ key, action }) => (
              <div
                key={key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '6px 0',
                }}
              >
                <kbd
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    padding: '4px 8px',
                    borderRadius: 4,
                    color: '#fff',
                    fontSize: 12,
                    minWidth: 60,
                    textAlign: 'center',
                    border: '1px solid rgba(255,255,255,0.2)',
                  }}
                >
                  {key}
                </kbd>
                <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>{action}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Generated Prompt Panel */}
      {promptPanel.visible && (
        <div
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(0, 0, 0, 0.95)',
            borderRadius: 12,
            padding: 24,
            border: '1px solid rgba(255,255,255,0.2)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            zIndex: 2147483647,
            fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
            width: 520,
            maxWidth: '90vw',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ color: '#fff', margin: 0, fontSize: 16, fontWeight: 600 }}>Generated Prompt</h2>
            <button
              onClick={() => setPromptPanel({ visible: false, text: '' })}
              aria-label="Close prompt panel"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(255,255,255,0.6)',
                cursor: 'pointer',
                fontSize: 20,
                padding: 4,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, margin: '0 0 8px' }}>
            Edit if needed, then copy and paste it into the chat alongside your annotated image.
          </p>
          <textarea
            value={promptPanel.text}
            onChange={(e) => setPromptPanel((prev) => ({ ...prev, text: e.target.value }))}
            spellCheck={false}
            style={{
              width: '100%',
              minHeight: 180,
              resize: 'vertical',
              background: 'rgba(255,255,255,0.06)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 8,
              padding: 12,
              fontSize: 13,
              lineHeight: 1.5,
              fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginTop: 12 }}>
            {promptCopied && (
              <span style={{ color: '#22C55E', fontSize: 12, fontWeight: 500 }}>Copied</span>
            )}
            <button
              type="button"
              onClick={handleGeneratePrompt}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.25)',
                color: 'rgba(255,255,255,0.85)',
                borderRadius: 8,
                padding: '8px 14px',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Regenerate
            </button>
            <button
              type="button"
              onClick={handleCopyPrompt}
              style={{
                background: '#22C55E',
                border: 'none',
                color: '#04120a',
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Copy prompt
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnnotationOverlay;
