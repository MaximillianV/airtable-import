import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProtectedRoute from './ProtectedRoute';

// Mock react-router-dom Navigate component
jest.mock('react-router-dom', () => ({
  Navigate: ({ to }: { to: string }) => <div data-testid="navigate">Redirecting to {to}</div>
}));

describe('ProtectedRoute Component', () => {
  test('renders children when user is authenticated', () => {
    // Mock authenticated state
    jest.doMock('../contexts/AuthContext', () => ({
      useAuth: () => ({
        isAuthenticated: true,
        user: { id: '1', email: 'test@example.com' },
        login: jest.fn(),
        logout: jest.fn(),
        loading: false
      })
    }));

    render(
      <ProtectedRoute>
        <div data-testid="protected-content">Protected Content</div>
      </ProtectedRoute>
    );
    
    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });

  test('shows loading state when auth is loading', () => {
    // Mock loading state
    jest.doMock('../contexts/AuthContext', () => ({
      useAuth: () => ({
        isAuthenticated: false,
        user: null,
        login: jest.fn(),
        logout: jest.fn(),
        loading: true
      })
    }));

    render(
      <ProtectedRoute>
        <div data-testid="protected-content">Protected Content</div>
      </ProtectedRoute>
    );
    
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });
});