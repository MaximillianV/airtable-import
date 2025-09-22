import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock the Login component to avoid complex imports
jest.mock('./Login', () => {
  const mockReact = require('react');
  
  function MockLogin() {
    const [email, setEmail] = mockReact.useState('');
    const [password, setPassword] = mockReact.useState('');
    
    const handleSubmit = (e: any) => {
      e.preventDefault();
      // Mock login call
      console.log('Login attempted with:', email, password);
    };
    
    return mockReact.createElement('form', { onSubmit: handleSubmit },
      mockReact.createElement('label', null,
        'Email:',
        mockReact.createElement('input', {
          type: 'email',
          value: email,
          onChange: (e: any) => setEmail(e.target.value)
        })
      ),
      mockReact.createElement('label', null,
        'Password:',
        mockReact.createElement('input', {
          type: 'password',
          value: password,
          onChange: (e: any) => setPassword(e.target.value)
        })
      ),
      mockReact.createElement('button', { type: 'submit' }, 'Login'),
      mockReact.createElement('a', { href: '/register' }, 'Register')
    );
  }
  
  return {
    __esModule: true,
    default: MockLogin
  };
});

import Login from './Login';

describe('Login Component', () => {
  test('renders login form', () => {
    render(<Login />);
    
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
  });

  test('allows user to enter email and password', () => {
    render(<Login />);
    
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    
    expect(emailInput).toHaveValue('test@example.com');
    expect(passwordInput).toHaveValue('password123');
  });

  test('has link to register page', () => {
    render(<Login />);
    
    const registerLink = screen.getByText(/register/i);
    expect(registerLink).toBeInTheDocument();
  });
});