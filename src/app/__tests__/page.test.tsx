import React from 'react'
import { render, screen } from '@testing-library/react'
import Home from '../page'

// Mock Next.js font
jest.mock('next/font/google', () => ({
  Inter: () => ({
    className: 'inter',
  }),
}))

describe('Home Page', () => {
  it('renders the main heading', () => {
    render(<Home />)
    expect(screen.getByRole('heading', { name: /welcome to schools-in/i })).toBeInTheDocument()
  })

  it('renders the description text', () => {
    render(<Home />)
    expect(
      screen.getByText(/streamlined location-based check-in and check-out system/i)
    ).toBeInTheDocument()
  })

  it('renders the Get Started button', () => {
    render(<Home />)
    expect(screen.getByRole('button', { name: /get started/i })).toBeInTheDocument()
  })

  it('renders the Learn More button', () => {
    render(<Home />)
    expect(screen.getByRole('button', { name: /learn more/i })).toBeInTheDocument()
  })

  it('renders all feature cards', () => {
    render(<Home />)
    
    expect(screen.getByText('Provider Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Admin Panel')).toBeInTheDocument()
    expect(screen.getByText('Session History')).toBeInTheDocument()
    expect(screen.getByText('Mobile PWA')).toBeInTheDocument()
  })

  it('renders the component demo section', () => {
    render(<Home />)
    
    expect(screen.getByText('shadcn/ui Components Demo')).toBeInTheDocument()
    
    // Use getAllByText since there are multiple elements with same text
    const defaultElements = screen.getAllByText('Default')
    expect(defaultElements.length).toBeGreaterThan(0)
    
    const secondaryElements = screen.getAllByText('Secondary')
    expect(secondaryElements.length).toBeGreaterThan(0)
  })

  it('has proper semantic structure', () => {
    render(<Home />)
    
    // Should have main element
    expect(screen.getByRole('main')).toBeInTheDocument()
    
    // Should have proper heading hierarchy
    const headings = screen.getAllByRole('heading')
    expect(headings.length).toBeGreaterThan(0)
  })

  it('renders beta badge', () => {
    render(<Home />)
    expect(screen.getByText('Beta')).toBeInTheDocument()
  })
})
