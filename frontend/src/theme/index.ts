/**
 * Design system theme object for consistent styling across the application.
 * All components should use this theme instead of hardcoded values.
 * 
 * Based on modern admin dashboard design principles with professional color palette,
 * consistent spacing system, and reusable component styles.
 */

export interface Theme {
  colors: {
    primary: {
      50: string;
      100: string;
      500: string;
      600: string;
      700: string;
    };
    semantic: {
      success: string;
      warning: string;
      error: string;
      info: string;
    };
    neutral: {
      50: string;
      100: string;
      200: string;
      400: string;
      600: string;
      900: string;
      white: string;
    };
  };
  typography: {
    fontFamily: string;
    h1: React.CSSProperties;
    h2: React.CSSProperties;
    h3: React.CSSProperties;
    bodyLarge: React.CSSProperties;
    body: React.CSSProperties;
    small: React.CSSProperties;
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    '2xl': string;
    '3xl': string;
  };
  borderRadius: {
    sm: string;
    md: string;
    lg: string;
  };
  shadows: {
    sm: string;
    md: string;
    lg: string;
  };
  components: {
    button: {
      base: React.CSSProperties;
      primary: React.CSSProperties;
      primaryHover: React.CSSProperties;
      secondary: React.CSSProperties;
      secondaryHover: React.CSSProperties;
      danger: React.CSSProperties;
      dangerHover: React.CSSProperties;
      disabled: React.CSSProperties;
    };
    card: React.CSSProperties;
    input: {
      base: React.CSSProperties;
      focused: React.CSSProperties;
      disabled: React.CSSProperties;
    };
    table: {
      header: React.CSSProperties;
      cell: React.CSSProperties;
      row: React.CSSProperties;
      rowHover: React.CSSProperties;
    };
  };
  layout: {
    sidebar: {
      width: string;
      background: React.CSSProperties;
      nav: React.CSSProperties;
      navItem: React.CSSProperties;
      navItemActive: React.CSSProperties;
    };
    page: {
      container: React.CSSProperties;
      header: React.CSSProperties;
      content: React.CSSProperties;
    };
  };
}

/**
 * Main theme configuration object.
 * Provides consistent design tokens for colors, typography, spacing, and component styles.
 */
