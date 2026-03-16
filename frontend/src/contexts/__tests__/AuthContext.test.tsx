import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AuthProvider, useAuth } from '../AuthContext';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Test component
function TestComponent() {
  const { isAuthenticated, user, login, logout, hasPermission } = useAuth();

  return (
    <div>
      <div data-testid="auth-status">{isAuthenticated ? 'Authenticated' : 'Not Authenticated'}</div>
      <div data-testid="user-email">{user?.email || 'No User'}</div>
      <div data-testid="user-role">{user?.role || 'No Role'}</div>
      <button onClick={() => login('test@example.com', 'password')}>Login</button>
      <button onClick={() => logout()}>Logout</button>
      <div data-testid="has-permission">{hasPermission('view:dashboard') ? 'Has Permission' : 'No Permission'}</div>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('should initialize with unauthenticated state', () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    const authStatus = screen.getByTestId('auth-status');
    const userEmail = screen.getByTestId('user-email');
    
    expect(authStatus.textContent).toBe('Not Authenticated');
    expect(userEmail.textContent).toBe('No User');
  });

  it('should login successfully with valid credentials', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    const loginButton = screen.getByText('Login');
    fireEvent.click(loginButton);

    await waitFor(() => {
      const authStatus = screen.getByTestId('auth-status');
      expect(authStatus.textContent).toBe('Authenticated');
    });
  });

  it('should logout successfully', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    const loginButton = screen.getByText('Login');
    fireEvent.click(loginButton);

    await waitFor(() => {
      const authStatus = screen.getByTestId('auth-status');
      expect(authStatus.textContent).toBe('Authenticated');
    });

    const logoutButton = screen.getByText('Logout');
    fireEvent.click(logoutButton);

    await waitFor(() => {
      const authStatus = screen.getByTestId('auth-status');
      expect(authStatus.textContent).toBe('Not Authenticated');
    });
  });

  it('should check permissions correctly', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    const loginButton = screen.getByText('Login');
    fireEvent.click(loginButton);

    await waitFor(() => {
      const permission = screen.getByTestId('has-permission');
      expect(permission.textContent).toBe('Has Permission');
    });
  });

  it('should persist auth state in localStorage', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    const loginButton = screen.getByText('Login');
    fireEvent.click(loginButton);

    await waitFor(() => {
      const stored = localStorage.getItem('auth_token');
      expect(stored).toBeTruthy();
    });
  });

  it('should restore auth state from localStorage on mount', () => {
    const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJyb2xlIjoic3VwZXJfYWRtaW4ifQ.test';
    localStorage.setItem('auth_token', mockToken);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    const authStatus = screen.getByTestId('auth-status');
    expect(authStatus.textContent).toBe('Authenticated');
  });
});
