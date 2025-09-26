import { render, screen, fireEvent } from '@testing-library/react';
import { NavigationButton } from '../NavigationButton';

// Mock window.open
const mockOpen = jest.fn();
Object.defineProperty(window, 'open', {
  value: mockOpen,
  writable: true,
});

describe('NavigationButton', () => {
  beforeEach(() => {
    mockOpen.mockClear();
  });

  it('renders navigation button', () => {
    const destination = {
      lat: 41.8781,
      lng: -87.6298,
      address: '1034 N Wells St, Chicago, IL 60610',
      name: 'Test School'
    };

    render(<NavigationButton destination={destination} />);

    expect(screen.getByText('Get Directions')).toBeInTheDocument();
  });

  it('opens Google Maps with coordinates when no address', () => {
    const destination = {
      lat: 41.8781,
      lng: -87.6298,
      name: 'Test School'
    };

    render(<NavigationButton destination={destination} />);

    const button = screen.getByText('Get Directions');
    fireEvent.click(button);

    expect(mockOpen).toHaveBeenCalledWith(
      'https://www.google.com/maps/dir/?api=1&destination=41.8781%2C-87.6298',
      '_blank'
    );
  });

  it('opens Google Maps with address when provided', () => {
    const destination = {
      lat: 41.8781,
      lng: -87.6298,
      address: '1034 N Wells St, Chicago, IL 60610',
      name: 'Test School'
    };

    render(<NavigationButton destination={destination} />);

    const button = screen.getByText('Get Directions');
    fireEvent.click(button);

    expect(mockOpen).toHaveBeenCalledWith(
      'https://www.google.com/maps/dir/?api=1&destination=1034%20N%20Wells%20St%2C%20Chicago%2C%20IL%2060610',
      '_blank'
    );
  });
});
