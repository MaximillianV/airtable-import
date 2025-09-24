/**
 * Card component using design system theme.
 * Provides consistent container styling with shadow, border, and padding.
 * 
 * Used for settings panels, data displays, and content grouping.
 * Supports optional header, footer, and customizable padding.
 */

import React from 'react';
import { theme } from '../../theme';

export interface CardProps {
  /** Card content - any React elements */
  children: React.ReactNode;
  /** Optional header content displayed at top of card */
  header?: React.ReactNode;
  /** Optional footer content displayed at bottom of card */
  footer?: React.ReactNode;
  /** Additional CSS class names for custom styling */
  className?: string;
  /** Inline styles for component customization */
  style?: React.CSSProperties;
  /** Remove default padding for custom layouts */
  noPadding?: boolean;
  /** Card elevation level affects shadow depth */
  elevation?: 'low' | 'medium' | 'high';
  /** Make card clickable with hover effects */
  clickable?: boolean;
  /** Click handler for clickable cards */
  onClick?: () => void;
}

/**
 * Card component with theme-based styling and optional interactive states.
 * Provides consistent container styling across the application.
 */
export const Card: React.FC<CardProps> = ({
  children,
  header,
  footer,
  className = '',
  style = {},
  noPadding = false,
  elevation = 'medium',
  clickable = false,
  onClick,
}) => {
  // Define shadow styles based on elevation level
  const elevationStyles = {
    low: { boxShadow: theme.shadows.sm },
    medium: { boxShadow: theme.shadows.md },
    high: { boxShadow: theme.shadows.lg },
  };
  
  // Build combined styles based on props and theme
  const cardStyles: React.CSSProperties = {
    ...theme.components.card,
    ...elevationStyles[elevation],
    ...(noPadding && { padding: 0 }),
    ...(clickable && {
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    }),
    ...style, // Allow custom style overrides
  };
  
  // Header styles with consistent spacing and typography
  const headerStyles: React.CSSProperties = {
    ...theme.typography.h3,
    marginBottom: noPadding ? 0 : theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    borderBottom: `1px solid ${theme.colors.neutral[200]}`,
    ...(noPadding && {
      padding: theme.spacing.lg,
      paddingBottom: theme.spacing.sm,
      margin: 0,
    }),
  };
  
  // Footer styles with consistent spacing and border
  const footerStyles: React.CSSProperties = {
    marginTop: noPadding ? 0 : theme.spacing.md,
    paddingTop: theme.spacing.sm,
    borderTop: `1px solid ${theme.colors.neutral[200]}`,
    ...(noPadding && {
      padding: theme.spacing.lg,
      paddingTop: theme.spacing.sm,
      margin: 0,
    }),
  };
  
  // Content wrapper styles for proper spacing
  const contentStyles: React.CSSProperties = noPadding 
    ? { padding: theme.spacing.lg }
    : {};
  
  /**
   * Handle card click events for clickable cards.
   */
  const handleClick = () => {
    if (clickable && onClick) {
      onClick();
    }
  };
  
  /**
   * Handle hover effects for clickable cards.
   */
  const handleMouseEnter = (event: React.MouseEvent<HTMLDivElement>) => {
    if (clickable) {
      event.currentTarget.style.transform = 'translateY(-1px)';
      event.currentTarget.style.boxShadow = theme.shadows.lg;
    }
  };
  
  /**
   * Reset hover effects when mouse leaves.
   */
  const handleMouseLeave = (event: React.MouseEvent<HTMLDivElement>) => {
    if (clickable) {
      event.currentTarget.style.transform = 'translateY(0)';
      event.currentTarget.style.boxShadow = elevationStyles[elevation].boxShadow;
    }
  };
  
  return (
    <div
      className={className}
      style={cardStyles}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
    >
      {/* Card header section with optional content */}
      {header && (
        <div style={headerStyles}>
          {header}
        </div>
      )}
      
      {/* Main card content with proper spacing */}
      <div style={contentStyles}>
        {children}
      </div>
      
      {/* Card footer section with optional content */}
      {footer && (
        <div style={footerStyles}>
          {footer}
        </div>
      )}
    </div>
  );
};

export default Card;