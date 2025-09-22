import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProtectedRoute from './ProtectedRoute';

// Mock the AuthContext
jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: { id: '1', email: 'test@example.com' },
    login: jest.fn(),
    logout: jest.fn(),
    loading: false
  })
}));

// Mock react-router-dom Navigate component
jest.mock('react-router-dom', () => ({
  Navigate: ({ to }: { to: string }) => {
    const mockReact = require('react');
    return mockReact.createElement('div', 
      { 'data-testid': 'navigate' }, 
      `Redirecting to ${to}`
    );
  }
}));

describe('ProtectedRoute Component', () => {
  test('renders children when user is authenticated', () => {
    render(
      <ProtectedRoute>
        <div data-testid="protected-content">Protected Content</div>
      </ProtectedRoute>
    );
    
    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });
  
  test('component renders without crashing', () => {
    const { container } = render(
      <ProtectedRoute>
        <div>Test content</div>
      </ProtectedRoute>
    );
    
    expect(container).toBeInTheDocument();
  });
});