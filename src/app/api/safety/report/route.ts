import { NextResponse } from 'next/server';
import { fsFetch, toFirestoreObject, fromFirestoreObject } from '@/lib/firebase';
import { getSessionToken, getJwtPayload } from '@/lib/auth';

export const REPORT_REASONS = [
  'Faking Gender',
  'Having unaccounted extra people with user',
  'Foul Language',
  'Unsafe vibes from this user',
] as const;

export type ReportReason = typeof REPORT_REASONS[number];

export async function POST(request: Request) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = getJwtPayload(token);
  if (!payload?.sub) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  const reporterUid = payload.sub;

  try {
    const { targetUid, targetUsername, reason, alsoBlock } = await request.json();

    if (!targetUid) return NextResponse.json({ error: 'Target user ID is required' }, { status: 400 });
    if (!REPORT_REASONS.includes(reason)) {
      return NextResponse.json({ error: 'Invalid report reason' }, { status: 400 });
    }

    // Fetch reporter username
    let reporterUsername = 'User';
    try {
      const uData = await fsFetch(`users/${reporterUid}`, {}, token);
      const u = fromFirestoreObject(uData.fields);
      reporterUsername = u.username || 'User';
    } catch (e) {}

    const reportId = `report-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
    const reportData = {
      reporterUid,
      reporterUsername,
      reportedUid: targetUid,
      reportedUsername: targetUsername || 'Unknown',
      reason,
      createdAt: new Date().toISOString(),
      alsoBlocked: !!alsoBlock
    };

    // Save report to reports collection
    await fsFetch(`reports/${reportId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        fields: toFirestoreObject(reportData)
      })
    }, token);

    // If alsoBlock is true, add to blocks subcollection and remove friendship in both directions
    if (alsoBlock) {
      await fsFetch(`users/${reporterUid}/blocks/${targetUid}`, {
        method: 'PATCH',
        body: JSON.stringify({
          fields: toFirestoreObject({
            uid: targetUid,
            username: targetUsername || 'Unknown',
            blockedAt: new Date().toISOString()
          })
        })
      }, token);

      await Promise.all([
        fsFetch(`users/${reporterUid}/friends/${targetUid}`, { method: 'DELETE' }, token).catch(() => {}),
        fsFetch(`users/${targetUid}/friends/${reporterUid}`, { method: 'DELETE' }, token).catch(() => {}),
        fsFetch(`users/${reporterUid}/friendRequests/${targetUid}`, { method: 'DELETE' }, token).catch(() => {}),
        fsFetch(`users/${targetUid}/friendRequests/${reporterUid}`, { method: 'DELETE' }, token).catch(() => {})
      ]);
    }

    return NextResponse.json({ success: true, message: 'Report submitted successfully' });
  } catch (error: any) {
    console.error('Report error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
