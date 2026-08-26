// lib/firebase.ts
const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

/**
 * Make a direct REST API call to Firestore, optionally authorized with a Firebase ID token.
 */
export async function fsFetch(path: string, options: RequestInit = {}, token?: string) {
  if (!PROJECT_ID) {
    console.warn('Missing NEXT_PUBLIC_FIREBASE_PROJECT_ID environment variable.');
  }

  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  const url = `${BASE_URL}/${cleanPath}`;

  const headers = new Headers(options.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('Firestore fetch error:', errorData);
    throw new Error(errorData.error?.message || `Firestore request failed with status ${response.status}`);
  }

  return response.json();
}

/**
 * Run a structured Firestore query.
 */
export async function fsQuery(collectionId: string, filters: Record<string, any>, token?: string, parent?: string) {
  const url = parent
    ? `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${parent}:runQuery`
    : `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`;

  const fsFilters = Object.entries(filters).map(([field, value]) => ({
    fieldFilter: {
      field: { fieldPath: field },
      op: 'EQUAL',
      value: typeof value === 'string'
        ? { stringValue: value }
        : typeof value === 'number'
          ? { integerValue: value.toString() }
          : typeof value === 'boolean'
            ? { booleanValue: value }
            : { nullValue: null }
    }
  }));

  const body = {
    structuredQuery: {
      from: [{ collectionId }],
      where: fsFilters.length === 1
        ? fsFilters[0]
        : { compositeFilter: { op: 'AND', filters: fsFilters } }
    }
  };

  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Query failed: ${response.status}`);
  }

  const results: any[] = await response.json();
  // Filter out results that have no document (empty query result)
  return results.filter(r => r.document).map(r => {
    const id = r.document.name.split('/').pop();
    return { id, ...fromFirestoreObject(r.document.fields) };
  });
}

/**
 * Format a Javascript object into Firestore document fields format.
 */
export function toFirestoreObject(obj: any): any {
  if (obj === undefined || obj === null) {
    return { nullValue: null };
  }

  const fields: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      fields[key] = { stringValue: value };
    } else if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        fields[key] = { integerValue: value.toString() };
      } else {
        fields[key] = { doubleValue: value };
      }
    } else if (typeof value === 'boolean') {
      fields[key] = { booleanValue: value };
    } else if (Array.isArray(value)) {
      fields[key] = { arrayValue: { values: value.map((v) => toFirestoreObject({ temp: v }).temp) } };
    } else if (value === null) {
      fields[key] = { nullValue: null };
    } else if (typeof value === 'object') {
      fields[key] = { mapValue: { fields: toFirestoreObject(value) } };
    }
  }
  return fields;
}

/**
 * Parse a Firestore document fields object into a plain Javascript object.
 */
export function fromFirestoreObject(fields: any): any {
  if (!fields) return null;
  const obj: any = {};
  for (const [key, value] of Object.entries(fields)) {
    const val = value as any;
    if (val.stringValue !== undefined) obj[key] = val.stringValue;
    else if (val.integerValue !== undefined) obj[key] = parseInt(val.integerValue, 10);
    else if (val.doubleValue !== undefined) obj[key] = parseFloat(val.doubleValue);
    else if (val.booleanValue !== undefined) obj[key] = val.booleanValue;
    else if (val.nullValue !== undefined) obj[key] = null;
    else if (val.arrayValue !== undefined) obj[key] = (val.arrayValue.values || []).map((v: any) => fromFirestoreObject({ temp: v }).temp);
    else if (val.mapValue !== undefined) obj[key] = fromFirestoreObject(val.mapValue.fields || {});
    else if (val.timestampValue !== undefined) obj[key] = val.timestampValue;
  }
  return obj;
}
