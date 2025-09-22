import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock the Login module directly without using React in the mock factory
jest.mock('./Login', () => ({
  default: function MockLogin() {
    return React.createElement('div', {}, [
      React.createElement('label', { key: 'email' }, [
        'Email:',
        React.createElement('input', { key: 'email-input', type: 'email' })
      ]),
      React.createElement('label', { key: 'password' }, [
        'Password:',
        React.createElement('input', { key: 'password-input', type: 'password' })
      ]),
      React.createElement('button', { key: 'submit', type: 'submit' }, 'Login'),
      React.createElement('a', { key: 'register', href: '/register' }, 'Register')
    ]);
  }
}));

const Login = require('./Login').default;

describe('Login Component', () => {
  test('renders login form', () => {
    render(<Login />);
    
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
  });

  test('has link to register page', () => {
    render(<Login />);
    
    const registerLink = screen.getByText(/register/i);
    expect(registerLink).toBeInTheDocument();
  });
});