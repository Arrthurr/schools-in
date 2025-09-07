// API route for session CRUD operations

import { NextRequest, NextResponse } from 'next/server';
import { 
  createDocument, 
  getDocument, 
  updateDocument, 
  deleteDocument,
  getSessionsByUser,
  COLLECTIONS 
} from '@/lib/firebase/firestore';
import { Timestamp } from 'firebase/firestore';

// GET /api/sessions - Get sessions for a user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const limit = searchParams.get('limit');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const querySnapshot = await getSessionsByUser(userId, limit ? parseInt(limit) : 50);
    const sessions = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sessions' },
      { status: 500 }
    );
  }
}

// POST /api/sessions - Create a new session (check-in)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, schoolId, checkInLocation } = body;

    if (!userId || !schoolId || !checkInLocation) {
      return NextResponse.json(
        { error: 'User ID, School ID, and check-in location are required' },
        { status: 400 }
      );
    }

    const sessionData = {
      userId,
      schoolId,
      checkInTime: Timestamp.now(),
      checkInLocation,
      status: 'active',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };

    const sessionId = await createDocument(COLLECTIONS.SESSIONS, sessionData);

    return NextResponse.json({ 
      id: sessionId,
      ...sessionData
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating session:', error);
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    );
  }
}

// PUT /api/sessions - Update a session (check-out)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, checkOutLocation, status, notes } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    const updateData: any = {
      updatedAt: Timestamp.now()
    };

    if (checkOutLocation) {
      updateData.checkOutTime = Timestamp.now();
      updateData.checkOutLocation = checkOutLocation;
      updateData.status = 'completed';
    }

    if (status) {
      updateData.status = status;
    }

    if (notes) {
      updateData.notes = notes;
    }

    await updateDocument(COLLECTIONS.SESSIONS, sessionId, updateData);

    const updatedSession = await getDocument(COLLECTIONS.SESSIONS, sessionId);
    
    return NextResponse.json({
      id: sessionId,
      ...updatedSession.data()
    });
  } catch (error) {
    console.error('Error updating session:', error);
    return NextResponse.json(
      { error: 'Failed to update session' },
      { status: 500 }
    );
  }
}

// DELETE /api/sessions - Delete a session
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    await deleteDocument(COLLECTIONS.SESSIONS, sessionId);

    return NextResponse.json({ message: 'Session deleted successfully' });
  } catch (error) {
    console.error('Error deleting session:', error);
    return NextResponse.json(
      { error: 'Failed to delete session' },
      { status: 500 }
    );
  }
}
