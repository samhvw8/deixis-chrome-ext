import React, { useEffect, useState, useCallback } from 'react';
import { CheckIcon, CloseIcon } from '../icons';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastProps {
  /** Toast message to display */
  message: string;
  /** Type of toast (affects styling) */
  type?: ToastType;
  /** Duration in milliseconds before auto-dismiss (0 = no auto-dismiss) */
  duration?: number;
  /** Callback when toast is dismissed */
  onDismiss?: () => void;
  /** Whether the toast is visible */
  visible?: boolean;
  /** Show dismiss button */
  showDismissButton?: boolean;
}

/**
 * Toast - A notification toast that appears at bottom-center.
 *
 * Design specs:
 * - Fixed position at bottom-center
 * - Slide up + fade in animation
 * - Auto-dismiss after duration (default 3s)
 * - Optional success/error styling
 */
export const Toast: React.FC<ToastProps> = ({
  message,
  type = 'info',
  duration = 3000,
  onDismiss,
  visible = true,
  showDismissButton = false,
}) => {
  const [isExiting, setIsExiting] = useState(false);
  const [isVisible, setIsVisible] = useState(visible);

  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    // Wait for exit animation before calling onDismiss
    setTimeout(() => {
      setIsVisible(false);
      onDismiss?.();
    }, 150);
  }, [onDismiss]);

  // Auto-dismiss timer
  useEffect(() => {
    if (duration > 0 && visible) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration, visible, handleDismiss]);

  // Reset state when visible prop changes
  useEffect(() => {
    if (visible) {
      setIsExiting(false);
      setIsVisible(true);
    }
  }, [visible]);

  if (!isVisible) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return (
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-green-500/20">
            <CheckIcon size={14} className="text-green-500" />
          </span>
        );
      case 'error':
        return (
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-red-500/20">
            <CloseIcon size={14} className="text-red-500" />
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className={`deixis-toast ${isExiting ? 'animate-toast-out' : 'animate-toast-in'}`}
      data-success={type === 'success'}
      data-error={type === 'error'}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-center gap-2">
        {getIcon()}
        <span>{message}</span>
        {showDismissButton && (
          <button
            type="button"
            className="ml-2 p-1 rounded hover:bg-white/10 transition-colors"
            onClick={handleDismiss}
            aria-label="Dismiss"
          >
            <CloseIcon size={14} />
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * Hook for managing toast state
 */
export interface UseToastReturn {
  toastProps: Omit<ToastProps, 'message'> & { message: string };
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  hideToast: () => void;
}

export const useToast = (): UseToastReturn => {
  const [toastState, setToastState] = useState<{
    message: string;
    type: ToastType;
    visible: boolean;
    duration: number;
  }>({
    message: '',
    type: 'info',
    visible: false,
    duration: 3000,
  });

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', duration: number = 3000) => {
      setToastState({
        message,
        type,
        visible: true,
        duration,
      });
    },
    []
  );

  const hideToast = useCallback(() => {
    setToastState((prev) => ({ ...prev, visible: false }));
  }, []);

  return {
    toastProps: {
      ...toastState,
      onDismiss: hideToast,
    },
    showToast,
    hideToast,
  };
};

export default Toast;
