/**
 * Button component using design system theme.
 * Provides consistent styling across all button variants with hover/active states.
 * 
 * Supports primary, secondary, and danger variants with automatic hover effects.
 * Handles disabled state and loading state with proper accessibility.
 */

import React, { useState } from 'react';
import { theme } from '../../theme';

export interface ButtonProps {
  /** Button content - text, icons, or JSX elements */
  children: React.ReactNode;
  /** Button style variant that determines appearance */
  variant?: 'primary' | 'secondary' | 'danger';
  /** Button type for form submission behavior */
  type?: 'button' | 'submit' | 'reset';
  /** Disabled state prevents user interaction */
  disabled?: boolean;
  /** Loading state shows spinner and prevents interaction */
  loading?: boolean;
  /** Click handler function */
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  /** Additional CSS class names for custom styling */
  className?: string;
  /** Inline styles for component customization */
  style?: React.CSSProperties;
  /** Full width button fills container */
  fullWidth?: boolean;
  /** Button size variant */
  size?: 'small' | 'medium' | 'large';
}

/**
 * LoadingSpinner component for button loading states.
 * Simple animated spinner that scales with button size.
 */
const LoadingSpinner: React.FC<{ size?: string }> = ({ size = '16px' }) => (
  <div
    style={{
      width: size,
      height: size,
      border: '2px solid currentColor',
      borderTop: '2px solid transparent',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite',
    }}
  />
);

/**
 * Button component with theme-based styling and interactive states.
 * Automatically handles hover effects, disabled states, and loading indicators.
 */
export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  type = 'button',
  disabled = false,
  loading = false,
  onClick,
  className = '',
  style = {},
  fullWidth = false,
  size = 'medium',
}) => {
  // Track hover state for applying hover styles
  const [isHovered, setIsHovered] = useState(false);
  
  // Calculate size-specific padding and font size
  const sizeStyles = {
    small: { padding: '8px 16px', fontSize: '13px' },
    medium: { padding: '12px 24px', fontSize: '14px' },
    large: { padding: '16px 32px', fontSize: '16px' },
  };
  
  // Determine if button is in disabled state (disabled prop or loading)
  const isDisabled = disabled || loading;
  
  // Build combined styles based on variant, state, and props
  const buttonStyles: React.CSSProperties = {
    ...theme.components.button.base,
    ...sizeStyles[size],
    ...(variant === 'primary' && theme.components.button.primary),
    ...(variant === 'secondary' && theme.components.button.secondary),
    ...(variant === 'danger' && theme.components.button.danger),
    ...(isHovered && !isDisabled && variant === 'primary' && theme.components.button.primaryHover),
    ...(isHovered && !isDisabled && variant === 'secondary' && theme.components.button.secondaryHover),
    ...(isHovered && !isDisabled && variant === 'danger' && theme.components.button.dangerHover),
    ...(isDisabled && theme.components.button.disabled),
    ...(fullWidth && { width: '100%' }),
    ...style, // Allow custom style overrides
  };
  
  /**
   * Handle button click events.
   * Prevents click when disabled or loading.
   */
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (isDisabled) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };
  
  return (
    <>
      {/* Add keyframe animation for loading spinner */}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
      
      <button
        type={type}
        disabled={isDisabled}
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={className}
        style={buttonStyles}
        aria-disabled={isDisabled}
        aria-busy={loading}
      >
        {loading && <LoadingSpinner />}
        {loading ? 'Loading...' : children}
      </button>
    </>
  );
};

export default Button;