import { NextResponse } from 'next/server';
import { fsFetch, toFirestoreObject, fromFirestoreObject } from '@/lib/firebase';
import { getSessionToken, getJwtPayload } from '@/lib/auth';

export async function GET() {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = getJwtPayload(token);
  if (!payload?.sub) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  const uid = payload.sub;

  try {
    // 1. Fetch Friends
    let friends: any[] = [];
    try {
      const friendsData = await fsFetch(`users/${uid}/friends`, {}, token);
      if (friendsData.documents) {
        friends = friendsData.documents.map((doc: any) => ({
          uid: doc.name.split('/').pop(),
          ...fromFirestoreObject(doc.fields)
        }));
      }
    } catch (e) {}

    // 2. Fetch Incoming Friend Requests
    let requests: any[] = [];
    try {
      const requestsData = await fsFetch(`users/${uid}/friendRequests`, {}, token);
      if (requestsData.documents) {
        requests = requestsData.documents.map((doc: any) => ({
          uid: doc.name.split('/').pop(),
          ...fromFirestoreObject(doc.fields)
        }));
      }
    } catch (e) {}

    return NextResponse.json({ friends, requests });
  } catch (error: any) {
    console.error('Friends fetch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = getJwtPayload(token);
  if (!payload?.sub) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  const senderUid = payload.sub;

  try {
    const { targetUid } = await request.json();
    if (!targetUid) return NextResponse.json({ error: 'Target user ID required' }, { status: 400 });
    if (targetUid === senderUid) return NextResponse.json({ error: 'Cannot friend yourself' }, { status: 400 });

    // Fetch sender profile
    const senderData = await fsFetch(`users/${senderUid}`, {}, token);
    const sender = fromFirestoreObject(senderData.fields);
    const senderUsername = sender.username || 'User';
    const senderGender = sender.gender || 'other';

    // Fetch target profile
    const targetData = await fsFetch(`users/${targetUid}`, {}, token);
    const target = fromFirestoreObject(targetData.fields);
    const targetUsername = target.username || 'User';
    const targetGender = target.gender || 'other';

    // Check if target has ALREADY sent us a friend request (Mutual request scenario!)
    let hasIncomingRequestFromTarget = false;
    try {
      const inc = await fsFetch(`users/${senderUid}/friendRequests/${targetUid}`, {}, token);
      if (inc?.fields) hasIncomingRequestFromTarget = true;
    } catch (e) {}

    if (hasIncomingRequestFromTarget) {
      // Auto-accept both and create mutual friendship!
      const now = new Date().toISOString();

      await Promise.all([
        // Add target to sender's friends
        fsFetch(`users/${senderUid}/friends/${targetUid}`, {
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

        // Add sender to target's friends
        fsFetch(`users/${targetUid}/friends/${senderUid}`, {
          method: 'PATCH',
          body: JSON.stringify({
            fields: toFirestoreObject({
              uid: senderUid,
              username: senderUsername,
              gender: senderGender,
              friendedAt: now
            })
          })
        }, token),

        // Clean up incoming request for sender
        fsFetch(`users/${senderUid}/friendRequests/${targetUid}`, { method: 'DELETE' }, token).catch(() => {}),

        // Clean up incoming request for target (if exists)
        fsFetch(`users/${targetUid}/friendRequests/${senderUid}`, { method: 'DELETE' }, token).catch(() => {})
      ]);

      return NextResponse.json({
        mutual: true,
        message: `Mutual request found! You and ${targetUsername} are now friends.`
      });
    }

    // Normal friend request: Add to target's incoming friendRequests
    await fsFetch(`users/${targetUid}/friendRequests/${senderUid}`, {
      method: 'PATCH',
      body: JSON.stringify({
        fields: toFirestoreObject({
          uid: senderUid,
          username: senderUsername,
          gender: senderGender,
          createdAt: new Date().toISOString()
        })
      })
    }, token);

    return NextResponse.json({
      success: true,
      message: `Friend request sent to ${targetUsername}`
    });

  } catch (error: any) {
    console.error('Send friend request error:', error);
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

    // Remove friendship both sides
    await Promise.all([
      fsFetch(`users/${uid}/friends/${targetUid}`, { method: 'DELETE' }, token).catch(() => {}),
      fsFetch(`users/${targetUid}/friends/${uid}`, { method: 'DELETE' }, token).catch(() => {})
    ]);

    return NextResponse.json({ success: true, message: 'Unfriended successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
