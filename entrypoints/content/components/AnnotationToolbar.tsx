import React, { useCallback, useEffect, useState } from 'react';
import { ToolButton } from './ToolButton';
import { ColorPicker, ANNOTATION_COLORS } from './ColorPicker';
import {
  MoveIcon,
  PencilIcon,
  SquareIcon,
  CircleIcon,
  ArrowIcon,
  TypeIcon,
  EraserIcon,
  UndoIcon,
  RedoIcon,
  TrashIcon,
  CopyIcon,
  DownloadIcon,
  CloseIcon,
  CalloutIcon,
  BlurIcon,
  HighlightIcon,
  LineIcon,
  StampIcon,
  KeyboardIcon,
} from '../icons';

export type AnnotationTool = 'move' | 'draw' | 'rectangle' | 'circle' | 'arrow' | 'line' | 'text' | 'eraser' | 'callout' | 'blur' | 'highlight' | 'stamp';

export interface AnnotationToolbarProps {
  /** Currently selected tool */
  selectedTool: AnnotationTool;
  /** Callback when tool is selected */
  onToolChange: (tool: AnnotationTool) => void;
  /** Currently selected color */
  selectedColor: string;
  /** Callback when color is selected */
  onColorChange: (color: string) => void;
  /** Brush/stroke size */
  brushSize: number;
  /** Callback when brush size changes */
  onBrushSizeChange: (size: number) => void;
  /** Opacity 0-1 */
  opacity: number;
  /** Callback when opacity changes */
  onOpacityChange: (opacity: number) => void;
  /** Text background color (null means no background) */
  textBgColor: string | null;
  /** Callback when text background color changes */
  onTextBgColorChange: (color: string | null) => void;
  /** Text outline color (null means no outline) */
  textOutlineColor: string | null;
  /** Callback when text outline color changes */
  onTextOutlineColorChange: (color: string | null) => void;
  /** Text outline width */
  textOutlineWidth: number;
  /** Callback when text outline width changes */
  onTextOutlineWidthChange: (width: number) => void;
  /** Fill color for shapes (null means no fill) */
  fillColor: string | null;
  /** Callback when fill color changes */
  onFillColorChange: (color: string | null) => void;
  /** Currently selected stamp */
  selectedStamp: string;
  /** Callback when stamp is selected */
  onStampChange: (stamp: string) => void;
  /** Whether undo is available */
  canUndo: boolean;
  /** Callback for undo action */
  onUndo: () => void;
  /** Whether redo is available */
  canRedo: boolean;
  /** Callback for redo action */
  onRedo: () => void;
  /** Whether there are annotations to clear */
  canClear: boolean;
  /** Callback for clear all action */
  onClearAll: () => void;
  /** Callback for copy to clipboard action */
  onCopy: () => void;
  /** Callback for save/download action */
  onSave: () => void;
  /** Callback for cancel action */
  onCancel: () => void;
  /** Callback for duplicate action */
  onDuplicate?: () => void;
  /** Whether duplicate is available (annotation selected) */
  canDuplicate?: boolean;
  /** Whether shortcuts panel is visible */
  showShortcuts: boolean;
  /** Callback to toggle shortcuts panel */
  onToggleShortcuts: () => void;
  /** Position of toolbar */
  position?: 'top' | 'bottom';
  /** Custom className */
  className?: string;
}

/**
 * AnnotationToolbar - Main toolbar component for image annotation.
 *
 * Layout: [Drawing Tools] | [Color Picker] | [Undo/Clear] | [Done/Cancel]
 *
 * Keyboard shortcuts:
 * - V: Move tool
 * - B: Brush/Draw tool
 * - U: Rectangle tool
 * - E: Ellipse tool
 * - A: Arrow tool
 * - L: Line tool
 * - T: Text tool
 * - C: Callout tool
 * - H: Highlight tool
 * - R: Blur/Redact tool
 * - S: Stamp tool
 * - X: Eraser tool
 * - ?: Toggle shortcuts panel
 * - Ctrl/Cmd+Z: Undo
 * - Escape: Cancel
 */
