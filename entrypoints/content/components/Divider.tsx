import React from 'react';

export interface DividerProps {
  /** Orientation of the divider */
  orientation?: 'vertical' | 'horizontal';
  /** Custom className */
  className?: string;
}

/**
 * Divider - A visual separator for toolbar sections.
 */
export const Divider: React.FC<DividerProps> = ({
  orientation = 'vertical',
  className = '',
}) => {
  if (orientation === 'horizontal') {
    return (
      <div
        className={`w-full h-px bg-border-subtle my-2 ${className}`.trim()}
        role="separator"
        aria-orientation="horizontal"
      />
    );
  }

  return (
    <div
      className={`deixis-divider ${className}`.trim()}
      role="separator"
      aria-orientation="vertical"
    />
  );
};

export default Divider;
