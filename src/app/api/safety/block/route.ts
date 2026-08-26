import { NextResponse } from 'next/server';
import { fsFetch, toFirestoreObject, fromFirestoreObject } from '@/lib/firebase';
import { getSessionToken, getJwtPayload } from '@/lib/auth';
import { REPORT_REASONS } from '@/app/api/safety/report/route';

export async function GET() {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = getJwtPayload(token);
  if (!payload?.sub) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  const uid = payload.sub;

  try {
    const blocksData = await fsFetch(`users/${uid}/blocks`, {}, token);
    const blockedUsers = (blocksData.documents || []).map((doc: any) => ({
      uid: doc.name.split('/').pop(),
      ...fromFirestoreObject(doc.fields)
    }));

    return NextResponse.json(blockedUsers);
  } catch (error: any) {
    if (error.message?.includes('404')) {
      return NextResponse.json([]);
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = getJwtPayload(token);
  if (!payload?.sub) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  const uid = payload.sub;

  try {
    const { targetUid, targetUsername, reportReason } = await request.json();

    if (!targetUid) return NextResponse.json({ error: 'Target user ID required' }, { status: 400 });

    // Add to user's blocks
    await fsFetch(`users/${uid}/blocks/${targetUid}`, {
      method: 'PATCH',
      body: JSON.stringify({
        fields: toFirestoreObject({
          uid: targetUid,
          username: targetUsername || 'Unknown',
          blockedAt: new Date().toISOString()
        })
      })
    }, token);

    // Auto-remove friendship and pending requests in both directions
    await Promise.all([
      fsFetch(`users/${uid}/friends/${targetUid}`, { method: 'DELETE' }, token).catch(() => {}),
      fsFetch(`users/${targetUid}/friends/${uid}`, { method: 'DELETE' }, token).catch(() => {}),
      fsFetch(`users/${uid}/friendRequests/${targetUid}`, { method: 'DELETE' }, token).catch(() => {}),
      fsFetch(`users/${targetUid}/friendRequests/${uid}`, { method: 'DELETE' }, token).catch(() => {})
    ]);

    // If reportReason was also provided, save report
    if (reportReason && REPORT_REASONS.includes(reportReason)) {
      let reporterUsername = 'User';
      try {
        const uData = await fsFetch(`users/${uid}`, {}, token);
        reporterUsername = fromFirestoreObject(uData.fields)?.username || 'User';
      } catch (e) {}

      const reportId = `report-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
      await fsFetch(`reports/${reportId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          fields: toFirestoreObject({
            reporterUid: uid,
            reporterUsername,
            reportedUid: targetUid,
            reportedUsername: targetUsername || 'Unknown',
            reason: reportReason,
            createdAt: new Date().toISOString(),
            alsoBlocked: true
          })
        })
      }, token);
    }

    return NextResponse.json({ success: true, message: 'User blocked' });
  } catch (error: any) {
    console.error('Block error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = getJwtPayload(token);
  if (!payload?.sub) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  const uid = payload.sub;

  try {
    const { targetUid } = await request.json();
    if (!targetUid) return NextResponse.json({ error: 'Target user ID required' }, { status: 400 });

    await fsFetch(`users/${uid}/blocks/${targetUid}`, { method: 'DELETE' }, token);
    return NextResponse.json({ success: true, message: 'User unblocked' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
