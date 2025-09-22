import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProtectedRoute from './ProtectedRoute';
import { AuthContext } from '../contexts/AuthContext';
import { User } from '../types';

// Mock react-router-dom Navigate component
jest.mock('react-router-dom', () => ({
  Navigate: ({ to }: { to: string }) => <div data-testid="navigate">Redirecting to {to}</div>
}));

/**
 * Mock AuthProvider component for testing ProtectedRoute functionality.
 * Provides controlled authentication state for different test scenarios.
 */
interface MockAuthProviderProps {
  children: React.ReactNode;
  user: User | null;
  loading: boolean;
}

const MockAuthProvider: React.FC<MockAuthProviderProps> = ({ children, user, loading }) => {
  const mockAuthValue = {
    user,
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
    loading,
  };

  return (
    <AuthContext.Provider value={mockAuthValue}>
      {children}
    </AuthContext.Provider>
  );
};

describe('ProtectedRoute Component', () => {
  test('renders children when user is authenticated', () => {
    // Mock authenticated state with a valid user
    const mockUser: User = { id: 1, email: 'test@example.com' };
    
    render(
      <MockAuthProvider user={mockUser} loading={false}>
        <ProtectedRoute>
          <div data-testid="protected-content">Protected Content</div>
        </ProtectedRoute>
      </MockAuthProvider>
    );
    
    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });

  test('shows loading state when auth is loading', () => {
    // Mock loading state with no user
    render(
      <MockAuthProvider user={null} loading={true}>
        <ProtectedRoute>
          <div data-testid="protected-content">Protected Content</div>
        </ProtectedRoute>
      </MockAuthProvider>
    );
    
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  test('redirects to login when user is not authenticated', () => {
    // Mock unauthenticated state (no user, not loading)
    render(
      <MockAuthProvider user={null} loading={false}>
        <ProtectedRoute>
          <div data-testid="protected-content">Protected Content</div>
        </ProtectedRoute>
      </MockAuthProvider>
    );
    
    expect(screen.getByTestId('navigate')).toBeInTheDocument();
    expect(screen.getByText('Redirecting to /login')).toBeInTheDocument();
  });
});