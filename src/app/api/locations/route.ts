// API route for location/school CRUD operations

import { NextRequest, NextResponse } from "next/server";
import {
  createDocument,
  getDocument,
  updateDocument,
  deleteDocument,
  getCollection,
  getLocationsByProvider,
  COLLECTIONS,
} from "@/lib/firebase/firestore";
import { Timestamp } from "firebase/firestore";

// GET /api/locations - Get schools/locations
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const providerId = searchParams.get("providerId");

    let schools;

    if (providerId) {
      // Get schools assigned to a specific provider
      schools = await getLocationsByProvider(providerId);
    } else {
      // Get all schools (admin view)
      schools = await getCollection(COLLECTIONS.LOCATIONS);
    }

    return NextResponse.json({ schools });
  } catch (error) {
    console.error("Error fetching schools:", error);
    return NextResponse.json(
      { error: "Failed to fetch schools" },
      { status: 500 },
    );
  }
}

// POST /api/locations - Create a new school
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, address, coordinates, radius, assignedProviders } = body;

    if (!name || !address || !coordinates || !radius) {
      return NextResponse.json(
        { error: "Name, address, coordinates, and radius are required" },
        { status: 400 },
      );
    }

    const schoolData = {
      name,
      address,
      coordinates,
      radius: Number(radius),
      assignedProviders: assignedProviders || [],
      isActive: true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const schoolId = await createDocument(COLLECTIONS.LOCATIONS, schoolData);

    return NextResponse.json(
      {
        id: schoolId,
        ...schoolData,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error creating school:", error);
    return NextResponse.json(
      { error: "Failed to create school" },
      { status: 500 },
    );
  }
}

// PUT /api/locations - Update a school
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      schoolId,
      name,
      address,
      coordinates,
      radius,
      assignedProviders,
      isActive,
    } = body;

    if (!schoolId) {
      return NextResponse.json(
        { error: "School ID is required" },
        { status: 400 },
      );
    }

    const updateData: any = {
      updatedAt: Timestamp.now(),
    };

    if (name) updateData.name = name;
    if (address) updateData.address = address;
    if (coordinates) updateData.coordinates = coordinates;
    if (radius !== undefined) updateData.radius = Number(radius);
    if (assignedProviders) updateData.assignedProviders = assignedProviders;
    if (isActive !== undefined) updateData.isActive = isActive;

    await updateDocument(COLLECTIONS.LOCATIONS, schoolId, updateData);

    const updatedSchool = await getDocument(COLLECTIONS.LOCATIONS, schoolId);

    return NextResponse.json({
      id: schoolId,
      ...(updatedSchool || {}),
    });
  } catch (error) {
    console.error("Error updating school:", error);
    return NextResponse.json(
      { error: "Failed to update school" },
      { status: 500 },
    );
  }
}

// DELETE /api/locations - Delete a school
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get("schoolId");

    if (!schoolId) {
      return NextResponse.json(
        { error: "School ID is required" },
        { status: 400 },
      );
    }

    await deleteDocument(COLLECTIONS.LOCATIONS, schoolId);

    return NextResponse.json({ message: "School deleted successfully" });
  } catch (error) {
    console.error("Error deleting school:", error);
    return NextResponse.json(
      { error: "Failed to delete school" },
      { status: 500 },
    );
  }
}
