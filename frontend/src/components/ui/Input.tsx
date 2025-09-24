/**
 * Input component using design system theme.
 * Provides consistent form input styling with focus states and validation.
 * 
 * Supports various input types, validation states, and accessibility features.
 * Includes label, help text, and error message support.
 */

import React, { useState } from 'react';
import { theme } from '../../theme';

export interface InputProps {
  /** Input field label text */
  label?: string;
  /** Input field placeholder text */
  placeholder?: string;
  /** Input field value (controlled component) */
  value?: string;
  /** Default value for uncontrolled component */
  defaultValue?: string;
  /** Input type (text, email, password, etc.) */
  type?: 'text' | 'email' | 'password' | 'url' | 'number' | 'tel';
  /** Field name for form submission */
  name?: string;
  /** Field ID for label association */
  id?: string;
  /** Required field indicator */
  required?: boolean;
  /** Disabled state prevents user interaction */
  disabled?: boolean;
  /** Readonly state allows viewing but not editing */
  readOnly?: boolean;
  /** Help text displayed below input */
  helpText?: string;
  /** Error message displayed when validation fails */
  error?: string;
  /** Success state shows positive validation */
  success?: boolean;
  /** Full width input fills container */
  fullWidth?: boolean;
  /** Input size variant */
  size?: 'small' | 'medium' | 'large';
  /** Change handler for controlled component */
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  /** Focus handler for interaction tracking */
  onFocus?: (event: React.FocusEvent<HTMLInputElement>) => void;
  /** Blur handler for validation triggers */
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
  /** Additional CSS class names */
  className?: string;
  /** Inline styles for customization */
  style?: React.CSSProperties;
}

/**
 * Input component with theme-based styling and validation states.
 * Automatically handles focus effects, validation styling, and accessibility.
 */
export const Input: React.FC<InputProps> = ({
  label,
  placeholder,
  value,
  defaultValue,
  type = 'text',
  name,
  id,
  required = false,
  disabled = false,
  readOnly = false,
  helpText,
  error,
  success = false,
  fullWidth = false,
  size = 'medium',
  onChange,
  onFocus,
  onBlur,
  className = '',
  style = {},
}) => {
  // Track focus state for applying focus styles
  const [isFocused, setIsFocused] = useState(false);
  
  // Generate unique ID if not provided
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
  
  // Calculate size-specific padding and font size
  const sizeStyles = {
    small: { padding: '8px 12px', fontSize: '13px' },
    medium: { padding: '12px 16px', fontSize: '14px' },
    large: { padding: '16px 20px', fontSize: '16px' },
  };
  
  // Determine validation state styling
  const getValidationStyles = () => {
    if (error) {
      return {
        borderColor: theme.colors.semantic.error,
        boxShadow: `0 0 0 3px ${theme.colors.semantic.error}20`,
      };
    }
    if (success) {
      return {
        borderColor: theme.colors.semantic.success,
        boxShadow: `0 0 0 3px ${theme.colors.semantic.success}20`,
      };
    }
    return {};
  };
  
  // Build input styles based on state and props
  const inputStyles: React.CSSProperties = {
    ...theme.components.input.base,
    ...sizeStyles[size],
    ...(isFocused && theme.components.input.focused),
    ...(disabled && theme.components.input.disabled),
    ...getValidationStyles(),
    ...(fullWidth && { width: '100%' }),
    ...style, // Allow custom style overrides
  };
  
  // Label styles with consistent typography
  const labelStyles: React.CSSProperties = {
    ...theme.typography.small,
    fontWeight: 600,
    color: theme.colors.neutral[900],
    display: 'block',
    marginBottom: theme.spacing.xs,
  };
  
  // Help text styles
  const helpTextStyles: React.CSSProperties = {
    ...theme.typography.small,
    color: theme.colors.neutral[600],
    marginTop: theme.spacing.xs,
  };
  
  // Error message styles
  const errorStyles: React.CSSProperties = {
    ...theme.typography.small,
    color: theme.colors.semantic.error,
    marginTop: theme.spacing.xs,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
  };
  
  // Container styles for full width support
  const containerStyles: React.CSSProperties = {
    ...(fullWidth && { width: '100%' }),
  };
  
  /**
   * Handle focus events and update state.
   */
  const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    onFocus?.(event);
  };
  
  /**
   * Handle blur events and update state.
   */
  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    onBlur?.(event);
  };
  
  return (
    <div style={containerStyles} className={className}>
      {/* Input field label with required indicator */}
      {label && (
        <label htmlFor={inputId} style={labelStyles}>
          {label}
          {required && (
            <span style={{ color: theme.colors.semantic.error, marginLeft: '4px' }}>
              *
            </span>
          )}
        </label>
      )}
      
      {/* Main input field with all interaction handlers */}
      <input
        id={inputId}
        name={name}
        type={type}
        value={value}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        readOnly={readOnly}
        onChange={onChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        style={inputStyles}
        aria-invalid={!!error}
        aria-describedby={
          error ? `${inputId}-error` : helpText ? `${inputId}-help` : undefined
        }
      />
      
      {/* Help text for additional context */}
      {helpText && !error && (
        <div id={`${inputId}-help`} style={helpTextStyles}>
          {helpText}
        </div>
      )}
      
      {/* Error message with icon */}
      {error && (
        <div id={`${inputId}-error`} style={errorStyles} role="alert">
          <span style={{ fontSize: '16px' }}>⚠️</span>
          {error}
        </div>
      )}
    </div>
  );
};

export default Input;