import { NextResponse } from 'next/server';
import { fsFetch, fromFirestoreObject } from '@/lib/firebase';
import { getSessionToken } from '@/lib/auth';

const DEFAULT_SPOTS = [
  {
    id: 'spot-1',
    name: 'Central Perk Cafe',
    description: 'A cozy coffee shop in the heart of the city.',
    imageUrl: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=800&q=80',
    waitingCount: 0
  },
  {
    id: 'spot-2',
    name: 'Downtown Library Steps',
    description: 'Great place to meet before exploring the downtown area.',
    imageUrl: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=800&q=80',
    waitingCount: 0
  },
  {
    id: 'spot-3',
    name: 'Riverside Park Bench',
    description: 'Quiet and scenic spot by the river.',
    imageUrl: 'https://images.unsplash.com/photo-1519331379826-f10be5486c6f?auto=format&fit=crop&w=800&q=80',
    waitingCount: 0
  }
];

export async function GET() {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const data = await fsFetch('spots', {}, token);
    
    let spots = [];
    if (data.documents && data.documents.length > 0) {
      spots = data.documents.map((doc: any) => {
        const id = doc.name.split('/').pop();
        return {
          id,
          ...fromFirestoreObject(doc.fields)
        };
      });
    } else {
      // If no spots exist in DB, return defaults to allow UI to function
      // In a real app, an admin would create these, or we'd run a seed script.
      spots = DEFAULT_SPOTS;
    }

    return NextResponse.json(spots);
  } catch (error: any) {
    // If collection doesn't exist yet, return defaults
    if (error.message.includes('404')) {
      return NextResponse.json(DEFAULT_SPOTS);
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
