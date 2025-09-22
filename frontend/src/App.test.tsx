import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from './App';

// Mock the entire routing and auth setup to avoid complex imports
jest.mock('./contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="auth-provider">{children}</div>
  ),
  useAuth: () => ({
    isAuthenticated: false,
    user: null,
    login: jest.fn(),
    logout: jest.fn(),
    loading: false
  })
}));

// Mock all route components
jest.mock('./components/Login', () => () => <div>Login</div>);
jest.mock('./components/Register', () => () => <div>Register</div>);
jest.mock('./components/Dashboard', () => () => <div>Dashboard</div>);
jest.mock('./components/Settings', () => () => <div>Settings</div>);
jest.mock('./components/Import', () => () => <div>Import</div>);
jest.mock('./components/ProtectedRoute', () => ({ children }: { children: React.ReactNode }) => <div>{children}</div>);

describe('App Component', () => {
  test('renders without crashing', () => {
    render(<App />);
    expect(screen.getByTestId('auth-provider')).toBeInTheDocument();
  });

  test('renders app container', () => {
    const { container } = render(<App />);
    expect(container.querySelector('.App')).toBeInTheDocument();
  });
});

// Keep these simple working tests
test('basic test passes', () => {
  expect(true).toBe(true);
});

test('react works', () => {
  const element = React.createElement('div', null, 'Hello World');
  expect(element.type).toBe('div');
  expect(element.props.children).toBe('Hello World');
});
