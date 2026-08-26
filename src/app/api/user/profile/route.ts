import { NextResponse } from 'next/server';
import { fsFetch, toFirestoreObject, fromFirestoreObject } from '@/lib/firebase';
import { getSessionToken, getJwtPayload } from '@/lib/auth';

export async function GET() {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = getJwtPayload(token);
  if (!payload || !payload.sub) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  try {
    const data = await fsFetch(`users/${payload.sub}`, {}, token);
    const profile = fromFirestoreObject(data.fields);
    return NextResponse.json(profile);
  } catch (error: any) {
    if (error.message.includes('404')) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = getJwtPayload(token);
  if (!payload || !payload.sub) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { username, gender, location, latitude, longitude, searchRadiusKm } = body;

    // Fetch existing user to preserve values if updating partially
    let existingProfile: any = {};
    try {
      const existingData = await fsFetch(`users/${payload.sub}`, {}, token);
      if (existingData?.fields) {
        existingProfile = fromFirestoreObject(existingData.fields);
      }
    } catch (e) {}

    const updatedProfile = {
      username: username || existingProfile.username || 'User',
      gender: gender || existingProfile.gender || 'other',
      email: payload.email || existingProfile.email || '',
      location: location !== undefined ? location : (existingProfile.location || ''),
      latitude: latitude !== undefined ? latitude : (existingProfile.latitude ?? null),
      longitude: longitude !== undefined ? longitude : (existingProfile.longitude ?? null),
      searchRadiusKm: searchRadiusKm !== undefined ? Number(searchRadiusKm) : (existingProfile.searchRadiusKm || 40),
      status: existingProfile.status || 'idle',
      createdAt: existingProfile.createdAt || new Date().toISOString()
    };

    const firestoreData = {
      fields: toFirestoreObject(updatedProfile)
    };

    // Update document in Firestore
    const fieldPaths = [
      'username', 'gender', 'email', 'location',
      'latitude', 'longitude', 'searchRadiusKm', 'status', 'createdAt'
    ].map(f => `updateMask.fieldPaths=${f}`).join('&');

    const result = await fsFetch(
      `users/${payload.sub}?${fieldPaths}`,
      {
        method: 'PATCH',
        body: JSON.stringify(firestoreData),
      },
      token
    );

    return NextResponse.json(fromFirestoreObject(result.fields));
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
