import React from 'react';
import { render } from '@testing-library/react';
import LoginPage from '../page';

jest.mock('@/components/auth/LoginForm', () => ({
  LoginForm: () => <div>LoginForm</div>,
}));

describe('Login Page', () => {
  it('renders without crashing', () => {
    render(<LoginPage />);
  });
});
