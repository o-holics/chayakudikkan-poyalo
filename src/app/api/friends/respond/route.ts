import { NextResponse } from 'next/server';
import { fsFetch, toFirestoreObject, fromFirestoreObject } from '@/lib/firebase';
import { getSessionToken, getJwtPayload } from '@/lib/auth';

export async function POST(request: Request) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = getJwtPayload(token);
  if (!payload?.sub) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  const uid = payload.sub;

  try {
    const { targetUid, action } = await request.json();

    if (!targetUid || !['accept', 'decline'].includes(action)) {
      return NextResponse.json({ error: 'Valid targetUid and action (accept/decline) required' }, { status: 400 });
    }

    if (action === 'decline') {
      // Remove incoming friend request
      await fsFetch(`users/${uid}/friendRequests/${targetUid}`, { method: 'DELETE' }, token).catch(() => {});
      return NextResponse.json({ success: true, message: 'Friend request declined' });
    }

    // Action === 'accept'
    // 1. Fetch current user profile
    const userData = await fsFetch(`users/${uid}`, {}, token);
    const user = fromFirestoreObject(userData.fields);
    const username = user.username || 'User';
    const gender = user.gender || 'other';

    // 2. Fetch target user profile
    const targetData = await fsFetch(`users/${targetUid}`, {}, token);
    const target = fromFirestoreObject(targetData.fields);
    const targetUsername = target.username || 'User';
    const targetGender = target.gender || 'other';

    const now = new Date().toISOString();

    // 3. Establish mutual friendship
    await Promise.all([
      // Add target to user's friends
      fsFetch(`users/${uid}/friends/${targetUid}`, {
        method: 'PATCH',
        body: JSON.stringify({
          fields: toFirestoreObject({
            uid: targetUid,
            username: targetUsername,
            gender: targetGender,
            friendedAt: now
          })
        })
      }, token),

      // Add user to target's friends
      fsFetch(`users/${targetUid}/friends/${uid}`, {
        method: 'PATCH',
        body: JSON.stringify({
          fields: toFirestoreObject({
            uid,
            username,
            gender,
            friendedAt: now
          })
        })
      }, token),

      // Clean up incoming friend request for current user
      fsFetch(`users/${uid}/friendRequests/${targetUid}`, { method: 'DELETE' }, token).catch(() => {}),

      // Clean up incoming friend request for target user (in case target had also requested us)
      fsFetch(`users/${targetUid}/friendRequests/${uid}`, { method: 'DELETE' }, token).catch(() => {})
    ]);

    return NextResponse.json({
      success: true,
      message: `You are now friends with ${targetUsername}!`
    });

  } catch (error: any) {
    console.error('Respond friend request error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
