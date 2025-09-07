import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'

// Custom render function that includes providers
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    // Add any providers here (Theme, Redux, etc.)
    <>{children}</>
  )
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) => render(ui, { wrapper: AllTheProviders, ...options })

export * from '@testing-library/react'
export { customRender as render }

// Common test utilities
export const createMockRouter = (pathname = '/', query = {}) => ({
  push: jest.fn(),
  replace: jest.fn(),
  prefetch: jest.fn(),
  back: jest.fn(),
  pathname,
  route: pathname,
  asPath: pathname,
  query,
  isReady: true,
})

// Mock component for testing
export const MockComponent = ({ children, ...props }: any) => (
  <div data-testid="mock-component" {...props}>
    {children}
  </div>
)

// Helper to wait for async operations
export const waitForLoadingToFinish = () =>
  new Promise((resolve) => setTimeout(resolve, 0))

// Helper to create mock functions with proper typing
export const createMockFn = <T extends (...args: any[]) => any>(): jest.MockedFunction<T> =>
  jest.fn() as jest.MockedFunction<T>
