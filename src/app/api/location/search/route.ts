import { NextResponse } from 'next/server';

// Server-side in-memory cache for queries (1 hour TTL)
const queryCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');

  // Reverse geocoding
  if (lat && lon) {
    const cacheKey = `geo:${parseFloat(lat).toFixed(4)}:${parseFloat(lon).toFixed(4)}`;
    const cached = queryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(cached.data, {
        headers: {
          'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
        },
      });
    }

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'ChayakudikkanPoyalo/1.0',
            'Accept-Language': 'en',
          },
        }
      );
      if (!res.ok) throw new Error('Reverse geocode failed');
      const data = await res.json();
      const displayName = data.display_name || 'Current Location';
      const result = {
        name: displayName,
        lat: parseFloat(lat),
        lon: parseFloat(lon),
      };

      queryCache.set(cacheKey, { data: result, timestamp: Date.now() });

      return NextResponse.json(result, {
        headers: {
          'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
        },
      });
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }

  // Autocomplete forward search
  if (!q || q.trim().length < 2) {
    return NextResponse.json([]);
  }

  const normalizedQuery = q.trim().toLowerCase();
  const cached = queryCache.get(normalizedQuery);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(cached.data, {
      headers: {
        'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
      },
    });
  }

  try {
    // Try Photon API first for lightning fast autocomplete
    const photonRes = await fetch(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(q.trim())}&limit=6&lang=en`,
      {
        headers: { 'User-Agent': 'ChayakudikkanPoyalo/1.0' },
      }
    );

    if (photonRes.ok) {
      const pData = await photonRes.json();
      if (pData?.features && pData.features.length > 0) {
        const results = pData.features.map((f: any) => {
          const props = f.properties || {};
          const coords = f.geometry?.coordinates || [0, 0]; // [lon, lat]
          const parts = [
            props.name,
            props.street,
            props.city || props.town || props.district,
            props.state,
            props.country,
          ].filter(Boolean);
          
          return {
            name: parts.join(', ') || props.name || 'Unknown Location',
            lat: coords[1],
            lon: coords[0],
            city: props.city || props.town || props.state || '',
          };
        });

        queryCache.set(normalizedQuery, { data: results, timestamp: Date.now() });

        return NextResponse.json(results, {
          headers: {
            'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
          },
        });
      }
    }

    // Fallback to Nominatim OSM
    const nomRes = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q.trim())}&limit=6&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'ChayakudikkanPoyalo/1.0',
          'Accept-Language': 'en',
        },
      }
    );
    if (nomRes.ok) {
      const data = await nomRes.json();
      const results = (data || []).map((item: any) => ({
        name: item.display_name,
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
      }));

      queryCache.set(normalizedQuery, { data: results, timestamp: Date.now() });

      return NextResponse.json(results, {
        headers: {
          'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
        },
      });
    }

    return NextResponse.json([]);
  } catch (e: any) {
    console.error('Location search error:', e);
    return NextResponse.json([]);
  }
}
