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

  // Drag state for move tool
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<Point>({ x: 0, y: 0 });

  // Eraser state
  const [isErasing, setIsErasing] = useState(false);

  // Cursor preview state
  const [cursorPos, setCursorPos] = useState<Point | null>(null);

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

  // Get center point of an annotation (for calculating drag offset)
  const getAnnotationCenter = (annotation: Annotation): Point => {
    switch (annotation.type) {
      case 'text':
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
      const hitAnnotation = findAnnotationAtPoint(point);
      if (hitAnnotation) {
        setDraggingId(hitAnnotation.id);
        const center = getAnnotationCenter(hitAnnotation);
        setDragOffset({ x: point.x - center.x, y: point.y - center.y });
      }
      return;
    }

    if (selectedTool === 'text') {
      setTextInput({ visible: true, position: point });
      setTimeout(() => textInputRef.current?.focus(), 0);
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
      setCurrentAnnotation({
        ...currentAnnotation,
        end: point,
      });
    }
  };

  const handleMouseUp = () => {
    if (isErasing) {
      setIsErasing(false);
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

  // Should show brush preview cursor
  const showBrushPreview = cursorPos && (
    selectedTool === 'draw' ||
    (selectedTool === 'eraser' && eraserMode === 'stroke')
  );

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
        <kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 4 }}>Ctrl+Shift+Z</kbd> redo
      </p>
    </div>
  );
};

export default AnnotationOverlay;
