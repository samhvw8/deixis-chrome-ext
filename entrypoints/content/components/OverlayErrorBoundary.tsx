import React from 'react';
import { createLogger } from '@/src/core/logger';

const logger = createLogger();

export interface OverlayErrorBoundaryProps {
  /** Called when the overlay crashes, so the host can tear it down. */
  onError: () => void;
  children?: React.ReactNode;
}

interface OverlayErrorBoundaryState {
  hasError: boolean;
}

/**
 * The annotation overlay covers the whole viewport at the maximum z-index. An
 * uncaught render error would unmount its contents but leave that opaque layer
 * in place, trapping the user behind a black screen with no way out. Catch the
 * error and close the overlay instead.
 */
export class OverlayErrorBoundary extends React.Component<
  OverlayErrorBoundaryProps,
  OverlayErrorBoundaryState
> {
  state: OverlayErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): OverlayErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logger.error('Annotation overlay crashed:', error, info.componentStack);
    this.props.onError();
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

export default OverlayErrorBoundary;
