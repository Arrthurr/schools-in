import { render, screen } from '@testing-library/react';
import { GoogleMap } from '../GoogleMap';

// Mock the API key
process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = 'test-key';

// Mock the Google Maps API
jest.mock('@vis.gl/react-google-maps', () => ({
  APIProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="api-provider">{children}</div>,
  Map: ({ children, center, zoom }: any) => (
    <div data-testid="map" data-center={JSON.stringify(center)} data-zoom={zoom}>
      {children}
    </div>
  ),
  Marker: ({ position, title }: any) => (
    <div data-testid="marker" data-position={JSON.stringify(position)} data-title={title} />
  ),
  InfoWindow: ({ children }: any) => <div data-testid="info-window">{children}</div>,
}));

describe('GoogleMap', () => {
  it('renders map with markers', () => {
    const markers = [
      {
        id: '1',
        position: { lat: 41.8781, lng: -87.6298 },
        title: 'Test School'
      }
    ];

    render(
      <GoogleMap
        center={{ lat: 41.8781, lng: -87.6298 }}
        markers={markers}
      />
    );

    // Test that map container is rendered
    expect(screen.getByTestId('api-provider')).toBeInTheDocument();
    expect(screen.getByTestId('map')).toBeInTheDocument();
    expect(screen.getByTestId('marker')).toBeInTheDocument();
  });

  it('handles mobile detection', () => {
    // Mock window.innerWidth
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 500,
    });

    render(
      <GoogleMap
        center={{ lat: 41.8781, lng: -87.6298 }}
        markers={[]}
      />
    );

    expect(screen.getByTestId('map')).toBeInTheDocument();
  });
});
