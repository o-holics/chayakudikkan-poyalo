import { NextResponse } from 'next/server';
import { fsFetch, toFirestoreObject, fromFirestoreObject } from '@/lib/firebase';
import { getSessionToken, getJwtPayload } from '@/lib/auth';
import { roomPath, memberPath, evaluateTimer, updateSpotCounters, type QueueRoom } from '@/lib/queue';

export async function POST(request: Request) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = getJwtPayload(token);
  if (!payload?.sub) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  const uid = payload.sub;

  try {
    const { spotId, roomId } = await request.json();

    // Check user profile prior to reset
    let previousStatus = 'idle';
    let previousSpotId = spotId;
    try {
      const userData = await fsFetch(`users/${uid}`, {}, token);
      const user = fromFirestoreObject(userData.fields);
      previousStatus = user.status || 'idle';
      if (user.currentSpotId) previousSpotId = user.currentSpotId;
    } catch (e) {}

    // Remove from the specific room's members
    if (spotId && roomId) {
      await fsFetch(memberPath(spotId, roomId, uid), { method: 'DELETE' }, token).catch(() => {});

      // After removal, re-evaluate timer (may reset if count drops below minimum)
      try {
        const roomData = await fsFetch(roomPath(spotId, roomId), {}, token);
        const room = { id: roomId, ...fromFirestoreObject(roomData.fields) } as QueueRoom;

        if (room.status === 'waiting') {
          let memberCount = 0;
          try {
            const membersData = await fsFetch(memberPath(spotId, roomId), {}, token);
            memberCount = membersData.documents?.length || 0;
          } catch (e) {}

          // This will reset the timer if count dropped below minimum
          await evaluateTimer(spotId, room, memberCount, token);
        }
      } catch (e) {}
    }

    // Decrement appropriate counter on the spot
    if (previousSpotId) {
      if (previousStatus === 'waiting') {
        await updateSpotCounters(previousSpotId, -1, 0, token);
      } else if (previousStatus === 'matched') {
        await updateSpotCounters(previousSpotId, 0, -1, token);
      }
    }

    // Reset user status
    await fsFetch(`users/${uid}?updateMask.fieldPaths=status&updateMask.fieldPaths=currentSpotId&updateMask.fieldPaths=currentGroupId&updateMask.fieldPaths=currentRoomId`, {
      method: 'PATCH',
      body: JSON.stringify({
        fields: toFirestoreObject({ status: 'idle', currentSpotId: null, currentGroupId: null, currentRoomId: null })
      })
    }, token);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
