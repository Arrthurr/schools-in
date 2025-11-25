
import { render, screen, waitFor } from '@testing-library/react';
import { ProtectedRoute } from './ProtectedRoute';
import { useCachedAuth } from '@/lib/hooks/useCachedAuth';
import { useRouter } from 'next/navigation';

// Mocks
jest.mock('@/lib/hooks/useCachedAuth', () => ({
  useCachedAuth: jest.fn(),
}));
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

// Mock firebase.config to avoid import errors
jest.mock('../../../firebase.config', () => ({
  auth: {
    currentUser: null,
  },
}));

describe('ProtectedRoute', () => {
  const mockRouter = { push: jest.fn() };
  (useRouter as jest.Mock).mockReturnValue(mockRouter);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('displays loading state', () => {
    (useCachedAuth as jest.Mock).mockReturnValue({ user: null, loading: true });
    render(<ProtectedRoute roles={['admin']}><div>Protected Content</div></ProtectedRoute>);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('redirects unauthenticated users', async () => {
    (useCachedAuth as jest.Mock).mockReturnValue({ user: null, loading: false });
    render(<ProtectedRoute roles={['admin']}><div>Protected Content</div></ProtectedRoute>);

    // The component might initially show "Verifying authentication..." or "Loading..."
    // We need to wait for the redirect
    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith('/');
    });
  });

  it('redirects unauthorized users', async () => {
    (useCachedAuth as jest.Mock).mockReturnValue({ user: { role: 'provider' }, loading: false });
    render(<ProtectedRoute roles={['admin']}><div>Protected Content</div></ProtectedRoute>);

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('renders content for authorized users', () => {
    (useCachedAuth as jest.Mock).mockReturnValue({ user: { role: 'admin' }, loading: false });
    render(<ProtectedRoute roles={['admin']}><div>Protected Content</div></ProtectedRoute>);
    expect(screen.getByText(/protected content/i)).toBeInTheDocument();
  });
});
