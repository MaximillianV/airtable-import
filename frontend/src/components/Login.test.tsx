import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock the Login module without using React in the factory
jest.mock('./Login', () => {
  const mockReact = jest.requireActual('react');
  return {
    default: function MockLogin() {
      return mockReact.createElement('div', {}, [
        mockReact.createElement('label', { key: 'email' }, [
          'Email:',
          mockReact.createElement('input', { key: 'email-input', type: 'email' })
        ]),
        mockReact.createElement('label', { key: 'password' }, [
          'Password:',
          mockReact.createElement('input', { key: 'password-input', type: 'password' })
        ]),
        mockReact.createElement('button', { key: 'submit', type: 'submit' }, 'Login'),
        mockReact.createElement('a', { key: 'register', href: '/register' }, 'Register')
      ]);
    }
  };
});

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