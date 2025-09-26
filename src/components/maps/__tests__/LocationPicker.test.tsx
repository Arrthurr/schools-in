import { render, screen, fireEvent } from '@testing-library/react';
import { LocationPicker } from '../LocationPicker';

// Mock the GoogleMap component
jest.mock('../GoogleMap', () => ({
  GoogleMap: ({ onMapClick, markers, className }: any) => (
    <div 
      data-testid="google-map" 
      className={className}
      onClick={() => onMapClick && onMapClick({ detail: { latLng: { lat: 41.8781, lng: -87.6298 } } })}
    >
      {markers.map((marker: any) => (
        <div key={marker.id} data-testid="marker" data-position={JSON.stringify(marker.position)} />
      ))}
    </div>
  ),
}));

describe('LocationPicker', () => {
  const mockOnLocationSelect = jest.fn();

  beforeEach(() => {
    mockOnLocationSelect.mockClear();
  });

  it('renders location picker with map', () => {
    render(
      <LocationPicker
        onLocationSelect={mockOnLocationSelect}
      />
    );

    expect(screen.getByTestId('google-map')).toBeInTheDocument();
    expect(screen.getByText('Click on the map to select location')).toBeInTheDocument();
  });

  it('handles map click and updates location', () => {
    render(
      <LocationPicker
        onLocationSelect={mockOnLocationSelect}
      />
    );

    const map = screen.getByTestId('google-map');
    fireEvent.click(map);

    expect(mockOnLocationSelect).toHaveBeenCalledWith({ lat: 41.8781, lng: -87.6298 });
  });

  it('displays coordinates', () => {
    render(
      <LocationPicker
        initialLocation={{ lat: 41.8781, lng: -87.6298 }}
        onLocationSelect={mockOnLocationSelect}
      />
    );

    expect(screen.getByText(/Lat: 41.878100, Lng: -87.629800/)).toBeInTheDocument();
  });
});
