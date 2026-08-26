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
    const { username, gender } = body;

    if (!username || !gender) {
      return NextResponse.json({ error: 'Username and gender are required' }, { status: 400 });
    }

    const firestoreData = {
      fields: toFirestoreObject({
        username,
        gender,
        email: payload.email || '',
        status: 'idle',
        createdAt: new Date().toISOString()
      })
    };

    // Update document in Firestore
    const result = await fsFetch(
      `users/${payload.sub}?updateMask.fieldPaths=username&updateMask.fieldPaths=gender&updateMask.fieldPaths=email&updateMask.fieldPaths=status&updateMask.fieldPaths=createdAt`,
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