export const AnnotationToolbar: React.FC<AnnotationToolbarProps> = ({
  selectedTool,
  onToolChange,
  selectedColor,
  onColorChange,
  brushSize,
  onBrushSizeChange,
  opacity,
  onOpacityChange,
  textBgColor,
  onTextBgColorChange,
  textOutlineColor,
  onTextOutlineColorChange,
  textOutlineWidth,
  onTextOutlineWidthChange,
  fillColor,
  onFillColorChange,
  selectedStamp,
  onStampChange,
  canUndo,
  onUndo,
  canRedo,
  onRedo,
  canClear,
  onClearAll,
  onCopy,
  onSave,
  onCancel,
  onDuplicate,
  canDuplicate = false,
  showShortcuts,
  onToggleShortcuts,
  position = 'top',
  className = ''
}) => {
  const [savedFeedback, setSavedFeedback] = useState<'copy' | 'download' | null>(null);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger if user is typing in an input (use composedPath for Shadow DOM)
      const path = event.composedPath();
      const isTypingInInput = path.some(
        (el) => el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
      );
      if (isTypingInInput) {
        return;
      }

      const isMeta = event.metaKey || event.ctrlKey;

      switch (event.key.toLowerCase()) {
        case 'v':
          if (!isMeta) {
            event.preventDefault();
            onToolChange('move');
          }
          break;
        case 'b':
          if (!isMeta) {
            event.preventDefault();
            onToolChange('draw');
          }
          break;
        case 'u':
          if (!isMeta) {
            event.preventDefault();
            onToolChange('rectangle');
          }
          break;
        case 'e':
          if (!isMeta) {
            event.preventDefault();
            onToolChange('circle');
          }
          break;
        case 'a':
          if (!isMeta) {
            event.preventDefault();
            onToolChange('arrow');
          }
          break;
        case 'l':
          if (!isMeta) {
            event.preventDefault();
            onToolChange('line');
          }
          break;
        case 't':
          if (!isMeta) {
            event.preventDefault();
            onToolChange('text');
          }
          break;
        case 'c':
          if (!isMeta) {
            event.preventDefault();
            onToolChange('callout');
          }
          break;
        case 'h':
          if (!isMeta) {
            event.preventDefault();
            onToolChange('highlight');
          }
          break;
        case 'r':
          if (!isMeta) {
            event.preventDefault();
            onToolChange('blur');
          }
          break;
        case 's':
          if (!isMeta) {
            event.preventDefault();
            onToolChange('stamp');
          }
          break;
        case 'x':
          if (!isMeta) {
            event.preventDefault();
            onToolChange('eraser');
          }
          break;
        case '?':
          event.preventDefault();
          onToggleShortcuts();
          break;
        case 'z':
          if (isMeta && !event.shiftKey && canUndo) {
            event.preventDefault();
            onUndo();
          } else if (isMeta && event.shiftKey && canRedo) {
            event.preventDefault();
            onRedo();
          }
          break;
        case 'y':
          if (isMeta && canRedo) {
            event.preventDefault();
            onRedo();
          }
          break;
        case 'd':
          if (isMeta && canDuplicate && onDuplicate) {
            event.preventDefault();
            onDuplicate();
          }
          break;
        case 'escape':
          event.preventDefault();
          onCancel();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onToolChange, onUndo, onRedo, onCancel, onDuplicate, onToggleShortcuts, canUndo, canRedo, canDuplicate]);

  const handleCopy = useCallback(() => {
    onCopy();
    setSavedFeedback('copy');
    setTimeout(() => setSavedFeedback(null), 1500);
  }, [onCopy]);

  const handleSave = useCallback(() => {
    onSave();
    setSavedFeedback('download');
    setTimeout(() => setSavedFeedback(null), 1500);
  }, [onSave]);

  const tools: { id: AnnotationTool; icon: React.ReactNode; tooltip: string; shortcut: string }[] = [
    { id: 'move', icon: <MoveIcon />, tooltip: 'Move', shortcut: 'V' },
    { id: 'draw', icon: <PencilIcon />, tooltip: 'Brush', shortcut: 'B' },
    { id: 'rectangle', icon: <SquareIcon />, tooltip: 'Rectangle', shortcut: 'U' },
    { id: 'circle', icon: <CircleIcon />, tooltip: 'Ellipse', shortcut: 'E' },
    { id: 'arrow', icon: <ArrowIcon />, tooltip: 'Arrow', shortcut: 'A' },
    { id: 'line', icon: <LineIcon />, tooltip: 'Line', shortcut: 'L' },
    { id: 'text', icon: <TypeIcon />, tooltip: 'Text', shortcut: 'T' },
    { id: 'callout', icon: <CalloutIcon />, tooltip: 'Callout', shortcut: 'C' },
    { id: 'highlight', icon: <HighlightIcon />, tooltip: 'Highlight', shortcut: 'H' },
    { id: 'blur', icon: <BlurIcon />, tooltip: 'Blur/Redact', shortcut: 'R' },
    { id: 'stamp', icon: <StampIcon />, tooltip: 'Stamp', shortcut: 'S' },
    { id: 'eraser', icon: <EraserIcon />, tooltip: 'Eraser', shortcut: 'X' },
  ];

  const positionStyles: React.CSSProperties = position === 'top'
    ? { top: 16, left: '50%', transform: 'translateX(-50%)' }
    : { bottom: 16, left: '50%', transform: 'translateX(-50%)' };

  const flexCenter: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
  };

  const groupStyle: React.CSSProperties = {
    ...flexCenter,
    gap: 4,
  };

  return (
    <>
      <div
        className={`deixis-toolbar ${className}`.trim()}
        style={{ position: 'fixed', ...positionStyles }}
        role="toolbar"
        aria-label="Annotation tools"
      >
        {/* Drawing Tools */}
        <div style={groupStyle} role="group" aria-label="Drawing tools">
          {tools.map((tool) => (
            <ToolButton
              key={tool.id}
              icon={tool.icon}
              tooltip={tool.tooltip}
              shortcut={tool.shortcut}
              isActive={selectedTool === tool.id}
              onClick={() => onToolChange(tool.id)}
            />
          ))}
        </div>

        {/* Divider */}
        <div className="deixis-divider" role="separator" />

        {/* Color Picker */}
        <ColorPicker
          selectedColor={selectedColor}
          onColorChange={onColorChange}
          colors={ANNOTATION_COLORS}
          tooltip="Color"
          closeTrigger={selectedTool}
        />

        {/* Brush Size - shown for draw, rectangle, circle, arrow */}
        {['draw', 'rectangle', 'circle', 'arrow'].includes(selectedTool) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 8 }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap' }}>Size:</span>
            <input
              type="range"
              min="1"
              max="20"
              value={brushSize}
              onChange={(e) => onBrushSizeChange(Number(e.target.value))}
              style={{
                width: 60,
                height: 16,
                cursor: 'pointer',
              }}
              title={`Brush size: ${brushSize}px`}
            />
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', minWidth: 24 }}>
              {brushSize}px
            </span>
          </div>
        )}

        {/* Opacity - shown for all drawing tools */}
        {['draw', 'rectangle', 'circle', 'arrow', 'text'].includes(selectedTool) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 8 }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap' }}>Opacity:</span>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.1"
              value={opacity}
              onChange={(e) => onOpacityChange(Number(e.target.value))}
              style={{
                width: 50,
                height: 16,
                cursor: 'pointer',
              }}
              title={`Opacity: ${Math.round(opacity * 100)}%`}
            />
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', minWidth: 28 }}>
              {Math.round(opacity * 100)}%
            </span>
          </div>
        )}

        {/* Fill Color - shown for rectangle and circle tools */}
        {['rectangle', 'circle'].includes(selectedTool) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 8 }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap' }}>Fill:</span>
            <button
              type="button"
              onClick={() => onFillColorChange(fillColor ? null : selectedColor)}
              style={{
                width: 24,
                height: 24,
                borderRadius: 4,
                border: fillColor ? '2px solid #fff' : '2px dashed rgba(255,255,255,0.4)',
                background: fillColor || 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                color: 'rgba(255,255,255,0.6)',
              }}
              title={fillColor ? 'Click to remove fill' : 'Click to enable fill'}
            >
              {!fillColor && '∅'}
            </button>
            {fillColor && (
              <input
                type="color"
                value={fillColor}
                onChange={(e) => onFillColorChange(e.target.value)}
                style={{
                  width: 24,
                  height: 24,
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  background: 'transparent',
                }}
                title="Choose fill color"
              />
            )}
          </div>
        )}

        {/* Text Background Color Picker - only shown for text tool */}
        {selectedTool === 'text' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 4 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap' }}>BG:</span>
              <button
                type="button"
                onClick={() => onTextBgColorChange(textBgColor ? null : 'rgba(0, 0, 0, 0.7)')}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 4,
                  border: textBgColor ? '2px solid #fff' : '2px dashed rgba(255,255,255,0.4)',
                  background: textBgColor || 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  color: 'rgba(255,255,255,0.6)',
                }}
                title={textBgColor ? 'Click to remove background' : 'Click to enable background'}
              >
                {!textBgColor && '∅'}
              </button>
              {textBgColor && (
                <input
                  type="color"
                  value={textBgColor.startsWith('rgba') ? '#000000' : textBgColor}
                  onChange={(e) => onTextBgColorChange(e.target.value)}
                  style={{
                    width: 24,
                    height: 24,
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                    background: 'transparent',
                  }}
                  title="Choose background color"
                />
              )}
            </div>

            {/* Text Outline Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 8 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap' }}>Outline:</span>
              <button
                type="button"
                onClick={() => onTextOutlineColorChange(textOutlineColor ? null : '#000000')}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 4,
                  border: textOutlineColor ? '2px solid #fff' : '2px dashed rgba(255,255,255,0.4)',
                  background: textOutlineColor || 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  color: 'rgba(255,255,255,0.6)',
                }}
                title={textOutlineColor ? 'Click to remove outline' : 'Click to enable outline'}
              >
                {!textOutlineColor && '∅'}
              </button>
              {textOutlineColor && (
                <>
                  <input
                    type="color"
                    value={textOutlineColor}
                    onChange={(e) => onTextOutlineColorChange(e.target.value)}
                    style={{
                      width: 24,
                      height: 24,
                      border: 'none',
                      borderRadius: 4,
                      cursor: 'pointer',
                      background: 'transparent',
                    }}
                    title="Choose outline color"
                  />
                  <input
                    type="range"
                    min="1"
                    max="6"
                    value={textOutlineWidth}
                    onChange={(e) => onTextOutlineWidthChange(Number(e.target.value))}
                    style={{
                      width: 50,
                      height: 16,
                      cursor: 'pointer',
                    }}
                    title={`Outline width: ${textOutlineWidth}px`}
                  />
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', minWidth: 20 }}>
                    {textOutlineWidth}px
                  </span>
                </>
              )}
            </div>
          </>
        )}

        {/* Stamp Selector - shown for stamp tool */}
        {selectedTool === 'stamp' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 8 }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap' }}>Stamp:</span>
            {['✓', '✗', '?', '⭐', '❗', '❤️', '👍', '👎'].map((stamp) => (
              <button
                key={stamp}
                type="button"
                onClick={() => onStampChange(stamp)}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 4,
                  border: selectedStamp === stamp ? '2px solid #fff' : '1px solid rgba(255,255,255,0.3)',
                  background: selectedStamp === stamp ? 'rgba(255,255,255,0.2)' : 'transparent',
                  cursor: 'pointer',
                  fontSize: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title={stamp}
              >
                {stamp}
              </button>
            ))}
          </div>
        )}

        {/* Divider */}
        <div className="deixis-divider" role="separator" />

        {/* Edit Actions */}
        <div style={groupStyle} role="group" aria-label="Edit actions">
          <ToolButton
            icon={<UndoIcon />}
            tooltip="Undo"
            shortcut="Ctrl+Z"
            onClick={onUndo}
            disabled={!canUndo}
          />
          <ToolButton
            icon={<RedoIcon />}
            tooltip="Redo"
            shortcut="Ctrl+Shift+Z"
            onClick={onRedo}
            disabled={!canRedo}
          />
          <ToolButton
            icon={<TrashIcon />}
            tooltip="Clear All"
            onClick={onClearAll}
            disabled={!canClear}
          />
          <ToolButton
            icon={<KeyboardIcon />}
            tooltip="Keyboard Shortcuts"
            shortcut="?"
            onClick={onToggleShortcuts}
            isActive={showShortcuts}
          />
        </div>

        {/* Divider */}
        <div className="deixis-divider" role="separator" />

        {/* Action Buttons */}
        <div style={{ ...flexCenter, gap: 8 }} role="group" aria-label="Actions">
          <ToolButton
            icon={<DownloadIcon />}
            tooltip="Save"
            onClick={handleSave}
          />
          {savedFeedback === 'download' && (
            <span style={{ color: '#22C55E', fontSize: 12, fontWeight: 500 }}>Saved</span>
          )}
          <button
            type="button"
            className="deixis-btn deixis-btn-secondary"
            onClick={onCancel}
            aria-label="Cancel"
          >
            <CloseIcon size={16} />
            <span>Cancel</span>
          </button>
          <button
            type="button"
            className="deixis-btn deixis-btn-primary"
            onClick={handleCopy}
            aria-label="Copy to clipboard"
          >
            <CopyIcon size={16} />
            <span>Copy</span>
          </button>
          {savedFeedback === 'copy' && (
            <span style={{ color: '#22C55E', fontSize: 12, fontWeight: 500 }}>Saved</span>
          )}
        </div>
      </div>

    </>
  );
};

export default AnnotationToolbar;
