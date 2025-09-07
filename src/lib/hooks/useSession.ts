// Custom React hook for session management

import { useState, useCallback, useEffect } from 'react';
import { Timestamp } from 'firebase/firestore';
import { 
  createDocument, 
  updateDocument, 
  getSessionsByUser, 
  COLLECTIONS 
} from '../firebase/firestore';
import { SessionData } from '../utils/session';
import { Coordinates } from '../utils/location';

interface UseSessionReturn {
  currentSession: SessionData | null;
  sessions: SessionData[];
  loading: boolean;
  error: string | null;
  checkIn: (schoolId: string, location: Coordinates) => Promise<void>;
  checkOut: (sessionId: string, location: Coordinates) => Promise<void>;
  loadSessions: (userId: string) => Promise<void>;
  clearError: () => void;
}

export const useSession = (): UseSessionReturn => {
  const [currentSession, setCurrentSession] = useState<SessionData | null>(null);
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkIn = useCallback(async (schoolId: string, location: Coordinates) => {
    setLoading(true);
    setError(null);

    try {
      const sessionData = {
        userId: '', // Will be set by the calling component
        schoolId,
        checkInTime: Timestamp.now(),
        checkInLocation: location,
        status: 'active' as const,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      const sessionId = await createDocument(COLLECTIONS.SESSIONS, sessionData);
      
      const newSession = {
        id: sessionId,
        ...sessionData
      };
      
      setCurrentSession(newSession);
      setSessions(prev => [newSession, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check in');
    } finally {
      setLoading(false);
    }
  }, []);

  const checkOut = useCallback(async (sessionId: string, location: Coordinates) => {
    setLoading(true);
    setError(null);

    try {
      const checkOutTime = Timestamp.now();
      const updateData = {
        checkOutTime,
        checkOutLocation: location,
        status: 'completed' as const,
        updatedAt: checkOutTime
      };

      await updateDocument(COLLECTIONS.SESSIONS, sessionId, updateData);
      
      setCurrentSession(null);
      setSessions(prev => 
        prev.map(session => 
          session.id === sessionId 
            ? { ...session, ...updateData }
            : session
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check out');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSessions = useCallback(async (userId: string) => {
    setLoading(true);
    setError(null);

    try {
      const querySnapshot = await getSessionsByUser(userId);
      const sessionsData: SessionData[] = [];
      let activeSession: SessionData | null = null;

      querySnapshot.forEach((doc) => {
        const data = doc.data() as SessionData;
        const sessionWithId = { id: doc.id, ...data };
        
        sessionsData.push(sessionWithId);
        
        if (data.status === 'active') {
          activeSession = sessionWithId;
        }
      });

      setSessions(sessionsData);
      setCurrentSession(activeSession);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    currentSession,
    sessions,
    loading,
    error,
    checkIn,
    checkOut,
    loadSessions,
    clearError
  };
};
