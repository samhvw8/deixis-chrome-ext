import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AnnotationToolbar, type AnnotationTool } from './AnnotationToolbar';
import { ANNOTATION_COLORS } from './ColorPicker';

export interface AnnotationOverlayProps {
  imageUrl: string;
  imageBounds?: DOMRect;
  onClose: () => void;
  onCopy: (dataUrl: string) => void;
  onSave: (dataUrl: string) => void;
}

interface Point {
  x: number;
  y: number;
}

// Resize handle positions
type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

interface Annotation {
  id: string;
  type: AnnotationTool;
  color: string;
  strokeWidth: number;
  opacity: number;          // Opacity 0-1
  fillColor?: string;       // Fill color for shapes (null = no fill)
  points?: Point[];      // For freehand draw
  start?: Point;         // For shapes
  end?: Point;           // For shapes
  text?: string;         // For text labels
  position?: Point;      // For text position
  bgColor?: string;      // For text background color
  outlineColor?: string; // For text outline color
  outlineWidth?: number; // For text outline width
  calloutNumber?: number; // For callout annotations
  rotation?: number;     // Rotation angle in radians
}

/**
 * AnnotationOverlay - Full-screen overlay for image annotation
 */
export const AnnotationOverlay: React.FC<AnnotationOverlayProps> = ({
  imageUrl,
  imageBounds,
  onClose,
  onCopy,
  onSave,
}) => {
  // Tool state
  const [selectedTool, setSelectedTool] = useState<AnnotationTool>('draw');
  const [selectedColor, setSelectedColor] = useState(ANNOTATION_COLORS[0].value);
  const [brushSize, setBrushSize] = useState(3);
  const [opacity, setOpacity] = useState(1);
  const [fillColor, setFillColor] = useState<string | null>(null);
  const [textBgColor, setTextBgColor] = useState<string | null>('rgba(0, 0, 0, 0.7)');
  const [textOutlineColor, setTextOutlineColor] = useState<string | null>(null);
  const [textOutlineWidth, setTextOutlineWidth] = useState(2);
  const [eraserMode, setEraserMode] = useState<'object' | 'stroke'>('object');
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [redoStack, setRedoStack] = useState<Annotation[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentAnnotation, setCurrentAnnotation] = useState<Annotation | null>(null);
  const [textInput, setTextInput] = useState<{ visible: boolean; position: Point }>({
    visible: false,
    position: { x: 0, y: 0 },
  });

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

  // Eraser state
  const [isErasing, setIsErasing] = useState(false);

  // Cursor preview state
  const [cursorPos, setCursorPos] = useState<Point | null>(null);

  // Shift key state for constraining shapes
  const [isShiftHeld, setIsShiftHeld] = useState(false);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  // Load image directly for display
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      resizeCanvas();
      redrawCanvas();
    };
    img.onerror = (e) => {
      console.error('[Deixis] Image load error:', e);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // Resize canvas to fit image
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    const container = containerRef.current;

    if (!canvas || !img || !container) return;

    // Calculate size to fit in viewport with padding
    const maxWidth = window.innerWidth - 80;
    const maxHeight = window.innerHeight - 160;
    const imgRatio = img.width / img.height;
    const containerRatio = maxWidth / maxHeight;

    let width: number, height: number;
    if (imgRatio > containerRatio) {
      width = Math.min(img.width, maxWidth);
      height = width / imgRatio;
    } else {
      height = Math.min(img.height, maxHeight);
      width = height * imgRatio;
    }

    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
  }, []);

  // Redraw canvas
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const img = imageRef.current;

    if (!canvas || !ctx || !img) return;

    // Clear and draw image
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Draw all annotations
    [...annotations, currentAnnotation].forEach((annotation) => {
      if (!annotation) return;
      drawAnnotation(ctx, annotation);
    });
  }, [annotations, currentAnnotation]);

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
          ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, sans-serif';
          const metrics = ctx.measureText(annotation.text);
          const padding = 4;
          // Draw text background if bgColor is set
          if (annotation.bgColor) {
            ctx.fillStyle = annotation.bgColor;
            ctx.fillRect(
              annotation.position.x - padding,
              annotation.position.y - 16 - padding,
              metrics.width + padding * 2,
              20 + padding
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

  // Constrain point for Shift+drag (perfect squares/circles, 45° angles)
  const constrainPoint = (start: Point, end: Point, type: AnnotationTool): Point => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;

    if (type === 'rectangle' || type === 'circle') {
      // Constrain to perfect square/circle
      const size = Math.max(Math.abs(dx), Math.abs(dy));
      return {
        x: start.x + size * Math.sign(dx || 1),
        y: start.y + size * Math.sign(dy || 1),
      };
    } else if (type === 'arrow') {
      // Snap to 45° angles (0, 45, 90, 135, 180, etc.)
      const angle = Math.atan2(dy, dx);
      const snapAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
      const length = Math.sqrt(dx * dx + dy * dy);
      return {
        x: start.x + length * Math.cos(snapAngle),
        y: start.y + length * Math.sin(snapAngle),
      };
    }
    return end;
  };

  // Hit detection - find annotation at point
  const findAnnotationAtPoint = (point: Point): Annotation | null => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return null;

    // Check annotations in reverse order (top-most first)
    for (let i = annotations.length - 1; i >= 0; i--) {
      const annotation = annotations[i];
      const hitPadding = 10; // Tolerance for clicking

      switch (annotation.type) {
        case 'text':
          if (annotation.position && annotation.text) {
            ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, sans-serif';
            const metrics = ctx.measureText(annotation.text);
            const padding = 4;
            if (
              point.x >= annotation.position.x - padding &&
              point.x <= annotation.position.x + metrics.width + padding &&
              point.y >= annotation.position.y - 16 - padding &&
              point.y <= annotation.position.y + padding
            ) {
              return annotation;
            }
          }
          break;

        case 'rectangle':
          if (annotation.start && annotation.end) {
            const minX = Math.min(annotation.start.x, annotation.end.x);
            const maxX = Math.max(annotation.start.x, annotation.end.x);
            const minY = Math.min(annotation.start.y, annotation.end.y);
            const maxY = Math.max(annotation.start.y, annotation.end.y);
            // Check if near the border
            const nearLeft = Math.abs(point.x - minX) < hitPadding && point.y >= minY && point.y <= maxY;
            const nearRight = Math.abs(point.x - maxX) < hitPadding && point.y >= minY && point.y <= maxY;
            const nearTop = Math.abs(point.y - minY) < hitPadding && point.x >= minX && point.x <= maxX;
            const nearBottom = Math.abs(point.y - maxY) < hitPadding && point.x >= minX && point.x <= maxX;
            if (nearLeft || nearRight || nearTop || nearBottom) {
              return annotation;
            }
          }
          break;

        case 'circle':
          if (annotation.start && annotation.end) {
            const centerX = (annotation.start.x + annotation.end.x) / 2;
            const centerY = (annotation.start.y + annotation.end.y) / 2;
            const radiusX = Math.abs(annotation.end.x - annotation.start.x) / 2;
            const radiusY = Math.abs(annotation.end.y - annotation.start.y) / 2;
            // Ellipse equation
            const dx = point.x - centerX;
            const dy = point.y - centerY;
            const normalizedDist = (dx * dx) / (radiusX * radiusX) + (dy * dy) / (radiusY * radiusY);
            if (Math.abs(normalizedDist - 1) < 0.3) {
              return annotation;
            }
          }
          break;

        case 'arrow':
          if (annotation.start && annotation.end) {
            // Check distance to line segment
            const dist = distanceToLineSegment(point, annotation.start, annotation.end);
            if (dist < hitPadding) {
              return annotation;
            }
          }
          break;

        case 'draw':
          if (annotation.points && annotation.points.length > 0) {
            // Check if near any point in the path
            for (const p of annotation.points) {
              const dx = point.x - p.x;
              const dy = point.y - p.y;
              if (Math.sqrt(dx * dx + dy * dy) < hitPadding) {
                return annotation;
              }
            }
          }
          break;

        case 'callout':
          if (annotation.position) {
            const calloutRadius = 14;
            const dx = point.x - annotation.position.x;
            const dy = point.y - annotation.position.y;
            if (Math.sqrt(dx * dx + dy * dy) <= calloutRadius + hitPadding) {
              return annotation;
            }
          }
          break;
      }
    }
    return null;
  };

  // Distance from point to line segment
  const distanceToLineSegment = (p: Point, a: Point, b: Point): number => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSq = dx * dx + dy * dy;
    if (lengthSq === 0) return Math.sqrt((p.x - a.x) ** 2 + (p.y - a.y) ** 2);

    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq;
    t = Math.max(0, Math.min(1, t));

    const projX = a.x + t * dx;
    const projY = a.y + t * dy;
    return Math.sqrt((p.x - projX) ** 2 + (p.y - projY) ** 2);
  };

  // Get resize handles for an annotation (only for resizable types)
  const getResizeHandles = (annotation: Annotation): { handle: ResizeHandle; point: Point }[] => {
    if (!['rectangle', 'circle', 'arrow'].includes(annotation.type)) {
      return [];
    }

    if (!annotation.start || !annotation.end) return [];

    const minX = Math.min(annotation.start.x, annotation.end.x);
    const maxX = Math.max(annotation.start.x, annotation.end.x);
    const minY = Math.min(annotation.start.y, annotation.end.y);
    const maxY = Math.max(annotation.start.y, annotation.end.y);
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;

    let handles: { handle: ResizeHandle; point: Point }[];

    if (annotation.type === 'arrow') {
      // For arrows, just show start and end handles
      handles = [
        { handle: 'nw', point: annotation.start },
        { handle: 'se', point: annotation.end },
      ];
    } else {
      handles = [
        { handle: 'nw', point: { x: minX, y: minY } },
        { handle: 'n', point: { x: midX, y: minY } },
        { handle: 'ne', point: { x: maxX, y: minY } },
        { handle: 'e', point: { x: maxX, y: midY } },
        { handle: 'se', point: { x: maxX, y: maxY } },
        { handle: 's', point: { x: midX, y: maxY } },
        { handle: 'sw', point: { x: minX, y: maxY } },
        { handle: 'w', point: { x: minX, y: midY } },
      ];
    }

    // Apply rotation transform to handle positions
    const rotation = annotation.rotation || 0;
    if (rotation !== 0) {
      const center = getAnnotationCenter(annotation);
      handles = handles.map(({ handle, point }) => {
        const dx = point.x - center.x;
        const dy = point.y - center.y;
        const rotatedX = center.x + dx * Math.cos(rotation) - dy * Math.sin(rotation);
        const rotatedY = center.y + dx * Math.sin(rotation) + dy * Math.cos(rotation);
        return { handle, point: { x: rotatedX, y: rotatedY } };
      });
    }

    return handles;
  };

  // Check if a point is on a resize handle
  const findResizeHandleAtPoint = (point: Point, annotation: Annotation): ResizeHandle | null => {
    const handles = getResizeHandles(annotation);
    const handleRadius = 6;

    for (const { handle, point: handlePoint } of handles) {
      const dx = point.x - handlePoint.x;
      const dy = point.y - handlePoint.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance <= handleRadius) {
        return handle;
      }
    }
    return null;
  };

  // Get rotation handle position (above the top center of the annotation)
  const getRotationHandlePosition = (annotation: Annotation): Point | null => {
    if (!['rectangle', 'circle', 'arrow'].includes(annotation.type)) {
      return null;
    }

    if (!annotation.start || !annotation.end) return null;

    const minY = Math.min(annotation.start.y, annotation.end.y);
    const midX = (annotation.start.x + annotation.end.x) / 2;
    const handleDistance = 25; // Distance above the annotation

    // Apply current rotation to find actual handle position
    const center = getAnnotationCenter(annotation);
    const rotation = annotation.rotation || 0;

    // Rotate the handle position around the center
    const handleY = minY - handleDistance;
    const dx = midX - center.x;
    const dy = handleY - center.y;
    const rotatedX = center.x + dx * Math.cos(rotation) - dy * Math.sin(rotation);
    const rotatedY = center.y + dx * Math.sin(rotation) + dy * Math.cos(rotation);

    return { x: rotatedX, y: rotatedY };
  };

  // Check if a point is on the rotation handle
  const isPointOnRotationHandle = (point: Point, annotation: Annotation): boolean => {
    const handlePos = getRotationHandlePosition(annotation);
    if (!handlePos) return false;

    const handleRadius = 8;
    const dx = point.x - handlePos.x;
    const dy = point.y - handlePos.y;
    return Math.sqrt(dx * dx + dy * dy) <= handleRadius;
  };

  // Get the anchor handle (opposite corner) for resize operations
  const getAnchorHandle = (handle: ResizeHandle): ResizeHandle => {
    const opposites: Record<ResizeHandle, ResizeHandle> = {
      'nw': 'se', 'n': 's', 'ne': 'sw', 'e': 'w',
      'se': 'nw', 's': 'n', 'sw': 'ne', 'w': 'e',
    };
    return opposites[handle];
  };

  // Get unrotated corner position for a handle
  const getLocalCorner = (annotation: Annotation, handle: ResizeHandle): Point | null => {
    if (!annotation.start || !annotation.end) return null;

    const minX = Math.min(annotation.start.x, annotation.end.x);
    const maxX = Math.max(annotation.start.x, annotation.end.x);
    const minY = Math.min(annotation.start.y, annotation.end.y);
    const maxY = Math.max(annotation.start.y, annotation.end.y);
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
  };

  // Rotate a point around a center
  const rotatePoint = (point: Point, center: Point, angle: number): Point => {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    return {
      x: center.x + dx * cos - dy * sin,
      y: center.y + dx * sin + dy * cos,
    };
  };

  // Resize annotation based on handle drag - anchor-based approach
  const resizeAnnotation = (
    annotation: Annotation,
    handle: ResizeHandle,
    screenDelta: Point,
    _anchorVisualPos: Point
  ): Annotation => {
    if (!annotation.start || !annotation.end) return annotation;

    const rotation = annotation.rotation || 0;

    // Transform screen delta to local (unrotated) space
    const cos = Math.cos(-rotation);
    const sin = Math.sin(-rotation);
    const localDelta = {
      x: screenDelta.x * cos - screenDelta.y * sin,
      y: screenDelta.x * sin + screenDelta.y * cos,
    };

    // For arrows, use simple endpoint adjustment
    if (annotation.type === 'arrow') {
      if (handle === 'nw') {
        return { ...annotation, start: { x: annotation.start.x + localDelta.x, y: annotation.start.y + localDelta.y } };
      } else if (handle === 'se') {
        return { ...annotation, end: { x: annotation.end.x + localDelta.x, y: annotation.end.y + localDelta.y } };
      }
      return annotation;
    }

    // For rectangles and circles, apply delta to the appropriate edges
    let newStart = { ...annotation.start };
    let newEnd = { ...annotation.end };

    // Determine which edges to move based on handle
    // Corner handles move both axes, edge handles move one axis
    switch (handle) {
      case 'nw':
        // Move top-left corner: both start.x and start.y change
        newStart = { x: annotation.start.x + localDelta.x, y: annotation.start.y + localDelta.y };
        break;
      case 'n':
        // Move top edge: only start.y changes
        newStart = { ...annotation.start, y: annotation.start.y + localDelta.y };
        break;
      case 'ne':
        // Move top-right corner: end.x and start.y change
        newStart = { ...annotation.start, y: annotation.start.y + localDelta.y };
        newEnd = { ...annotation.end, x: annotation.end.x + localDelta.x };
        break;
      case 'e':
        // Move right edge: only end.x changes
        newEnd = { ...annotation.end, x: annotation.end.x + localDelta.x };
        break;
      case 'se':
        // Move bottom-right corner: both end.x and end.y change
        newEnd = { x: annotation.end.x + localDelta.x, y: annotation.end.y + localDelta.y };
        break;
      case 's':
        // Move bottom edge: only end.y changes
        newEnd = { ...annotation.end, y: annotation.end.y + localDelta.y };
        break;
      case 'sw':
        // Move bottom-left corner: start.x and end.y change
        newStart = { ...annotation.start, x: annotation.start.x + localDelta.x };
        newEnd = { ...annotation.end, y: annotation.end.y + localDelta.y };
        break;
      case 'w':
        // Move left edge: only start.x changes
        newStart = { ...annotation.start, x: annotation.start.x + localDelta.x };
        break;
    }

    return { ...annotation, start: newStart, end: newEnd };
  };

  // Get center point of an annotation (for calculating drag offset)
  const getAnnotationCenter = (annotation: Annotation): Point => {
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
  };

  // Move annotation by delta
  const moveAnnotation = (annotation: Annotation, delta: Point): Annotation => {
    switch (annotation.type) {
      case 'text':
      case 'callout':
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
  };

  // Duplicate annotation with offset
  const duplicateAnnotation = useCallback((annotation: Annotation): Annotation => {
    const offset = 20; // Offset in pixels
    const newAnnotation = moveAnnotation(annotation, { x: offset, y: offset });
    return {
      ...newAnnotation,
      id: `annotation-${Date.now()}`,
    };
  }, []);

  // Erase stroke points near a given point (for stroke eraser mode)
  const eraseStrokeAtPoint = useCallback((point: Point) => {
    const eraseRadius = 10; // Pixels radius for erasing

    setAnnotations((prev) => {
      return prev
        .map((annotation) => {
          if (annotation.type !== 'draw' || !annotation.points) {
            return annotation;
          }

          // Filter out points that are within eraseRadius of the cursor
          const newPoints = annotation.points.filter((p) => {
            const dx = p.x - point.x;
            const dy = p.y - point.y;
            return Math.sqrt(dx * dx + dy * dy) > eraseRadius;
          });

          // If no points left, return null to remove this annotation
          if (newPoints.length === 0) {
            return null;
          }

          // If we removed some points, return updated annotation
          if (newPoints.length !== annotation.points.length) {
            return { ...annotation, points: newPoints };
          }

          return annotation;
        })
        .filter((a): a is Annotation => a !== null);
    });
  }, []);

  // Mouse handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const point = getCanvasPoint(e);

    // Handle eraser tool
    if (selectedTool === 'eraser') {
      if (eraserMode === 'object') {
        // Object mode: delete entire annotation on click
        const hitAnnotation = findAnnotationAtPoint(point);
        if (hitAnnotation) {
          setAnnotations((prev) => prev.filter((a) => a.id !== hitAnnotation.id));
        }
      } else {
        // Stroke mode: start erasing
        setIsErasing(true);
        eraseStrokeAtPoint(point);
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

            setResizingHandle(handle);
            setResizeStartPoint(point);
            setOriginalAnnotation({ ...selectedAnnotation });
            setAnchorVisualPos(anchorPos);
            return;
          }
        }
      }

      // Then check for hit on any annotation
      const hitAnnotation = findAnnotationAtPoint(point);

      if (hitAnnotation) {
        setSelectedAnnotationId(hitAnnotation.id);
        setDraggingId(hitAnnotation.id);
        const center = getAnnotationCenter(hitAnnotation);
        setDragOffset({ x: point.x - center.x, y: point.y - center.y });
      } else {
        setSelectedAnnotationId(null);
      }
      return;
    }

    if (selectedTool === 'text') {
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
      setAnnotations((prev) => [...prev, newAnnotation]);
      setCalloutCounter((prev) => prev + 1);
      setRedoStack([]); // Clear redo stack on new annotation
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

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const point = getCanvasPoint(e);

    // Update cursor position for brush preview
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      setCursorPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }

    // Handle stroke erasing
    if (isErasing && selectedTool === 'eraser' && eraserMode === 'stroke') {
      eraseStrokeAtPoint(point);
      return;
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
    if (isErasing) {
      setIsErasing(false);
      return;
    }

    // Skip if rotating or resizing - window-level handlers manage these
    if (isRotating || resizingHandle) {
      return;
    }

    if (draggingId) {
      setDraggingId(null);
      return;
    }

    if (isDrawing && currentAnnotation) {
      setAnnotations([...annotations, currentAnnotation]);
      setRedoStack([]); // Clear redo stack on new annotation
      setCurrentAnnotation(null);
    }
    setIsDrawing(false);
  };

  // Text input handlers
  const submitText = () => {
    if (textInputRef.current?.value) {
      const newAnnotation: Annotation = {
        id: `annotation-${Date.now()}`,
        type: 'text',
        color: selectedColor,
        strokeWidth: 3,
        opacity: opacity,
        text: textInputRef.current.value,
        position: textInput.position,
        bgColor: textBgColor || undefined,
        outlineColor: textOutlineColor || undefined,
        outlineWidth: textOutlineColor ? textOutlineWidth : undefined,
      };
      setAnnotations([...annotations, newAnnotation]);
      setRedoStack([]); // Clear redo stack on new annotation
      textInputRef.current.value = '';
    }
    setTextInput({ visible: false, position: { x: 0, y: 0 } });
  };

  const handleTextKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitText();
    } else if (e.key === 'Escape') {
      // Discard - just close without saving
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
    setAnnotations((prev) => {
      if (prev.length === 0) return prev;
      const removed = prev[prev.length - 1];
      setRedoStack((stack) => [...stack, removed]);
      return prev.slice(0, -1);
    });
  }, []);

  const handleRedo = useCallback(() => {
    setRedoStack((stack) => {
      if (stack.length === 0) return stack;
      const restored = stack[stack.length - 1];
      setAnnotations((prev) => [...prev, restored]);
      return stack.slice(0, -1);
    });
  }, []);

  // Handle duplicate selected annotation (Ctrl+D)
  const handleDuplicate = useCallback(() => {
    if (!selectedAnnotationId) return;
    const annotation = annotations.find((a) => a.id === selectedAnnotationId);
    if (annotation) {
      const duplicated = duplicateAnnotation(annotation);
      setAnnotations((prev) => [...prev, duplicated]);
      setSelectedAnnotationId(duplicated.id);
      setRedoStack([]); // Clear redo stack on new annotation
    }
  }, [selectedAnnotationId, annotations, duplicateAnnotation]);

  const handleClearAll = useCallback(() => {
    setAnnotations([]);
  }, []);

  // Get annotated image as data URL (handles tainted canvas via tab capture)
  const getAnnotatedImage = useCallback(async (): Promise<string | null> => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    try {
      // Try toDataURL first (works if canvas is not tainted)
      return canvas.toDataURL('image/png');
    } catch (error) {
      console.log('[Deixis] Canvas tainted, using tab capture for export');

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
          console.error('[Deixis] Tab capture failed:', response?.error);
          return null;
        }
      } catch (captureError) {
        console.error('[Deixis] Capture error:', captureError);
        return null;
      }
    }
  }, []);

  const handleCopy = useCallback(async () => {
    const dataUrl = await getAnnotatedImage();
    if (dataUrl) {
      onCopy(dataUrl);
    }
  }, [getAnnotatedImage, onCopy]);

  const handleSave = useCallback(async () => {
    const dataUrl = await getAnnotatedImage();
    if (dataUrl) {
      onSave(dataUrl);
    }
  }, [getAnnotatedImage, onSave]);

  // Redraw on annotation changes
  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      resizeCanvas();
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
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [resizingHandle, isRotating, resizeStartPoint, originalAnnotation, rotationStartAngle, isShiftHeld, anchorVisualPos]);

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
        return eraserMode === 'stroke' ? 'none' : 'crosshair';
      default:
        return 'crosshair';
    }
  };

  // Cursor for resize handles (accounting for rotation)
  const getCursorForHandle = (handle: ResizeHandle, rotation: number = 0): string => {
    // Define the base angle for each handle (in radians)
    const handleAngles: Record<ResizeHandle, number> = {
      'e': 0,
      'se': Math.PI / 4,
      's': Math.PI / 2,
      'sw': (3 * Math.PI) / 4,
      'w': Math.PI,
      'nw': -(3 * Math.PI) / 4,
      'n': -Math.PI / 2,
      'ne': -Math.PI / 4,
    };

    // Calculate the effective angle after rotation
    let effectiveAngle = handleAngles[handle] + rotation;

    // Normalize to 0 to 2π range
    while (effectiveAngle < 0) effectiveAngle += Math.PI * 2;
    while (effectiveAngle >= Math.PI * 2) effectiveAngle -= Math.PI * 2;

    // Determine cursor based on effective angle (8 sectors of 22.5° each)
    // We map to 4 cursor types (each covers 2 opposite sectors)
    const sector = Math.round((effectiveAngle / Math.PI) * 4) % 4;

    switch (sector) {
      case 0: // ~0° or ~180° (horizontal)
        return 'ew-resize';
      case 1: // ~45° or ~225° (diagonal)
        return 'nwse-resize';
      case 2: // ~90° or ~270° (vertical)
        return 'ns-resize';
      case 3: // ~135° or ~315° (other diagonal)
        return 'nesw-resize';
      default:
        return 'pointer';
    }
  };

  // Should show brush preview cursor
  const showBrushPreview = cursorPos && (
    selectedTool === 'draw' ||
    (selectedTool === 'eraser' && eraserMode === 'stroke')
  );

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
        onToolChange={setSelectedTool}
        selectedColor={selectedColor}
        onColorChange={setSelectedColor}
        brushSize={brushSize}
        onBrushSizeChange={setBrushSize}
        opacity={opacity}
        onOpacityChange={setOpacity}
        textBgColor={textBgColor}
        onTextBgColorChange={setTextBgColor}
        textOutlineColor={textOutlineColor}
        onTextOutlineColorChange={setTextOutlineColor}
        textOutlineWidth={textOutlineWidth}
        onTextOutlineWidthChange={setTextOutlineWidth}
        fillColor={fillColor}
        onFillColorChange={setFillColor}
        eraserMode={eraserMode}
        onEraserModeChange={setEraserMode}
        canUndo={annotations.length > 0}
        onUndo={handleUndo}
        canRedo={redoStack.length > 0}
        onRedo={handleRedo}
        canClear={annotations.length > 0}
        onClearAll={handleClearAll}
        onCopy={handleCopy}
        onSave={handleSave}
        onCancel={onClose}
        onDuplicate={handleDuplicate}
        canDuplicate={selectedAnnotationId !== null}
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
              border: `1px solid ${selectedTool === 'eraser' ? '#fff' : selectedColor}`,
              backgroundColor: selectedTool === 'eraser'
                ? 'rgba(255, 255, 255, 0.2)'
                : `${selectedColor}33`,
              pointerEvents: 'none',
              transform: 'translate(0, 0)',
            }}
          />
        )}

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
              top: textInput.position.y - 20,
              background: textBgColor || 'transparent',
              color: selectedColor,
              border: `2px solid ${selectedColor}`,
              borderRadius: 4,
              padding: '4px 8px',
              fontSize: 14,
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
      </p>
    </div>
  );
};

export default AnnotationOverlay;
