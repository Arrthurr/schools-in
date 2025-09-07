// Custom React hook for GPS location handling

import { useState, useEffect } from 'react';
import { locationService, Coordinates, LocationError } from '../utils/location';

interface UseLocationReturn {
  location: Coordinates | null;
  loading: boolean;
  error: LocationError | null;
  getLocation: () => Promise<void>;
  clearError: () => void;
}

export const useLocation = (): UseLocationReturn => {
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<LocationError | null>(null);

  const getLocation = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const coords = await locationService.getCurrentLocation();
      setLocation(coords);
    } catch (err) {
      setError(err as LocationError);
      setLocation(null);
    } finally {
      setLoading(false);
    }
  };

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    location,
    loading,
    error,
    getLocation,
    clearError
  };
};
