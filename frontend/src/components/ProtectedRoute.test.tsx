import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProtectedRoute from './ProtectedRoute';

// Mock the AuthContext
const mockUseAuth = {
  isAuthenticated: true,
  user: { id: '1', email: 'test@example.com' },
  login: jest.fn(),
  logout: jest.fn(),
  loading: false
};

jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth
}));

// Mock react-router-dom Navigate component
jest.mock('react-router-dom', () => ({
  Navigate: ({ to }: { to: string }) => <div data-testid="navigate">Redirecting to {to}</div>
}));

describe('ProtectedRoute Component', () => {
  test('renders children when user is authenticated', () => {
    render(
      <ProtectedRoute>
        <div data-testid="protected-content">Protected Content</div>
      </ProtectedRoute>
    );
    
    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    expect(screen.queryByTestId('navigate')).not.toBeInTheDocument();
  });

  test('redirects to login when user is not authenticated', () => {
    // Temporarily override the mock for this test
    const originalUseAuth = mockUseAuth;
    (mockUseAuth as any).isAuthenticated = false;
    
    render(
      <ProtectedRoute>
        <div data-testid="protected-content">Protected Content</div>
      </ProtectedRoute>
    );
    
    expect(screen.getByTestId('navigate')).toBeInTheDocument();
    expect(screen.getByText('Redirecting to /login')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    
    // Restore original mock
    (mockUseAuth as any).isAuthenticated = originalUseAuth.isAuthenticated;
  });

  test('shows loading state when auth is loading', () => {
    // Temporarily override the mock for this test
    const originalLoading = mockUseAuth.loading;
    (mockUseAuth as any).loading = true;
    
    render(
      <ProtectedRoute>
        <div data-testid="protected-content">Protected Content</div>
      </ProtectedRoute>
    );
    
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    
    // Restore original mock
    (mockUseAuth as any).loading = originalLoading;
  });
});