export const theme: Theme = {
  colors: {
    primary: {
      50: '#eff6ff',
      100: '#dbeafe', 
      500: '#3b82f6',
      600: '#2563eb',
      700: '#1d4ed8',
    },
    semantic: {
      success: '#059669',
      warning: '#d97706', 
      error: '#dc2626',
      info: '#0891b2',
    },
    neutral: {
      50: '#f9fafb',
      100: '#f3f4f6',
      200: '#e5e7eb',
      400: '#9ca3af',
      600: '#4b5563',
      900: '#111827',
      white: '#ffffff',
    },
  },
  typography: {
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    h1: {
      fontSize: '24px',
      fontWeight: 600,
      lineHeight: 1.2,
      color: '#111827',
      margin: 0,
    },
    h2: {
      fontSize: '20px',
      fontWeight: 600,
      lineHeight: 1.3,
      color: '#111827',
      margin: 0,
    },
    h3: {
      fontSize: '18px',
      fontWeight: 500,
      lineHeight: 1.4,
      color: '#111827',
      margin: 0,
    },
    bodyLarge: {
      fontSize: '16px',
      fontWeight: 400,
      lineHeight: 1.5,
      color: '#111827',
    },
    body: {
      fontSize: '14px',
      fontWeight: 400,
      lineHeight: 1.5,
      color: '#111827',
    },
    small: {
      fontSize: '12px',
      fontWeight: 400,
      lineHeight: 1.4,
      color: '#4b5563',
    },
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    '2xl': '48px',
    '3xl': '64px',
  },
  borderRadius: {
    sm: '4px',
    md: '6px',
    lg: '8px',
  },
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    lg: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  },
  components: {
    button: {
      base: {
        fontFamily: "'Inter', system-ui, sans-serif",
        fontSize: '14px',
        fontWeight: 500,
        padding: '12px 24px',
        borderRadius: '6px',
        border: 'none',
        cursor: 'pointer',
        transition: 'all 0.2s ease-in-out',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        textDecoration: 'none',
      } as React.CSSProperties,
      primary: {
        backgroundColor: '#2563eb',
        color: '#ffffff',
      } as React.CSSProperties,
      primaryHover: {
        backgroundColor: '#1d4ed8',
      } as React.CSSProperties,
      secondary: {
        backgroundColor: '#ffffff',
        color: '#4b5563',
        border: '1px solid #e5e7eb',
      } as React.CSSProperties,
      secondaryHover: {
        backgroundColor: '#f9fafb',
        borderColor: '#d1d5db',
      } as React.CSSProperties,
      danger: {
        backgroundColor: '#dc2626',
        color: '#ffffff',
      } as React.CSSProperties,
      dangerHover: {
        backgroundColor: '#b91c1c',
      } as React.CSSProperties,
      disabled: {
        backgroundColor: '#9ca3af',
        color: '#6b7280',
        cursor: 'not-allowed',
      } as React.CSSProperties,
    },
    card: {
      backgroundColor: '#ffffff',
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
      padding: '24px',
    },
    input: {
      base: {
        fontFamily: "'Inter', system-ui, sans-serif",
        fontSize: '14px',
        padding: '12px',
        border: '1px solid #e5e7eb',
        borderRadius: '6px',
        backgroundColor: '#ffffff',
        transition: 'border-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
        width: '100%',
        outline: 'none',
      },
      focused: {
        borderColor: '#2563eb',
        boxShadow: '0 0 0 3px rgba(37, 99, 235, 0.1)',
      },
      disabled: {
        backgroundColor: '#f9fafb',
        color: '#9ca3af',
        cursor: 'not-allowed',
      },
    },
    table: {
      header: {
        backgroundColor: '#f9fafb',
        borderBottom: '1px solid #e5e7eb',
        padding: '12px',
        textAlign: 'left' as const,
        fontWeight: 500,
        fontSize: '12px',
        color: '#4b5563',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.025em',
      },
      cell: {
        padding: '12px',
        borderBottom: '1px solid #f3f4f6',
        fontSize: '14px',
        color: '#111827',
      },
      row: {
        transition: 'background-color 0.2s ease-in-out',
      },
      rowHover: {
        backgroundColor: '#f9fafb',
      },
    },
  },
  layout: {
    sidebar: {
      width: '240px',
      background: {
        backgroundColor: '#ffffff',
        borderRight: '1px solid #e5e7eb',
        height: '100vh',
        position: 'fixed' as const,
        left: 0,
        top: 0,
        zIndex: 10,
      },
      nav: {
        padding: '24px 0',
      },
      navItem: {
        display: 'block',
        padding: '12px 24px',
        color: '#4b5563',
        textDecoration: 'none',
        fontSize: '14px',
        fontWeight: 500,
        transition: 'all 0.2s ease-in-out',
        borderLeft: '3px solid transparent',
      },
      navItemActive: {
        backgroundColor: '#eff6ff',
        color: '#2563eb',
        borderLeftColor: '#2563eb',
      },
    },
    page: {
      container: {
        marginLeft: '240px',
        minHeight: '100vh',
        backgroundColor: '#f9fafb',
      },
      header: {
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e5e7eb',
        padding: '24px 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      },
      content: {
        padding: '32px',
        maxWidth: '1200px',
      },
    },
  },
};

/**
 * Utility function to merge theme styles with custom overrides.
 * Useful for extending base component styles while maintaining theme consistency.
 * 
 * @param baseStyles - Base styles from theme
 * @param overrides - Custom style overrides
 * @returns Merged style object
 */
export const mergeStyles = (
  baseStyles: React.CSSProperties,
  overrides: React.CSSProperties = {}
): React.CSSProperties => ({
  ...baseStyles,
  ...overrides,
});

/**
 * Utility function to get responsive spacing based on screen size.
 * Use for consistent spacing that adapts to different viewport sizes.
 * 
 * @param mobile - Spacing key for mobile
 * @param desktop - Spacing key for desktop  
 * @returns CSS media query with responsive spacing
 */
export const getResponsiveSpacing = (mobile: keyof Theme['spacing'], desktop: keyof Theme['spacing']) => ({
  padding: theme.spacing[mobile],
  '@media (min-width: 768px)': {
    padding: theme.spacing[desktop],
  },
});

export default theme;