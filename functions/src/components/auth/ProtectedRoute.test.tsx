
import { render, screen } from '@testing-library/react';
import { ProtectedRoute } from './ProtectedRoute';
import { useAuth } from '@/lib/hooks/useAuth';
import { useRouter } from 'next/navigation';

// Mocks
jest.mock('@/lib/hooks/useAuth', () => ({
  useAuth: jest.fn(),
}));
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

describe('ProtectedRoute', () => {
  const mockRouter = { push: jest.fn() };
  (useRouter as jest.Mock).mockReturnValue(mockRouter);

  it('displays loading state', () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null, loading: true });
    render(<ProtectedRoute roles={['admin']}><div>Protected Content</div></ProtectedRoute>);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('redirects unauthenticated users', () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null, loading: false });
    render(<ProtectedRoute roles={['admin']}><div>Protected Content</div></ProtectedRoute>);
    expect(mockRouter.push).toHaveBeenCalledWith('/');
  });

  it('redirects unauthorized users', () => {
    (useAuth as jest.Mock).mockReturnValue({ user: { role: 'provider' }, loading: false });
    render(<ProtectedRoute roles={['admin']}><div>Protected Content</div></ProtectedRoute>);
    expect(mockRouter.push).toHaveBeenCalledWith('/dashboard');
  });

  it('renders content for authorized users', () => {
    (useAuth as jest.Mock).mockReturnValue({ user: { role: 'admin' }, loading: false });
    render(<ProtectedRoute roles={['admin']}><div>Protected Content</div></ProtectedRoute>);
    expect(screen.getByText(/protected content/i)).toBeInTheDocument();
  });
});
