import { NextResponse } from 'next/server';
import { fsFetch, fromFirestoreObject } from '@/lib/firebase';
import { getSessionToken, getJwtPayload } from '@/lib/auth';

export async function GET() {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = getJwtPayload(token);
  if (!payload?.sub) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  const uid = payload.sub;

  try {
    const historyData = await fsFetch(`users/${uid}/meetupHistory`, {}, token);
    let history: any[] = [];
    if (historyData.documents) {
      history = historyData.documents.map((doc: any) => ({
        id: doc.name.split('/').pop(),
        ...fromFirestoreObject(doc.fields)
      }));
    }

    // Sort by matchedAt descending
    history.sort((a, b) => new Date(b.matchedAt || 0).getTime() - new Date(a.matchedAt || 0).getTime());

    return NextResponse.json(history);
  } catch (error: any) {
    if (error.message?.includes('404')) {
      return NextResponse.json([]);
    }
    console.error('History fetch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
