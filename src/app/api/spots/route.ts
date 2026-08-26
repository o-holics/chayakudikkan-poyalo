import { NextResponse } from 'next/server';
import { fsFetch, fromFirestoreObject, toFirestoreObject } from '@/lib/firebase';
import { getSessionToken } from '@/lib/auth';

const DEFAULT_SPOTS = [
  {
    id: 'spot-1',
    name: 'Malabar Cafe',
    place: 'Kaloor, Kochi, Kerala',
    latitude: 9.9982,
    longitude: 76.2999,
    imageUrl: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=800&q=80',
    waitingCount: 0,
    matchedCount: 0,
    activeCount: 0
  },
  {
    id: 'spot-2',
    name: 'Marine Drive Waterfront Chai',
    place: 'Marine Drive, Ernakulam, Kerala',
    latitude: 9.9816,
    longitude: 76.2755,
    imageUrl: 'https://images.unsplash.com/photo-1519331379826-f10be5486c6f?auto=format&fit=crop&w=800&q=80',
    waitingCount: 0,
    matchedCount: 0,
    activeCount: 0
  },
  {
    id: 'spot-3',
    name: 'Panampilly Tea Lounge',
    place: 'Panampilly Nagar, Kochi, Kerala',
    latitude: 9.9620,
    longitude: 76.2954,
    imageUrl: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=800&q=80',
    waitingCount: 0,
    matchedCount: 0,
    activeCount: 0
  },
  {
    id: 'spot-4',
    name: 'Calicut Beachside Chai',
    place: 'Beach Road, Kozhikode, Kerala',
    latitude: 11.2588,
    longitude: 75.7804,
    imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
    waitingCount: 0,
    matchedCount: 0,
    activeCount: 0
  },
  {
    id: 'spot-5',
    name: 'Munnar Mist Tea Point',
    place: 'Munnar Town, Idukki, Kerala',
    latitude: 10.0889,
    longitude: 77.0595,
    imageUrl: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=800&q=80',
    waitingCount: 0,
    matchedCount: 0,
    activeCount: 0
  }
];

// In-memory 4-second cache to protect Firestore read limits across concurrent users
let cachedSpots: any = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 4000;

export async function GET() {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = Date.now();
  if (cachedSpots && now - lastCacheTime < CACHE_TTL_MS) {
    return NextResponse.json(cachedSpots);
  }

  try {
    const data = await fsFetch('spots', {}, token);

    let spots = [];
    if (data.documents && data.documents.length > 0) {
      // 100% dynamic from Firestore
      spots = data.documents.map((doc: any) => {
        const id = doc.name.split('/').pop();
        const fields = fromFirestoreObject(doc.fields);
        const waitingCount = fields.waitingCount || 0;
        const matchedCount = fields.matchedCount || 0;
        const activeCount = fields.activeCount || (waitingCount + matchedCount);

        return {
          id,
          ...fields,
          place: fields.place || fields.description || '',
          latitude: fields.latitude !== undefined ? Number(fields.latitude) : null,
          longitude: fields.longitude !== undefined ? Number(fields.longitude) : null,
          waitingCount,
          matchedCount,
          activeCount
        };
      });
    } else {
      // Auto-seed into Firestore so they exist as real documents in the database
      await Promise.all(
        DEFAULT_SPOTS.map((s) =>
          fsFetch(`spots/${s.id}`, {
            method: 'PATCH',
            body: JSON.stringify({
              fields: toFirestoreObject({
                name: s.name,
                place: s.place,
                latitude: s.latitude,
                longitude: s.longitude,
                imageUrl: s.imageUrl,
                waitingCount: 0,
                matchedCount: 0,
                activeCount: 0,
                createdAt: new Date().toISOString()
              })
            })
          }, token).catch(() => {})
        )
      );
      spots = DEFAULT_SPOTS;
    }

    cachedSpots = spots;
    lastCacheTime = now;

    return NextResponse.json(spots, {
      headers: {
        'Cache-Control': 'public, s-maxage=4, stale-while-revalidate=10',
      },
    });
  } catch (error: any) {
    if (error.message.includes('404')) {
      return NextResponse.json(DEFAULT_SPOTS);
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { name, place, latitude, longitude, imageUrl } = body;

    if (!name || !place) {
      return NextResponse.json({ error: 'Name and place are required' }, { status: 400 });
    }

    const spotId = `spot-${Date.now()}`;
    const spotData = {
      name,
      place,
      latitude: latitude !== undefined ? Number(latitude) : null,
      longitude: longitude !== undefined ? Number(longitude) : null,
      imageUrl: imageUrl || 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=800&q=80',
      waitingCount: 0,
      matchedCount: 0,
      activeCount: 0,
      createdAt: new Date().toISOString()
    };

    await fsFetch(`spots/${spotId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        fields: toFirestoreObject(spotData)
      })
    }, token);

    // Invalidate cache
    cachedSpots = null;

    return NextResponse.json({ id: spotId, ...spotData });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
